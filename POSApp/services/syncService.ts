import NetInfo from '@react-native-community/netinfo';
import { databaseService, Product, OfflineSale } from './database';
import { api } from './api';

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingSalesCount: number;
  pendingScannedItemsCount: number;
  pendingReceiptsCount: number;
  isSyncing: boolean;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  syncedSales: number;
  syncedProducts: number;
  errors: string[];
}

class SyncService {
  private isOnline: boolean = false;
  private syncInProgress: boolean = false;
  private syncListeners: ((status: SyncStatus) => void)[] = [];

  constructor() {
    this.initializeNetworkMonitoring();
  }

  private initializeNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        // Just came online - trigger sync
        this.performFullSync();
      }

      this.notifyListeners();
    });
  }

  private notifyListeners() {
    this.getSyncStatus().then(status => {
      this.syncListeners.forEach(listener => listener(status));
    });
  }

  public addSyncListener(listener: (status: SyncStatus) => void) {
    this.syncListeners.push(listener);
  }

  public removeSyncListener(listener: (status: SyncStatus) => void) {
    const index = this.syncListeners.indexOf(listener);
    if (index > -1) {
      this.syncListeners.splice(index, 1);
    }
  }

  public async getSyncStatus(): Promise<SyncStatus> {
    try {
      const pendingSalesCount = (await databaseService.getPendingSales()).length;
      const pendingScannedItemsCount = (await databaseService.getPendingScannedItems()).length;
      const pendingReceiptsCount = (await databaseService.getPendingReceipts()).length;
      const lastSyncTime = await databaseService.getLastSyncTime('products');

      return {
        isOnline: this.isOnline,
        lastSyncTime,
        pendingSalesCount,
        pendingScannedItemsCount,
        pendingReceiptsCount,
        isSyncing: this.syncInProgress,
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        isOnline: this.isOnline,
        lastSyncTime: null,
        pendingSalesCount: 0,
        pendingScannedItemsCount: 0,
        pendingReceiptsCount: 0,
        isSyncing: this.syncInProgress,
        error: 'Failed to get sync status',
      };
    }
  }

  public async performFullSync(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      return {
        success: false,
        syncedSales: 0,
        syncedProducts: 0,
        errors: ['Sync already in progress or device offline'],
      };
    }

    this.syncInProgress = true;
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      syncedSales: 0,
      syncedProducts: 0,
      errors: [],
    };

    try {
      // Sync pending sales first
      const salesResult = await this.syncPendingSales();
      result.syncedSales = salesResult.syncedCount;
      result.errors.push(...salesResult.errors);

      // Sync scanned items
      const scannedItemsResult = await this.syncScannedItems();
      result.syncedProducts = scannedItemsResult.syncedCount; // Reuse for scanned items
      result.errors.push(...scannedItemsResult.errors);

      // Sync offline receipts
      const receiptsResult = await this.syncOfflineReceipts();
      result.syncedSales = receiptsResult.syncedCount; // Reuse for receipts
      result.errors.push(...receiptsResult.errors);

      // Sync product catalog
      const productsResult = await this.syncProductCatalog();
      result.syncedProducts += productsResult.syncedCount;
      result.errors.push(...productsResult.errors);

      if (salesResult.errors.length > 0 || productsResult.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      console.error('Full sync error:', error);
      result.success = false;
      result.errors.push('Unexpected sync error occurred');
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }

    return result;
  }

  private async syncPendingSales(): Promise<{ syncedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      const pendingSales = await databaseService.getPendingSales();

      for (const sale of pendingSales) {
        try {
          // Convert sale items back to proper format
          const saleItems = JSON.parse(sale.items);

          // Send sale to backend
          await api.post('/api/sales/', {
            items: saleItems,
            total_amount: sale.total_amount,
            payment_method: sale.payment_method,
            created_at: sale.created_at,
          });

          // Mark as synced in local database
          await databaseService.markSaleAsSynced(sale.id!);
          syncedCount++;

        } catch (error) {
          console.error(`Error syncing sale ${sale.id}:`, error);
          errors.push(`Failed to sync sale ${sale.id}`);
        }
      }
    } catch (error) {
      console.error('Error in syncPendingSales:', error);
      errors.push('Failed to retrieve pending sales');
    }

    return { syncedCount, errors };
  }

  private async syncScannedItems(): Promise<{ syncedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      const pendingItems = await databaseService.getPendingScannedItems();

      for (const item of pendingItems) {
        try {
          // Try to sync the scanned item to backend inventory
          await api.post('/api/inventory/scan/', {
            product_id: item.product_id,
            barcode: item.product_barcode,
            quantity: item.quantity,
            scanned_at: item.scanned_at,
          });

          // Mark as synced in local database
          await databaseService.markScannedItemAsSynced(item.id!);
          syncedCount++;

        } catch (error) {
          console.error(`Error syncing scanned item ${item.id}:`, error);
          errors.push(`Failed to sync scanned item ${item.product_name}`);
        }
      }
    } catch (error) {
      console.error('Error in syncScannedItems:', error);
      errors.push('Failed to retrieve pending scanned items');
    }

    return { syncedCount, errors };
  }

  private async syncOfflineReceipts(): Promise<{ syncedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      const pendingReceipts = await databaseService.getPendingReceipts();

      for (const receipt of pendingReceipts) {
        try {
          // Parse receipt data
          const receiptData = JSON.parse(receipt.receipt_data);

          // Send receipt to backend
          await api.post('/api/receipts/', {
            sale_id: receipt.sale_id,
            receipt_data: receiptData,
            items: JSON.parse(receipt.items),
            total_amount: receipt.total_amount,
            subtotal_amount: receipt.subtotal_amount,
            tax_amount: receipt.tax_amount,
            tax_breakdown: receipt.tax_breakdown ? JSON.parse(receipt.tax_breakdown) : [],
            payment_method: receipt.payment_method,
            created_at: receipt.created_at,
          });

          // Mark as synced in local database
          await databaseService.markReceiptAsSynced(receipt.id!);
          syncedCount++;

        } catch (error) {
          console.error(`Error syncing receipt ${receipt.id}:`, error);
          errors.push(`Failed to sync receipt ${receipt.sale_id}`);
        }
      }
    } catch (error) {
      console.error('Error in syncOfflineReceipts:', error);
      errors.push('Failed to retrieve pending receipts');
    }

    return { syncedCount, errors };
  }

  private async syncProductCatalog(): Promise<{ syncedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      // Get last sync time for delta sync
      const lastSyncTime = await databaseService.getLastSyncTime('products');

      // Fetch updated products from backend
      // Use api helper to fetch mapped products
      const products = await api.getProducts();

      if (products.length > 0) {
        // Save products to local database
        await databaseService.saveProducts(products);
        syncedCount = products.length;
      }

    } catch (error) {
      console.error('Error syncing product catalog:', error);
      errors.push('Failed to sync product catalog');
    }

    return { syncedCount, errors };
  }

  public async forceSyncProducts(): Promise<SyncResult> {
    if (!this.isOnline) {
      return {
        success: false,
        syncedSales: 0,
        syncedProducts: 0,
        errors: ['Device is offline'],
      };
    }

    this.syncInProgress = true;
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      syncedSales: 0,
      syncedProducts: 0,
      errors: [],
    };

    try {
      const productsResult = await this.syncProductCatalog();
      result.syncedProducts = productsResult.syncedCount;
      result.errors = productsResult.errors;

      if (productsResult.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      console.error('Force product sync error:', error);
      result.success = false;
      result.errors.push('Unexpected error during product sync');
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }

    return result;
  }

  public async forceSyncSales(): Promise<SyncResult> {
    if (!this.isOnline) {
      return {
        success: false,
        syncedSales: 0,
        syncedProducts: 0,
        errors: ['Device is offline'],
      };
    }

    this.syncInProgress = true;
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      syncedSales: 0,
      syncedProducts: 0,
      errors: [],
    };

    try {
      const salesResult = await this.syncPendingSales();
      result.syncedSales = salesResult.syncedCount;
      result.errors = salesResult.errors;

      if (salesResult.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      console.error('Force sales sync error:', error);
      result.success = false;
      result.errors.push('Unexpected error during sales sync');
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }

    return result;
  }

  public async clearSyncErrors(): Promise<void> {
    try {
      // Clear any failed sync states
      await databaseService.updateSyncStatus('products', 0);
      this.notifyListeners();
    } catch (error) {
      console.error('Error clearing sync errors:', error);
    }
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }
}

export const syncService = new SyncService();

// Auto-sync when app becomes active (in a real app, you'd listen to app state changes)
export const initializeAutoSync = () => {
  // This would typically be called from the main app component
  // and would listen to app state changes to trigger sync when app becomes active
  console.log('Auto-sync initialized');
};