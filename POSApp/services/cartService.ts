import { databaseService, Product } from './database';
import { taxService, CartTaxSummary } from './taxService';
import { api } from './api';

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  added_at: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  created_at: string;
  updated_at: string;
}

class CartService {
  private currentCart: Cart | null = null;

  // Initialize or get current cart
  async getCurrentCart(): Promise<Cart> {
    if (!this.currentCart) {
      this.currentCart = {
        id: `cart_${Date.now()}`,
        items: [],
        total: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return this.currentCart;
  }

  // Add item to cart
  async addToCart(product: Product, quantity: number = 1): Promise<Cart> {
    const cart = await this.getCurrentCart();

    // Check if product already exists in cart
    const existingItem = cart.items.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      const cartItem: CartItem = {
        id: `item_${product.id}_${Date.now()}`,
        product,
        quantity,
        added_at: new Date().toISOString(),
      };
      cart.items.push(cartItem);
    }

    cart.total = this.calculateTotal(cart.items);
    cart.updated_at = new Date().toISOString();

    this.currentCart = cart;
    return cart;
  }

  // Remove item from cart
  async removeFromCart(productId: number): Promise<Cart> {
    const cart = await this.getCurrentCart();

    cart.items = cart.items.filter(item => item.product.id !== productId);
    cart.total = this.calculateTotal(cart.items);
    cart.updated_at = new Date().toISOString();

    this.currentCart = cart;
    return cart;
  }

  // Update item quantity
  async updateQuantity(productId: number, quantity: number): Promise<Cart> {
    const cart = await this.getCurrentCart();

    const item = cart.items.find(item => item.product.id === productId);
    if (item) {
      if (quantity <= 0) {
        await this.removeFromCart(productId);
      } else {
        item.quantity = quantity;
        cart.total = this.calculateTotal(cart.items);
        cart.updated_at = new Date().toISOString();
      }
    }

    this.currentCart = cart;
    return cart;
  }

  // Clear cart
  async clearCart(): Promise<void> {
    this.currentCart = null;
  }

  // Get cart items
  async getCartItems(): Promise<CartItem[]> {
    const cart = await this.getCurrentCart();
    return cart.items;
  }

  // Get cart total
  async getCartTotal(): Promise<number> {
    const cart = await this.getCurrentCart();
    return cart.total;
  }

  // Get cart with tax calculations
  async getCartWithTaxes(region: string = ''): Promise<Cart & { taxSummary: CartTaxSummary }> {
    const cart = await this.getCurrentCart();
    const subtotal = this.calculateSubtotal(cart.items);
    const taxSummary = taxService.calculateCartTaxes(subtotal, region);

    return {
      ...cart,
      total: taxSummary.totalAmount,
      taxSummary,
    };
  }

  // Get tax summary for current cart
  async getCartTaxSummary(region: string = ''): Promise<CartTaxSummary> {
    const cart = await this.getCurrentCart();
    const subtotal = this.calculateSubtotal(cart.items);
    return taxService.calculateCartTaxes(subtotal, region);
  }

  // Calculate subtotal (before taxes)
  private calculateSubtotal(items: CartItem[]): number {
    return items.reduce((total, item) => {
      return total + (item.product.selling_price * item.quantity);
    }, 0);
  }

  // Calculate total from items
  private calculateTotal(items: CartItem[]): number {
    return items.reduce((total, item) => {
      return total + (item.product.selling_price * item.quantity);
    }, 0);
  }

  // Save cart for persistence (optional)
  async saveCartToStorage(): Promise<void> {
    if (this.currentCart) {
      const cartData = JSON.stringify(this.currentCart);
      // In a real app, you might want to save this to AsyncStorage
      console.log('Cart saved:', cartData);
    }
  }

  // Load cart from storage (optional)
  async loadCartFromStorage(): Promise<Cart | null> {
    try {
      // In a real app, you might want to load this from AsyncStorage
      // const cartData = await AsyncStorage.getItem('currentCart');
      // if (cartData) {
      //   this.currentCart = JSON.parse(cartData);
      //   return this.currentCart;
      // }
      return null;
    } catch (error) {
      console.error('Error loading cart:', error);
      return null;
    }
  }
}

export const cartService = new CartService();

// Convenience helpers expected by some screens
export async function addToCart(currentItems: CartItem[], product: Product, quantity: number = 1) {
  const cart = await cartService.getCurrentCart();
  // sync with provided items for stateless usage
  cart.items = currentItems.length ? currentItems : cart.items;
  await cartService.addToCart(product, quantity);
  return cart.items;
}

export function getCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (item.product.selling_price * item.quantity), 0);
}

export async function scanProduct(barcode: string) {
  return api.scanProduct(barcode);
}