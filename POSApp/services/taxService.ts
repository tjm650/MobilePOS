import { getTaxes } from './api';

export interface Tax {
  id: number;
  name: string;
  code: string;
  rate: number;
  description: string;
  is_active: boolean;
  is_compound: boolean;
  region: string;
  created_at: string;
  updated_at: string;
}

export interface TaxCalculation {
  tax: Tax;
  amount: number;
  isCompound: boolean;
}

export interface CartTaxSummary {
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  taxBreakdown: TaxCalculation[];
}

class TaxService {
  private taxes: Tax[] = [];
  private lastFetch: number = 0;
  private cacheDuration: number = 300000; // 5 minutes

  async getActiveTaxes(): Promise<Tax[]> {
    const now = Date.now();

    // Return cached taxes if they're still fresh
    if (this.taxes.length > 0 && (now - this.lastFetch) < this.cacheDuration) {
      return this.taxes.filter(tax => tax.is_active);
    }

    try {
      const allTaxes = await getTaxes();
      this.taxes = allTaxes;
      this.lastFetch = now;

      return this.taxes.filter(tax => tax.is_active);
    } catch (error) {
      console.error('Error fetching taxes:', error);
      // Return cached taxes even if stale, or empty array
      return this.taxes.filter(tax => tax.is_active);
    }
  }

  calculateCartTaxes(subtotal: number, region: string = ''): CartTaxSummary {
    const activeTaxes = this.taxes.filter(tax =>
      tax.is_active && (!region || tax.region === region || tax.region === '')
    );

    if (activeTaxes.length === 0) {
      return {
        subtotal,
        totalTax: 0,
        totalAmount: subtotal,
        taxBreakdown: [],
      };
    }

    const taxBreakdown: TaxCalculation[] = [];
    let currentAmount = subtotal;

    // Sort taxes to handle compound taxes correctly
    const sortedTaxes = activeTaxes.sort((a, b) => {
      // Non-compound taxes first, then compound taxes
      if (!a.is_compound && b.is_compound) return -1;
      if (a.is_compound && !b.is_compound) return 1;
      return 0;
    });

    for (const tax of sortedTaxes) {
      // Backend returns rate as decimal (0.15 for 15%), not percentage
      const taxAmount = currentAmount * tax.rate;

      taxBreakdown.push({
        tax,
        amount: taxAmount,
        isCompound: tax.is_compound,
      });

      if (tax.is_compound) {
        currentAmount += taxAmount; // Add tax to base for next compound tax
      }
    }

    const totalTax = taxBreakdown.reduce((sum, item) => sum + item.amount, 0);

    return {
      subtotal,
      totalTax,
      totalAmount: subtotal + totalTax,
      taxBreakdown,
    };
  }

  calculateItemTax(itemPrice: number, quantity: number, region: string = ''): TaxCalculation[] {
    const itemSubtotal = itemPrice * quantity;
    const cartSummary = this.calculateCartTaxes(itemSubtotal, region);

    return cartSummary.taxBreakdown;
  }

  formatTaxAmount(amount: number): string {
    return amount.toFixed(2);
  }

  formatTaxRate(rate: number): string {
    return `${rate}%`;
  }

  getTaxById(taxId: number): Tax | undefined {
    return this.taxes.find(tax => tax.id === taxId);
  }

  clearCache(): void {
    this.taxes = [];
    this.lastFetch = 0;
  }
}

export const taxService = new TaxService();