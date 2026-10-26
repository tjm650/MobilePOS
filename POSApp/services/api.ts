import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/constants';

class ApiService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private resolvedBaseUrl: string | null = null;

  private async getBaseUrl(): Promise<string> {
    if (this.resolvedBaseUrl) return this.resolvedBaseUrl;

    // Try stored override first
    const stored = await AsyncStorage.getItem('api_base_url_override');
    const candidates = [
      stored,
      API_BASE_URL,
      // Common Expo/Metro LAN hosts
      'http://192.168.0.100:8000',
      'http://192.168.1.100:8000',
      'http://10.0.2.2:8000', // Android emulator to host
      'http://localhost:8000',
      'http://127.0.0.1:8000',
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${candidate}/health`, { method: 'GET', signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          this.resolvedBaseUrl = candidate;
          await AsyncStorage.setItem('api_base_url_effective', candidate);
          return candidate;
        }
      } catch (_) {
        // try next
      }
    }
    // Fallback to configured constant if none probed
    this.resolvedBaseUrl = API_BASE_URL;
    return API_BASE_URL;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    try {
      const base = await this.getBaseUrl();
      const url = `${base}${endpoint}`;

      const config: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      };

      // No authentication required for development
      const response = await fetch(url, config);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const err = new Error(`HTTP ${response.status} on ${endpoint}: ${body}`);
        // Attach meta for easier debugging
        (err as any).status = response.status;
        (err as any).endpoint = endpoint;
        (err as any).url = url;
        throw err;
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', {
        endpoint,
        method: options?.method || 'GET',
        error,
      });
      throw error;
    }
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data?: any) {
    // Support passing query via endpoint like '/products/?q=abc'
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  async login(username: string, password: string) {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async getDashboardData() {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/dashboard/`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      // Backend wraps payload as { success, data }
      return data && data.data ? data.data : data;
    } catch (error) {
      console.error('Dashboard API error:', error);
      throw error;
    }
  }

  async getTodayStats() {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/sales/today-stats`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch today stats');
      }

      const data = await response.json();
      const payload = data && data.data ? data.data : data;
      // Map to { sales, transactions } expected by DashboardScreen
      return {
        sales: payload.today_sales ?? 0,
        transactions: payload.today_transactions ?? 0,
      };
    } catch (error) {
      console.error('Today stats API error:', error);
      throw error;
    }
  }

  async getWeeklyStats() {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/sales/weekly-stats`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch weekly stats');
      }

      const data = await response.json();
      return data && data.data ? data.data : data;
    } catch (error) {
      console.error('Weekly stats API error:', error);
      throw error;
    }
  }

  async getWeeklyRevenue() {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/sales/weekly-revenue`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch weekly revenue');
      }

      const data = await response.json();
      return data && data.data ? data.data : data;
    } catch (error) {
      console.error('Weekly revenue API error:', error);
      throw error;
    }
  }


  async getProducts() {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/products/`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const raw = await response.json();
      const payload = raw && raw.data ? raw.data : raw;
      // Map backend product -> UI expected shape on SalesScreen
      return (payload || []).map((p: any) => ({
        item_id: p.id ?? p._id ?? String(p.barcode || ''),
        sku: p.sku || '',
        barcode: p.barcode,
        product_name: p.name ?? p.product_name ?? '',
        brand: p.brand || '',
        category: p.category || '',
        selling_price: typeof p.price === 'number' ? p.price : Number(p.price || 0),
        current_stock: p.stockQuantity ?? p.current_stock ?? 0,
        stock_status: (p.stockQuantity ?? 0) > 0 ? 'In Stock' : 'Out of Stock',
        is_low_stock: p.isLowStock ?? p.is_low_stock ?? false,
        profit_margin: (typeof p.costPrice === 'number' && typeof p.price === 'number' && p.price > 0)
          ? ((p.price - p.costPrice) / p.price) * 100
          : 0,
        is_featured: Boolean(p.is_featured),
      }));
    } catch (error) {
      console.error('Products API error:', error);
      throw error;
    }
  }

  async scanProduct(barcode: string) {
    try {
      // Check network connectivity first
      const isConnected = await this.checkNetworkConnectivity();

      if (isConnected) {
        try {
          // Try to get product from API first (POST /api/products/scan)
          const base = await this.getBaseUrl();
          const response = await fetch(`${base}/api/products/scan`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ barcode }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.success && data.product) {
              const backendProduct = data.product;
              const normalized = {
                id: backendProduct.id,
                barcode: backendProduct.barcode,
                name: backendProduct.name,
                price: Number(backendProduct.price),
                // add fields used by cart/database code paths
                product_name: backendProduct.name,
                selling_price: Number(backendProduct.price),
                stock_quantity: backendProduct.stockQuantity,
                is_low_stock: backendProduct.isLowStock,
              };
              // Cache the product locally for future offline use
              const { databaseService } = await import('./database');
              try {
                await databaseService.initialize();
                await databaseService.saveProducts([
                  {
                    id: normalized.id,
                    barcode: normalized.barcode,
                    product_name: normalized.name,
                    selling_price: normalized.price,
                    current_stock: normalized.stock_quantity,
                    minimum_stock_level: 0,
                    is_active: true,
                    category: '',
                    brand: '',
                  },
                ]);
              } catch (cacheError) {
                console.error('Failed to cache product locally:', cacheError);
              }
              return normalized;
            }
          }
        } catch (apiError) {
          console.log('API call failed, falling back to local database:', apiError);
        }
      }

      // Fall back to local database (online or offline)
       console.log('Scanning product from local database...');
       const { databaseService } = await import('./database');
       try {
         // Check if database is already initialized
         if (!databaseService.isInitialized()) {
           console.log('Database not initialized, initializing...');
           await databaseService.initialize();
         }

         console.log('Database initialized, checking validity...');
         const db = databaseService.getDatabase();
         if (!db) {
           throw new Error('Database object is null after initialization');
         }
       } catch (dbError) {
         console.error('Database initialization failed:', dbError);
         console.error('Database error details:', {
           message: dbError instanceof Error ? dbError.message : 'Unknown error',
           type: typeof dbError,
           stack: dbError instanceof Error ? dbError.stack : 'No stack trace',
           database_initialized: databaseService.isInitialized(),
           database_object: !!databaseService.getDatabase()
         });

         // Provide more specific error messages based on the database error
         if (dbError instanceof Error) {
           if (dbError.message.includes('SQLite not available')) {
             throw new Error('OFFLINE_MODE: Database system not available. Please check if SQLite is properly installed and restart the app.');
           } else if (dbError.message.includes('database object is null')) {
             throw new Error('OFFLINE_MODE: Database connection failed. Please restart the app and try again.');
           } else {
             throw new Error(`OFFLINE_MODE: ${dbError.message}`);
           }
         } else {
           throw new Error('OFFLINE_MODE: Unknown database error occurred. Please restart the app.');
         }
       }

      const localProduct = await databaseService.getProductByBarcode(barcode);

      if (localProduct) {
        console.log('Product found in local database:', localProduct.product_name);
        return {
          id: localProduct.id,
          barcode: localProduct.barcode,
          name: localProduct.product_name,
          price: localProduct.selling_price,
          stock_quantity: localProduct.current_stock,
          is_low_stock: localProduct.current_stock <= (localProduct.minimum_stock_level || 0),
          // Include other necessary fields for compatibility
          product_name: localProduct.product_name,
          selling_price: localProduct.selling_price,
          current_stock: localProduct.current_stock,
          minimum_stock_level: localProduct.minimum_stock_level,
          is_active: localProduct.is_active,
          category: localProduct.category,
          brand: localProduct.brand
        };
      }

      // Product not found anywhere
      throw new Error('Product not found');
    } catch (error) {
      console.error('Product scan error:', error);
      throw error;
    }
  }

  private async checkNetworkConnectivity(): Promise<boolean> {
    try {
      // Try to fetch the health check endpoint from the backend to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/health`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('Network connectivity check failed:', error);
      return false;
    }
  }

  // Offline receipt and sales functionality
  async processOfflinePayment(cartItems: any[], total: number, paymentMethod: string) {
    try {
      const isConnected = await this.checkNetworkConnectivity();

      if (isConnected) {
        // Try to process online first
        try {
          return await this.processPayment(cartItems, total, paymentMethod);
        } catch (onlineError) {
          console.log('Online payment failed, saving for offline sync:', onlineError);
        }
      }

      // Process offline sale
       console.log('Processing offline sale...');
       let saleId: string;
       let receipt: any;

       try {
         saleId = await this.saveOfflineSale(cartItems, total, paymentMethod);
         receipt = await this.generateOfflineReceipt(saleId, cartItems, total, paymentMethod);
       } catch (saleError) {
         console.error('Error processing offline sale:', saleError);
         throw saleError;
       }

      return {
        success: true,
        offline: true,
        sale_id: saleId,
        receipt: receipt,
        message: 'Sale completed offline. Will sync when connection is restored.'
      };
    } catch (error) {
      console.error('Offline payment processing error:', error);
      throw error;
    }
  }

  private async saveOfflineSale(cartItems: any[], total: number, paymentMethod: string): Promise<string> {
    try {
      const { databaseService } = await import('./database');
      try {
        await databaseService.initialize();
      } catch (dbError) {
        console.error('Database initialization failed in saveOfflineSale:', dbError);
        console.error('Database error details:', {
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
          type: typeof dbError
        });

        if (dbError instanceof Error) {
          if (dbError.message.includes('SQLite not available')) {
            throw new Error('OFFLINE_MODE: Database system not available. Please check if SQLite is properly installed.');
          } else if (dbError.message.includes('database not available')) {
            throw new Error('OFFLINE_MODE: Local database connection failed. Please restart the app.');
          } else {
            throw new Error(`OFFLINE_MODE: ${dbError.message}`);
          }
        } else {
          throw new Error('OFFLINE_MODE: Unknown database error occurred. Please restart the app.');
        }
      }

      const saleId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save sale to offline queue
      await databaseService.queueSale({
        items: JSON.stringify(cartItems),
        total_amount: total,
        payment_method: paymentMethod
      });

      // Save scanned items for tracking
      for (const item of cartItems) {
        await databaseService.saveScannedItem({
          product_id: item.product.id,
          product_barcode: item.product.barcode,
          product_name: item.product.name || item.product.product_name,
          selling_price: item.product.price || item.product.selling_price,
          quantity: item.quantity
        });
      }

      console.log('Offline sale saved with ID:', saleId);
      return saleId;
    } catch (error) {
      console.error('Error saving offline sale:', error);
      throw error;
    }
  }

  private async generateOfflineReceipt(saleId: string, cartItems: any[], total: number, paymentMethod: string) {
    try {
      const { databaseService } = await import('./database');
      try {
        await databaseService.initialize();
      } catch (dbError) {
        console.error('Database initialization failed in generateOfflineReceipt:', dbError);
        console.error('Database error details:', {
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
          type: typeof dbError
        });

        if (dbError instanceof Error) {
          if (dbError.message.includes('SQLite not available')) {
            throw new Error('OFFLINE_MODE: Database system not available. Please check if SQLite is properly installed.');
          } else if (dbError.message.includes('database not available')) {
            throw new Error('OFFLINE_MODE: Local database connection failed. Please restart the app.');
          } else {
            throw new Error(`OFFLINE_MODE: ${dbError.message}`);
          }
        } else {
          throw new Error('OFFLINE_MODE: Unknown database error occurred. Please restart the app.');
        }
      }

      // Calculate tax (assuming 15% tax rate - should be configurable)
      const taxRate = 0.15;
      const subtotal = total / (1 + taxRate);
      const taxAmount = total - subtotal;

      const receiptData = {
        sale_id: saleId,
        timestamp: new Date().toISOString(),
        items: cartItems,
        subtotal: subtotal,
        tax: taxAmount,
        total: total,
        payment_method: paymentMethod,
        status: 'offline'
      };

      // Save receipt to database
      await databaseService.saveOfflineReceipt({
        sale_id: saleId,
        receipt_data: JSON.stringify(receiptData),
        items: JSON.stringify(cartItems),
        total_amount: total,
        subtotal_amount: subtotal,
        tax_amount: taxAmount,
        tax_breakdown: JSON.stringify({ rate: taxRate, amount: taxAmount }),
        payment_method: paymentMethod
      });

      console.log('Offline receipt generated for sale:', saleId);
      return receiptData;
    } catch (error) {
      console.error('Error generating offline receipt:', error);
      throw error;
    }
  }

  async getOfflineReceipts(): Promise<any[]> {
    try {
      const { databaseService } = await import('./database');
      try {
        await databaseService.initialize();
      } catch (dbError) {
        console.error('Database initialization failed in getOfflineReceipts:', dbError);
        console.error('Database error details:', {
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
          type: typeof dbError
        });
        return []; // Return empty array if database fails
      }

      const receipts = await databaseService.getPendingReceipts();
      return receipts.map(receipt => ({
        id: receipt.id,
        sale_id: receipt.sale_id,
        receipt_data: JSON.parse(receipt.receipt_data),
        total_amount: receipt.total_amount,
        payment_method: receipt.payment_method,
        created_at: receipt.created_at,
        status: receipt.status
      }));
    } catch (error) {
      console.error('Error getting offline receipts:', error);
      return [];
    }
  }

  async syncOfflineData(): Promise<void> {
    try {
      // Use the existing sync service for comprehensive syncing
      const { syncService } = await import('./syncService');
      const result = await syncService.performFullSync();

      if (result.success) {
        console.log(`Sync completed: ${result.syncedSales} sales, ${result.syncedProducts} products`);
      } else {
        console.log('Sync completed with errors:', result.errors);
      }

      return;
    } catch (error) {
      console.error('Error during offline data sync:', error);
      throw error;
    }
  }

  // Get current sync status
  async getSyncStatus() {
    try {
      const { syncService } = await import('./syncService');
      return await syncService.getSyncStatus();
    } catch (error) {
      console.error('Error getting sync status:', error);
      return null;
    }
  }

  // Check if device is online (synchronous version for quick checks)
  async isOnline(): Promise<boolean> {
    try {
      const isConnected = await this.checkNetworkConnectivity();
      return isConnected;
    } catch (error) {
      console.error('Error checking online status:', error);
      return false;
    }
  }

  // Tax management functions
  async getTaxes() {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/taxes/`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch taxes');
      }

      const data = await response.json();
      return data && data.data ? data.data : data;
    } catch (error) {
      console.error('Taxes API error:', error);
      throw error;
    }
  }

  async createTax(taxData: any) {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/taxes/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taxData),
      });

      if (!response.ok) {
        throw new Error('Failed to create tax');
      }

      const data = await response.json();
      return data && data.data ? data.data : data;
    } catch (error) {
      console.error('Create tax API error:', error);
      throw error;
    }
  }

  async updateTax(taxId: number, taxData: any) {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/taxes/${taxId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taxData),
      });

      if (!response.ok) {
        throw new Error('Failed to update tax');
      }

      const data = await response.json();
      return data && data.data ? data.data : data;
    } catch (error) {
      console.error('Update tax API error:', error);
      throw error;
    }
  }

  async deleteTax(taxId: number) {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/taxes/${taxId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete tax');
      }
    } catch (error) {
      console.error('Delete tax API error:', error);
      throw error;
    }
  }

  // Sales reports functions
  async getSalesReports() {
    try {
      const base = await this.getBaseUrl();
      const response = await fetch(`${base}/api/sales-reports/`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sales reports');
      }

      const reports = await response.json();
      // Transform to a list compatible with SalesScreen FlatList
      const period = reports.period || 'daily';
      const startDate = reports.startDate || new Date().toISOString();
      const summary = reports.summary || { totalSales: 0, totalTransactions: 0, totalProfit: 0, profitMargin: 0 };
      return [
        {
          id: 1,
          period,
          period_start: startDate,
          total_sales: summary.totalSales || 0,
          total_transactions: summary.totalTransactions || 0,
          total_profit: summary.totalProfit || 0,
          profit_margin: summary.profitMargin || 0,
        },
      ];
    } catch (error) {
      console.error('Sales reports API error:', error);
      throw error;
    }
  }

  async processPayment(cartItems: any[], total: number, paymentMethod: string) {
    try {
      const saleData = {
        total_amount: total,
        payment_method: paymentMethod,
        items: cartItems.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
        })),
      };

      const response = await fetch(`${API_BASE_URL}/api/sales/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saleData),
      });

      if (!response.ok) {
        throw new Error('Payment processing failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Payment processing error:', error);
      throw error;
    }
  }



  async initializeWebSocket(storeId: string) {
    try {
      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/pos/${storeId}/`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;

        // No authentication required for development
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect(storeId);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('WebSocket initialization error:', error);
    }
  }

  private attemptReconnect(storeId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.initializeWebSocket(storeId);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'inventory_updated':
        // Handle inventory updates from other devices
        console.log('Inventory updated:', data);
        break;
      case 'sale_completed':
        // Handle sales from other devices
        console.log('Sale completed:', data);
        break;
      case 'product_found':
        // Handle product scan responses
        console.log('Product found:', data.product);
        break;
      default:
        console.log('Unknown WebSocket message:', data);
    }
  }

  sendWebSocketMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const apiService = new ApiService();
export const api = apiService;

// Convenience functions
export const loginUser = (username: string, password: string) =>
  apiService.login(username, password);

export const getDashboardData = () => apiService.getDashboardData();
export const getTodayStats = () => apiService.getTodayStats();
export const getWeeklyStats = () => apiService.getWeeklyStats();
export const getWeeklyRevenue = () => apiService.getWeeklyRevenue();
export const getProducts = () => apiService.getProducts();
export const scanProduct = (barcode: string) => apiService.scanProduct(barcode);

export const getTaxes = () => apiService.getTaxes();
export const createTax = (taxData: any) => apiService.createTax(taxData);
export const updateTax = (taxId: number, taxData: any) => apiService.updateTax(taxId, taxData);
export const deleteTax = (taxId: number) => apiService.deleteTax(taxId);
export const getSalesReports = () => apiService.getSalesReports();
export const processPayment = (cartItems: any[], total: number, paymentMethod: string) =>
  apiService.processPayment(cartItems, total, paymentMethod);


export const initializeWebSocket = async (storeId: string) =>
  apiService.initializeWebSocket(storeId);

export const sendWebSocketMessage = (message: any) =>
  apiService.sendWebSocketMessage(message);

export const disconnectWebSocket = () => apiService.disconnectWebSocket();

// Offline functionality exports
export const processOfflinePayment = (cartItems: any[], total: number, paymentMethod: string) =>
  apiService.processOfflinePayment(cartItems, total, paymentMethod);

export const getOfflineReceipts = () => apiService.getOfflineReceipts();
export const syncOfflineData = () => apiService.syncOfflineData();

// Product management (backend)
export async function createProduct(productData: {
  barcode: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stockQuantity?: number;
  minimumStockLevel?: number;
}) {
  const base = await apiService.getBaseUrl();
  const res = await fetch(`${base}/api/products/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Create product failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data && data.data ? data.data : data;
}