import * as fs from 'fs';
import * as path from 'path';
import { bucket } from '../config/firebase';

export class ImageService {
  private imageDirectory: string;
  private imageCache: Map<string, string[]>;

  constructor(imageDirectory: string) {
    this.imageDirectory = imageDirectory;
    this.imageCache = this.buildImageCache();
  }

  private buildImageCache(): Map<string, string[]> {
    const cache = new Map<string, string[]>();

    if (!fs.existsSync(this.imageDirectory)) {
      console.warn(`Image directory not found: ${this.imageDirectory}`);
      return cache;
    }

    const files = fs.readdirSync(this.imageDirectory);
    const imageExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.avif'];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!imageExtensions.includes(ext)) continue;

      // Extract slug from filename (e.g., "j-crew-mastercard-18033538c.jpg" -> "j-crew-mastercard")
      const slug = this.extractSlugFromFilename(file);
      if (slug) {
        const existing = cache.get(slug) || [];
        existing.push(file);
        cache.set(slug, existing);
      }
    }

    console.log(`📷 Built image cache with ${cache.size} unique card images`);
    return cache;
  }

  private extractSlugFromFilename(filename: string): string | null {
    // Pattern: card-name-slug-12345678c.ext
    const match = filename.match(/^(.+?)-\d+c\.(webp|png|jpg|jpeg|avif)$/i);
    if (match) {
      return match[1].toLowerCase();
    }
    return null;
  }

  findImageForCard(cardSlug: string): string | null {
    // Try exact match first
    const exactImages = this.imageCache.get(cardSlug);
    if (exactImages && exactImages.length > 0) {
      return this.selectBestImage(exactImages);
    }

    // Try partial match
    for (const [slug, images] of this.imageCache.entries()) {
      if (slug.includes(cardSlug) || cardSlug.includes(slug)) {
        return this.selectBestImage(images);
      }
    }

    return null;
  }

  findImageByFilename(filename: string): string | null {
    if (!filename) return null;

    const fullPath = path.join(this.imageDirectory, filename);
    if (fs.existsSync(fullPath)) {
      return filename;
    }

    // Try to find a similar filename
    const baseName = path.basename(filename, path.extname(filename));
    for (const images of this.imageCache.values()) {
      for (const img of images) {
        if (img.includes(baseName)) {
          return img;
        }
      }
    }

    return null;
  }

  private selectBestImage(images: string[]): string {
    // Prefer WebP > PNG > JPG > JPEG > AVIF
    const formatPriority = ['webp', 'png', 'jpg', 'jpeg', 'avif'];

    for (const format of formatPriority) {
      const match = images.find(img => img.toLowerCase().endsWith(`.${format}`));
      if (match) return match;
    }

    return images[0];
  }

  async uploadImage(filename: string): Promise<string | null> {
    const localPath = path.join(this.imageDirectory, filename);

    if (!fs.existsSync(localPath)) {
      console.warn(`Image not found: ${localPath}`);
      return null;
    }

    const storagePath = `credit-cards/images/${filename}`;

    try {
      await bucket.upload(localPath, {
        destination: storagePath,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Make the file publicly accessible
      const file = bucket.file(storagePath);
      await file.makePublic();

      // Return public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      return publicUrl;
    } catch (error) {
      console.error(`Error uploading ${filename}:`, error);
      return null;
    }
  }

  async uploadAllImages(
    onProgress?: (current: number, total: number, filename: string) => void
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const allImages: string[] = [];

    // Collect all unique images
    for (const images of this.imageCache.values()) {
      for (const img of images) {
        if (!allImages.includes(img)) {
          allImages.push(img);
        }
      }
    }

    console.log(`📤 Uploading ${allImages.length} images to Firebase Storage...`);

    let uploaded = 0;
    const concurrency = 5; // Upload 5 at a time

    for (let i = 0; i < allImages.length; i += concurrency) {
      const batch = allImages.slice(i, i + concurrency);
      const uploadPromises = batch.map(async (filename) => {
        const url = await this.uploadImage(filename);
        if (url) {
          results.set(filename, url);
        }
        uploaded++;
        if (onProgress) {
          onProgress(uploaded, allImages.length, filename);
        }
      });

      await Promise.all(uploadPromises);
    }

    console.log(`✅ Uploaded ${results.size} images successfully`);
    return results;
  }

  getLocalImagePath(filename: string): string {
    return path.join(this.imageDirectory, filename);
  }

  getTotalImageCount(): number {
    let count = 0;
    for (const images of this.imageCache.values()) {
      count += images.length;
    }
    return count;
  }
}
