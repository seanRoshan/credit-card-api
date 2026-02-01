import axios from 'axios';
import { bucket } from '../config/firebase';
import logger, { loggers } from '../config/logger';

const STORAGE_PATH_PREFIX = 'credit-cards/images';
const CACHE_CONTROL = 'public, max-age=31536000'; // 1 year

/**
 * Download an image from a URL and return as Buffer
 */
async function downloadImage(imageUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  return {
    buffer: Buffer.from(response.data),
    contentType: response.headers['content-type'] || 'image/webp',
  };
}

/**
 * Generate a filename for a card image
 */
function generateFilename(slug: string, originalUrl: string): string {
  // Try to preserve original extension
  const urlParts = originalUrl.split('/');
  const originalName = urlParts[urlParts.length - 1];
  const extMatch = originalName.match(/\.(webp|png|jpg|jpeg|avif)$/i);
  const extension = extMatch ? extMatch[1].toLowerCase() : 'webp';

  // Add unique suffix to prevent collisions
  const uniqueSuffix = Date.now().toString(36);
  return `${slug}-${uniqueSuffix}.${extension}`;
}

/**
 * Upload an image to Firebase Storage
 */
export async function uploadImage(
  imageUrl: string,
  slug: string
): Promise<string> {
  try {
    logger.debug(`Downloading image from ${imageUrl}`);

    // Download the image
    const { buffer, contentType } = await downloadImage(imageUrl);

    // Generate filename
    const filename = generateFilename(slug, imageUrl);
    const storagePath = `${STORAGE_PATH_PREFIX}/${filename}`;

    logger.debug(`Uploading to ${storagePath}`);

    // Upload to Firebase Storage
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: CACHE_CONTROL,
      },
    });

    // Make the file public
    await file.makePublic();

    // Generate public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    loggers.scraper(slug, 'image uploaded', { url: publicUrl });
    return publicUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Image upload failed: ${errorMsg}`), {
      imageUrl,
      slug,
    });
    throw error;
  }
}

/**
 * Download and upload an image, returning the public URL
 * Returns empty string if no image URL provided or upload fails
 */
export async function processCardImage(
  imageUrl: string | null,
  slug: string
): Promise<string> {
  if (!imageUrl) {
    logger.debug(`No image URL for ${slug}`);
    return '';
  }

  try {
    return await uploadImage(imageUrl, slug);
  } catch (error) {
    // Log error but don't fail the whole scrape
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`Failed to process image for ${slug}: ${errorMsg}`);
    return '';
  }
}

/**
 * Delete an image from Firebase Storage
 */
export async function deleteImage(imageUrl: string): Promise<boolean> {
  try {
    // Extract path from URL
    const bucketName = bucket.name;
    const prefix = `https://storage.googleapis.com/${bucketName}/`;

    if (!imageUrl.startsWith(prefix)) {
      logger.warn(`Invalid image URL format: ${imageUrl}`);
      return false;
    }

    const storagePath = imageUrl.replace(prefix, '');
    const file = bucket.file(storagePath);

    await file.delete();
    logger.debug(`Deleted image: ${storagePath}`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`Failed to delete image: ${errorMsg}`);
    return false;
  }
}

/**
 * Check if an image exists in storage
 */
export async function imageExists(imageUrl: string): Promise<boolean> {
  try {
    const bucketName = bucket.name;
    const prefix = `https://storage.googleapis.com/${bucketName}/`;

    if (!imageUrl.startsWith(prefix)) {
      return false;
    }

    const storagePath = imageUrl.replace(prefix, '');
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();

    return exists;
  } catch {
    return false;
  }
}
