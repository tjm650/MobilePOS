import React from 'react';
import { API_BASE_URL } from '../constants/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { databaseService, Product } from './database';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface InventoryUpdateMessage extends WebSocketMessage {
  type: 'inventory_updated';
  product_id: number;
  product_barcode?: string;
  product_name?: string;
  new_stock: number;
  previous_stock: number;
  change: number;
  transaction_type: 'sale' | 'purchase' | 'adjustment' | 'return';
  updated_by: string;
  timestamp: string;
}

export interface SaleCompletedMessage extends WebSocketMessage {
  type: 'sale_completed';
  sale_id: number;
  total_amount: string;
  item_count: number;
  completed_by: string;
}

export interface ProductScanMessage extends WebSocketMessage {
  type: 'product_found' | 'product_not_found';
  product?: {
    id: number;
    item_id?: string;
    sku?: string;
    barcode: string;
    product_name: string;
    brand?: string;
    category?: string;
    selling_price: number;
    current_stock: number;
    minimum_stock_level?: number;
    is_low_stock: boolean;
    is_active: boolean;
  };
  barcode?: string;
}

export interface ProductSyncMessage extends WebSocketMessage {
  type: 'product_synced';
  products: Array<{
    id: number;
    item_id?: string;
    sku?: string;
    barcode: string;
    product_name: string;
    brand?: string;
    product_line?: string;
    variant?: string;
    category?: string;
    subcategory?: string;
    description?: string;
    features?: string[];
    cost_price?: number;
    selling_price: number;
    wholesale_price?: number;
    retail_price?: number;
    current_stock: number;
    minimum_stock_level?: number;
    reorder_quantity?: number;
    size?: string;
    unit_of_measure?: string;
    weight?: number;
    weight_unit?: string;
    dimensions?: string;
    color?: string;
    material?: string;
    tags?: string[];
    collection?: string;
    region_code?: string;
    region_specific_id?: string;
    display_name?: string;
    is_new?: boolean;
    is_featured?: boolean;
    image_urls?: string[];
    thumbnail_url?: string;
    supplier_id?: string;
    supplier_name?: string;
    supplier_code?: string;
    location?: string;
    expiry_date?: string;
    batch_number?: string;
    is_active: boolean;
    date_created: string;
    date_modified: string;
  }>;
  sync_timestamp: string;
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: MessageHandler[] = [];
  private storeId: string | null = null;
  private isConnected = false;

  async connect(storeId: string): Promise<void> {
    this.storeId = storeId;

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // WebSocket functionality has been replaced with HTTP endpoints
      // Log that WebSocket is disabled and return successfully
      console.log('WebSocket functionality disabled - using HTTP endpoints instead');
      this.isConnected = false; // Indicate WebSocket is not connected

      // Don't attempt to create WebSocket connection
      return;

    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.reconnectDelay}ms`);

      setTimeout(() => {
        if (this.storeId) {
          this.connect(this.storeId);
        }
      }, this.reconnectDelay);

      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('Received WebSocket message:', message);

    // Handle inventory updates specifically
    if (message.type === 'inventory_updated') {
      this.handleInventoryUpdate(message as InventoryUpdateMessage);
    }

    // Handle product sync messages
    if (message.type === 'product_synced') {
      this.handleProductSync(message as ProductSyncMessage);
    }

    // Notify all registered handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private async handleInventoryUpdate(message: InventoryUpdateMessage): Promise<void> {
    try {
      console.log('Processing inventory update:', message);

      // Update local database with new stock level
      const updatedProduct: Product = {
        id: message.product_id,
        barcode: message.product_barcode || '',
        product_name: message.product_name || 'Unknown Product',
        selling_price: 0, // Will be updated from database if needed
        current_stock: message.new_stock,
        is_active: true,
        date_created: new Date().toISOString(),
        date_modified: message.timestamp,
      };

      await databaseService.saveProducts([updatedProduct]);

      console.log(`Updated inventory for product ${message.product_id}: ${message.previous_stock} -> ${message.new_stock}`);
    } catch (error) {
      console.error('Error handling inventory update:', error);
    }
  }

  private async handleProductSync(message: ProductSyncMessage): Promise<void> {
    try {
      console.log('Processing product sync:', message.products.length, 'products');

      // Save all synced products to local database
      await databaseService.saveProducts(message.products);

      console.log(`Synced ${message.products.length} products from server`);
    } catch (error) {
      console.error('Error handling product sync:', error);
    }
  }

  public send(message: WebSocketMessage): void {
    // WebSocket functionality disabled - using HTTP endpoints instead
    console.log('WebSocket disabled, message not sent:', message.type);
  }

  public addMessageHandler(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);

    // Return cleanup function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  public removeMessageHandler(handler: MessageHandler): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index > -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.messageHandlers = [];
    this.reconnectAttempts = 0;
  }

  public isWebSocketConnected(): boolean {
    // WebSocket functionality disabled
    return false;
  }

  // Convenience methods for common operations
  public scanProduct(barcode: string): void {
    this.send({
      type: 'product_scan',
      barcode: barcode,
    });
  }

  public updateInventory(productId: number, quantityChange: number, transactionType: string): void {
    this.send({
      type: 'inventory_update',
      product_id: productId,
      quantity_change: quantityChange,
      transaction_type: transactionType,
    });
  }

  public completeSale(items: any[], totalAmount: number): void {
    this.send({
      type: 'sale_complete',
      items: items,
      total_amount: totalAmount,
    });
  }

  public sendPing(): void {
    this.send({
      type: 'ping',
    });
  }

  public requestProductSync(): void {
    this.send({
      type: 'request_product_sync',
    });
  }

  public broadcastInventoryUpdate(productId: number, quantityChange: number, transactionType: string, productDetails?: any): void {
    this.send({
      type: 'inventory_update',
      product_id: productId,
      quantity_change: quantityChange,
      transaction_type: transactionType,
      product_details: productDetails,
      timestamp: new Date().toISOString(),
    });
  }
}

export const webSocketService = new WebSocketService();
export { webSocketService as websocketService };

// React hook for using WebSocket in components
export const useWebSocket = (storeId: string | null) => {
  const [isConnected, setIsConnected] = React.useState(false);
  const [messages, setMessages] = React.useState<WebSocketMessage[]>([]);

  React.useEffect(() => {
    if (storeId) {
      webSocketService.connect(storeId);

      const handleConnectionChange = () => {
        setIsConnected(webSocketService.isWebSocketConnected());
      };

      const messageHandler = (message: WebSocketMessage) => {
        setMessages(prev => [...prev.slice(-49), message]); // Keep last 50 messages
      };

      const cleanupMessageHandler = webSocketService.addMessageHandler(messageHandler);

      // Check connection status periodically
      const connectionCheckInterval = setInterval(handleConnectionChange, 1000);

      return () => {
        clearInterval(connectionCheckInterval);
        cleanupMessageHandler();
        webSocketService.disconnect();
      };
    }
  }, [storeId]);

  return {
    isConnected,
    messages,
    sendMessage: webSocketService.send.bind(webSocketService),
    scanProduct: webSocketService.scanProduct.bind(webSocketService),
    updateInventory: webSocketService.updateInventory.bind(webSocketService),
    completeSale: webSocketService.completeSale.bind(webSocketService),
  };
};