import * as path from 'path';
import { CreditCardParser, generateSearchTerms } from '../parser/htmlParser';
import { ImageService } from '../services/imageService';
import { CardService } from '../services/cardService';
import { CreditCard } from '../types/creditCard';

// Paths
const DATA_DIR = path.join(__dirname, '../../../Data');
const HTML_FILE = path.join(DATA_DIR, 'Compare Credit Cards (Latest Offers).html');
const IMAGE_DIR = path.join(DATA_DIR, 'Compare Credit Cards (Latest Offers)_files');

// Set to true to upload images to Firebase Storage (requires billing enabled)
const UPLOAD_IMAGES = process.argv.includes('--upload-images');

async function main() {
  console.log('🚀 Starting Credit Card Data Migration\n');

  // Step 1: Parse HTML
  console.log('📄 Step 1: Parsing HTML file...');
  const parser = CreditCardParser.fromFile(HTML_FILE);
  const rawCards = parser.parseAllCards();
  console.log(`   Found ${rawCards.length} credit cards\n`);

  if (rawCards.length === 0) {
    console.error('❌ No cards found. Check the HTML file structure.');
    process.exit(1);
  }

  // Log a sample card for verification
  console.log('📋 Sample parsed card:');
  console.log(JSON.stringify(rawCards[0], null, 2));
  console.log();

  // Step 2: Initialize image service
  console.log('🖼️ Step 2: Scanning image directory...');
  const imageService = new ImageService(IMAGE_DIR);
  console.log(`   Found ${imageService.getTotalImageCount()} images\n`);

  // Step 3: Upload images to Firebase Storage (optional)
  let imageUrls = new Map<string, string>();

  if (UPLOAD_IMAGES) {
    console.log('📤 Step 3: Uploading images to Firebase Storage...');
    try {
      imageUrls = await imageService.uploadAllImages((current, total, filename) => {
        if (current % 10 === 0 || current === total) {
          process.stdout.write(`   Progress: ${current}/${total} (${filename})\r`);
        }
      });
      console.log(`\n   Uploaded ${imageUrls.size} images\n`);
    } catch (error) {
      console.log('⚠️  Image upload skipped (Storage may not be configured)');
      console.log('   Run with --upload-images flag after enabling Firebase Storage billing\n');
    }
  } else {
    console.log('📤 Step 3: Skipping image upload (use --upload-images flag to enable)\n');
  }

  // Step 4: Transform cards and add image URLs
  console.log('🔄 Step 4: Transforming card data...');
  const cards: Array<Omit<CreditCard, 'createdAt' | 'updatedAt'>> = rawCards.map((raw) => {
    // Find image URL or use local filename for reference
    let imageUrl = '';
    let imageFilename = raw.imageFilename || '';

    if (UPLOAD_IMAGES && imageFilename) {
      imageUrl = imageUrls.get(imageFilename) || '';
    }

    if (!imageUrl && !imageFilename) {
      // Try to find by slug
      const foundImage = imageService.findImageForCard(raw.slug);
      if (foundImage) {
        imageFilename = foundImage;
        imageUrl = imageUrls.get(foundImage) || '';
      }
    }

    const card: Omit<CreditCard, 'createdAt' | 'updatedAt'> = {
      id: `card-${raw.slug}`,
      name: raw.name,
      slug: raw.slug,
      annualFee: raw.annualFee,
      annualFeeText: raw.annualFeeText,
      apr: {
        introApr: raw.introApr,
        regularApr: raw.regularApr,
      },
      rewards: {
        rate: raw.rewardsRate,
        bonus: raw.rewardsBonus,
        type: raw.rewardsType,
      },
      ratings: {
        overall: raw.overallRating,
        fees: raw.feesRating,
        rewards: raw.rewardsRating,
        cost: raw.costRating,
      },
      pros: raw.pros,
      cons: raw.cons,
      creditRequired: raw.creditRequired,
      country: 'United States',
      countryCode: 'US',
      currency: 'USD',
      currencySymbol: '$',
      imageUrl,
      imageFilename,
      searchTerms: generateSearchTerms(raw),
    };

    return card;
  });

  console.log(`   Transformed ${cards.length} cards\n`);

  // Step 5: Save to Firestore
  console.log('💾 Step 5: Saving to Firestore...');
  const cardService = new CardService();

  // Optional: Clear existing data
  const existingCount = await cardService.getCardCount();
  if (existingCount > 0) {
    console.log(`   Clearing ${existingCount} existing cards...`);
    await cardService.deleteAllCards();
  }

  // Save new cards
  await cardService.batchCreateCards(cards);

  // Verify
  const finalCount = await cardService.getCardCount();
  console.log(`\n✅ Migration complete! ${finalCount} cards saved to Firestore.`);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   - Total cards: ${finalCount}`);
  console.log(`   - Cards with images: ${cards.filter(c => c.imageUrl).length}`);
  console.log(`   - Cards with image filenames: ${cards.filter(c => c.imageFilename).length}`);
  console.log(`   - Cards with ratings: ${cards.filter(c => c.ratings.overall !== null).length}`);
  console.log(`   - Cards with no annual fee: ${cards.filter(c => c.annualFee === 0).length}`);

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
