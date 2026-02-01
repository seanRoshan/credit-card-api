import { load, type CheerioAPI } from 'cheerio';
import * as fs from 'fs';
import { CreditCardRaw } from '../types/creditCard';

type CheerioSelection = ReturnType<CheerioAPI>;

export class CreditCardParser {
  private $: CheerioAPI;

  constructor(html: string) {
    this.$ = load(html);
  }

  static fromFile(filePath: string): CreditCardParser {
    const html = fs.readFileSync(filePath, 'utf-8');
    return new CreditCardParser(html);
  }

  parseAllCards(): CreditCardRaw[] {
    const cards: CreditCardRaw[] = [];
    const $ = this.$;

    // Find all card containers
    $('div.card-object[data-sel-id="cc-container"]').each((index, element) => {
      try {
        const card = this.parseCard($(element));
        if (card && card.name) {
          cards.push(card);
        }
      } catch (error) {
        console.error(`Error parsing card at index ${index}:`, error);
      }
    });

    return cards;
  }

  private parseCard(cardEl: CheerioSelection): CreditCardRaw | null {
    const $ = this.$;

    // Extract card name
    const nameEl = cardEl.find('[data-sel-id="card-title"] a span, [data-sel-id="card-title"] span');
    let name = nameEl.first().text().trim();

    // Remove trademark symbols for cleaner name
    name = this.cleanName(name);

    if (!name) {
      return null;
    }

    // Generate slug from name
    const slug = this.slugify(name);

    // Extract image filename
    const imageEl = cardEl.find('[data-sel-id="card-image"]');
    const imageSrc = imageEl.attr('src') || '';
    const imageFilename = this.extractImageFilename(imageSrc);

    // Extract APR information
    const purchaseIntroApr = this.cleanText(
      cardEl.find('[data-sel-id="purchase-intro-apr"]').text()
    );
    const transferIntroApr = this.cleanText(
      cardEl.find('[data-sel-id="transfer-intro-apr"]').text()
    );
    const regularApr = this.cleanText(
      cardEl.find('[data-sel-id="regular-apr"]').text()
    );

    // Extract annual fee
    const annualFeeText = this.cleanText(
      cardEl.find('[data-sel-id="annual-fee"]').text()
    );
    const annualFee = this.parseAnnualFee(annualFeeText);

    // Extract rewards information
    const rewardsRate = this.cleanText(
      cardEl.find('[data-sel-id="rewards-rate"]').text()
    );
    const rewardsBonus = this.cleanText(
      cardEl.find('[data-sel-id="rewards-bonus"]').text()
    );
    const rewardsType = this.detectRewardsType(rewardsRate);

    // Extract ratings from the wh-comp-grid
    const ratings = this.parseRatings(cardEl);

    // Extract credit required
    const creditRequired = this.cleanText(
      cardEl.find('[data-sel-id="accepted-credit"]').text()
    );

    // Extract WalletHub rating
    const whRatingText = cardEl.find('.details-wh-rating-num').first().text().trim();
    const overallRating = whRatingText ? parseFloat(whRatingText) : null;

    // Extract pros and cons
    const pros = this.parseListItems(cardEl, '[data-sel-id="pros-list"] [data-sel-id="pros-item"]');
    const cons = this.parseListItems(cardEl, '[data-sel-id="cons-list"] [data-sel-id="cons-item"]');

    return {
      name,
      slug,
      annualFee,
      annualFeeText: annualFeeText || '$0',
      introApr: this.formatIntroApr(purchaseIntroApr, transferIntroApr),
      regularApr: regularApr || 'N/A',
      rewardsRate: rewardsRate || null,
      rewardsBonus: rewardsBonus || null,
      rewardsType,
      overallRating: overallRating && !isNaN(overallRating) ? overallRating : null,
      feesRating: ratings.fees,
      rewardsRating: ratings.rewards,
      costRating: ratings.cost,
      pros,
      cons,
      creditRequired: creditRequired || 'N/A',
      imageFilename,
    };
  }

  private parseRatings(cardEl: CheerioSelection): {
    fees: number | null;
    rewards: number | null;
    cost: number | null;
  } {
    const ratings = {
      fees: null as number | null,
      rewards: null as number | null,
      cost: null as number | null,
    };

    cardEl.find('.wh-comp-item .ng-binding').each((_, el) => {
      const text = this.$(el).text().trim().toLowerCase();
      const match = text.match(/(\w+):\s*([\d.]+)/);
      if (match) {
        const [, category, value] = match;
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          if (category === 'fees') ratings.fees = numValue;
          else if (category === 'rewards') ratings.rewards = numValue;
          else if (category === 'cost') ratings.cost = numValue;
        }
      }
    });

    return ratings;
  }

  private parseListItems(cardEl: CheerioSelection, selector: string): string[] {
    const items: string[] = [];
    cardEl.find(selector).each((_, el) => {
      const text = this.cleanText(this.$(el).text());
      if (text) {
        items.push(text);
      }
    });
    return items;
  }

  private cleanName(name: string): string {
    return name
      .replace(/[®™©]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim();
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[®™©]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private extractImageFilename(src: string): string | null {
    if (!src) return null;
    const parts = src.split('/');
    return parts[parts.length - 1] || null;
  }

  private parseAnnualFee(text: string): number {
    if (!text) return 0;
    const match = text.match(/\$?([\d,]+)/);
    if (match) {
      return parseInt(match[1].replace(',', ''), 10);
    }
    return 0;
  }

  private formatIntroApr(purchaseIntro: string, transferIntro: string): string | null {
    const parts: string[] = [];

    if (purchaseIntro && purchaseIntro !== 'Not Offered' && purchaseIntro !== 'N/A') {
      parts.push(`Purchase: ${purchaseIntro}`);
    }
    if (transferIntro && transferIntro !== 'Not Offered' && transferIntro !== 'N/A') {
      parts.push(`Transfer: ${transferIntro}`);
    }

    return parts.length > 0 ? parts.join(' | ') : null;
  }

  private detectRewardsType(rewardsRate: string | null): string | null {
    if (!rewardsRate) return null;
    const lower = rewardsRate.toLowerCase();

    if (lower.includes('cash') || lower.includes('%')) return 'cashback';
    if (lower.includes('mile')) return 'miles';
    if (lower.includes('point')) return 'points';

    return 'rewards';
  }
}

// Utility function to generate search terms
export function generateSearchTerms(card: CreditCardRaw): string[] {
  const terms = new Set<string>();

  // Add name words
  card.name.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 2) terms.add(word);
  });

  // Add common variations
  const nameVariations = card.name.toLowerCase()
    .replace(/\./g, '')
    .replace(/-/g, ' ');
  nameVariations.split(/\s+/).forEach(word => {
    if (word.length > 2) terms.add(word);
  });

  // Add rewards type
  if (card.rewardsType) {
    terms.add(card.rewardsType);
  }

  // Add credit level
  if (card.creditRequired) {
    card.creditRequired.toLowerCase().split(/[,\s]+/).forEach(word => {
      if (word.length > 2) terms.add(word);
    });
  }

  // Add features
  if (card.annualFee === 0) {
    terms.add('no annual fee');
    terms.add('free');
  }

  return Array.from(terms);
}
