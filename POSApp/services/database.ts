import SQLite from 'react-native-sqlite-storage';

// Guard plugin calls for environments like Expo Go where the native module isn't present
try {
  if ((SQLite as any)?.DEBUG) {
    SQLite.DEBUG(true);
  }
  if ((SQLite as any)?.enablePromise) {
    SQLite.enablePromise(true);
  }
} catch {
  // noop
}

export interface Product {
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
}

export interface OfflineSale {
  id?: number;
  items: string; // JSON string of cart items
  total_amount: number;
  payment_method: string;
  status: 'pending' | 'synced';
  created_at: string;
  synced_at?: string;
}

export interface OfflineReceipt {
  id?: number;
  sale_id: string; // Local sale ID for reference
  receipt_data: string; // JSON string of complete receipt data
  items: string; // JSON string of cart items
  total_amount: number;
  subtotal_amount: number;
  tax_amount: number;
  tax_breakdown: string; // JSON string of tax details
  payment_method: string;
  status: 'pending' | 'synced' | 'printed';
  created_at: string;
  synced_at?: string;
  printed_at?: string;
}

export interface ScannedItem {
  id?: number;
  product_id: number;
  product_barcode: string;
  product_name: string;
  selling_price: number;
  quantity: number;
  scanned_at: string;
  status: 'pending' | 'synced';
  synced_at?: string;
}

class DatabaseService {
  private database: SQLite.SQLiteDatabase | null = null;
  private disabled: boolean = false;

  async initialize(): Promise<void> {
    try {
      // Ensure SQLite is ready
      if (!SQLite || typeof (SQLite as any).openDatabase !== 'function') {
        console.warn('SQLite plugin not available. Running in NO-DB mode (Expo Go).');
        this.disabled = true;
        return;
      }

      console.log('Opening database...');

      // Ensure SQLite is properly initialized
      if (SQLite.DEBUG) {
        SQLite.DEBUG(true);
      }
      if (SQLite.enablePromise) {
        SQLite.enablePromise(true);
      }

      this.database = await SQLite.openDatabase({
        name: 'MobilePOS.db',
        location: 'default',
      });

      if (!this.database) {
        throw new Error('Failed to open database - database object is null');
      }

      console.log('Database opened successfully, creating tables...');
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        sqlite_available: !!SQLite,
        sqlite_version: SQLite ? 'SQLite available' : 'SQLite not available',
        database_before: !!this.database,
        error_type: typeof error,
        error_constructor: error?.constructor?.name
      });

      // Fall back to disabled/no-op mode to avoid crashes in Expo Go
      this.disabled = true;
      this.database = null;
      console.warn('Database disabled; continuing without local persistence.');
    }
  }

  private async createTables(): Promise<void> {
    if (!this.database) {
      console.error('Database object is null during createTables');
      throw new Error('Database not initialized - database object is null');
    }

    console.log('Creating database tables...');
    const queries = [
      // Products table for offline caching
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        item_id TEXT,
        sku TEXT,
        barcode TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        brand TEXT,
        product_line TEXT,
        variant TEXT,
        category TEXT,
        subcategory TEXT,
        description TEXT,
        features TEXT,
        cost_price REAL,
        selling_price REAL NOT NULL,
        wholesale_price REAL,
        retail_price REAL,
        current_stock INTEGER DEFAULT 0,
        minimum_stock_level INTEGER,
        reorder_quantity INTEGER,
        size TEXT,
        unit_of_measure TEXT,
        weight REAL,
        weight_unit TEXT,
        dimensions TEXT,
        color TEXT,
        material TEXT,
        tags TEXT,
        collection TEXT,
        region_code TEXT,
        region_specific_id TEXT,
        display_name TEXT,
        is_new INTEGER DEFAULT 0,
        is_featured INTEGER DEFAULT 0,
        image_urls TEXT,
        thumbnail_url TEXT,
        supplier_id TEXT,
        supplier_name TEXT,
        supplier_code TEXT,
        location TEXT,
        expiry_date TEXT,
        batch_number TEXT,
        is_active INTEGER DEFAULT 1,
        date_created TEXT NOT NULL,
        date_modified TEXT NOT NULL
      )`,

      // Offline sales queue
      `CREATE TABLE IF NOT EXISTS offline_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        items TEXT NOT NULL,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        synced_at TEXT
      )`,

      // Scanned items for offline support
      `CREATE TABLE IF NOT EXISTS scanned_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        product_barcode TEXT NOT NULL,
        product_name TEXT NOT NULL,
        selling_price REAL NOT NULL,
        quantity INTEGER DEFAULT 1,
        scanned_at TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        synced_at TEXT
      )`,

      // Offline receipts for offline printing support
      `CREATE TABLE IF NOT EXISTS offline_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id TEXT NOT NULL,
        receipt_data TEXT NOT NULL,
        items TEXT NOT NULL,
        total_amount REAL NOT NULL,
        subtotal_amount REAL NOT NULL,
        tax_amount REAL NOT NULL,
        tax_breakdown TEXT,
        payment_method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        synced_at TEXT,
        printed_at TEXT
      )`,

      // Sync status tracking
      `CREATE TABLE IF NOT EXISTS sync_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        last_sync_at TEXT,
        record_count INTEGER DEFAULT 0
      )`,
    ];

    for (const query of queries) {
      try {
        await this.database.executeSql(query);
        console.log('Executed query successfully');
      } catch (queryError) {
        console.error('Error executing query:', query, queryError);
        throw queryError;
      }
    }

    // Initialize sync status records
    await this.initializeSyncStatus();
  }

  private async initializeSyncStatus(): Promise<void> {
    if (!this.database) return;

    const tables = ['products', 'offline_sales', 'scanned_items', 'offline_receipts'];

    for (const table of tables) {
      await this.database.executeSql(
        `INSERT OR IGNORE INTO sync_status (table_name) VALUES (?)`,
        [table]
      );
    }
  }

  // Product operations
  async saveProducts(products: Product[]): Promise<void> {
    if (this.disabled) return;
    if (!this.database) {
      console.error('Database object is null in saveProducts');
      return;
    }

    for (const product of products) {
      await this.database.executeSql(
       `INSERT OR REPLACE INTO products
        (id, item_id, sku, barcode, product_name, brand, product_line, variant, category, subcategory, description, features,
         cost_price, selling_price, wholesale_price, retail_price, current_stock, minimum_stock_level, reorder_quantity,
         size, unit_of_measure, weight, weight_unit, dimensions, color, material, tags, collection, region_code, region_specific_id,
         display_name, is_new, is_featured, image_urls, thumbnail_url, supplier_id, supplier_name, supplier_code, location,
         expiry_date, batch_number, is_active, date_created, date_modified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id,
        product.item_id || '',
        product.sku || '',
        product.barcode,
        product.product_name,
        product.brand || '',
        product.product_line || '',
        product.variant || '',
        product.category || '',
        product.subcategory || '',
        product.description || '',
        product.features ? JSON.stringify(product.features) : '',
        product.cost_price || 0,
        product.selling_price,
        product.wholesale_price || 0,
        product.retail_price || 0,
        product.current_stock,
        product.minimum_stock_level || 0,
        product.reorder_quantity || 0,
        product.size || '',
        product.unit_of_measure || '',
        product.weight || 0,
        product.weight_unit || '',
        product.dimensions || '',
        product.color || '',
        product.material || '',
        product.tags ? JSON.stringify(product.tags) : '',
        product.collection || '',
        product.region_code || '',
        product.region_specific_id || '',
        product.display_name || '',
        product.is_new ? 1 : 0,
        product.is_featured ? 1 : 0,
        product.image_urls ? JSON.stringify(product.image_urls) : '',
        product.thumbnail_url || '',
        product.supplier_id || '',
        product.supplier_name || '',
        product.supplier_code || '',
        product.location || '',
        product.expiry_date || '',
        product.batch_number || '',
        product.is_active ? 1 : 0,
        product.date_created,
        product.date_modified,
      ]
      );
    }

    await this.updateSyncStatus('products', products.length);
  }

  async getProductByBarcode(barcode: string): Promise<Product | null> {
    if (this.disabled) return null;
    if (!this.database) return null;

    try {
      const [results] = await this.database.executeSql(
        'SELECT * FROM products WHERE barcode = ? AND is_active = 1',
        [barcode]
      );

      if (results.rows.length > 0) {
        const item = results.rows.item(0);
        return {
          id: item.id,
          item_id: item.item_id,
          sku: item.sku,
          barcode: item.barcode,
          product_name: item.product_name,
          brand: item.brand,
          product_line: item.product_line,
          variant: item.variant,
          category: item.category,
          subcategory: item.subcategory,
          description: item.description,
          features: item.features ? JSON.parse(item.features) : [],
          cost_price: item.cost_price,
          selling_price: item.selling_price,
          wholesale_price: item.wholesale_price,
          retail_price: item.retail_price,
          current_stock: item.current_stock,
          minimum_stock_level: item.minimum_stock_level,
          reorder_quantity: item.reorder_quantity,
          size: item.size,
          unit_of_measure: item.unit_of_measure,
          weight: item.weight,
          weight_unit: item.weight_unit,
          dimensions: item.dimensions,
          color: item.color,
          material: item.material,
          tags: item.tags ? JSON.parse(item.tags) : [],
          collection: item.collection,
          region_code: item.region_code,
          region_specific_id: item.region_specific_id,
          display_name: item.display_name,
          is_new: item.is_new === 1,
          is_featured: item.is_featured === 1,
          image_urls: item.image_urls ? JSON.parse(item.image_urls) : [],
          thumbnail_url: item.thumbnail_url,
          supplier_id: item.supplier_id,
          supplier_name: item.supplier_name,
          supplier_code: item.supplier_code,
          location: item.location,
          expiry_date: item.expiry_date,
          batch_number: item.batch_number,
          is_active: item.is_active === 1,
          date_created: item.date_created,
          date_modified: item.date_modified,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting product by barcode:', error);
      return null;
    }
  }

  async getAllProducts(): Promise<Product[]> {
    if (this.disabled) return [];
    if (!this.database) return [];

    try {
      const [results] = await this.database.executeSql(
        'SELECT * FROM products WHERE is_active = 1 ORDER BY product_name'
      );

      const products: Product[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        products.push({
          id: item.id,
          item_id: item.item_id,
          sku: item.sku,
          barcode: item.barcode,
          product_name: item.product_name,
          brand: item.brand,
          product_line: item.product_line,
          variant: item.variant,
          category: item.category,
          subcategory: item.subcategory,
          description: item.description,
          features: item.features ? JSON.parse(item.features) : [],
          cost_price: item.cost_price,
          selling_price: item.selling_price,
          wholesale_price: item.wholesale_price,
          retail_price: item.retail_price,
          current_stock: item.current_stock,
          minimum_stock_level: item.minimum_stock_level,
          reorder_quantity: item.reorder_quantity,
          size: item.size,
          unit_of_measure: item.unit_of_measure,
          weight: item.weight,
          weight_unit: item.weight_unit,
          dimensions: item.dimensions,
          color: item.color,
          material: item.material,
          tags: item.tags ? JSON.parse(item.tags) : [],
          collection: item.collection,
          region_code: item.region_code,
          region_specific_id: item.region_specific_id,
          display_name: item.display_name,
          is_new: item.is_new === 1,
          is_featured: item.is_featured === 1,
          image_urls: item.image_urls ? JSON.parse(item.image_urls) : [],
          thumbnail_url: item.thumbnail_url,
          supplier_id: item.supplier_id,
          supplier_name: item.supplier_name,
          supplier_code: item.supplier_code,
          location: item.location,
          expiry_date: item.expiry_date,
          batch_number: item.batch_number,
          is_active: item.is_active === 1,
          date_created: item.date_created,
          date_modified: item.date_modified,
        });
      }

      return products;
    } catch (error) {
      console.error('Error getting all products:', error);
      return [];
    }
  }

  async searchProducts(query: string): Promise<Product[]> {
    if (this.disabled) return [];
    if (!this.database) return [];

    try {
      const [results] = await this.database.executeSql(
        `SELECT * FROM products
         WHERE (product_name LIKE ? OR barcode LIKE ? OR category LIKE ? OR brand LIKE ?)
         AND is_active = 1
         ORDER BY product_name`,
        [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
      );

      const products: Product[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        products.push({
          id: item.id,
          item_id: item.item_id,
          sku: item.sku,
          barcode: item.barcode,
          product_name: item.product_name,
          brand: item.brand,
          product_line: item.product_line,
          variant: item.variant,
          category: item.category,
          subcategory: item.subcategory,
          description: item.description,
          features: item.features ? JSON.parse(item.features) : [],
          cost_price: item.cost_price,
          selling_price: item.selling_price,
          wholesale_price: item.wholesale_price,
          retail_price: item.retail_price,
          current_stock: item.current_stock,
          minimum_stock_level: item.minimum_stock_level,
          reorder_quantity: item.reorder_quantity,
          size: item.size,
          unit_of_measure: item.unit_of_measure,
          weight: item.weight,
          weight_unit: item.weight_unit,
          dimensions: item.dimensions,
          color: item.color,
          material: item.material,
          tags: item.tags ? JSON.parse(item.tags) : [],
          collection: item.collection,
          region_code: item.region_code,
          region_specific_id: item.region_specific_id,
          display_name: item.display_name,
          is_new: item.is_new === 1,
          is_featured: item.is_featured === 1,
          image_urls: item.image_urls ? JSON.parse(item.image_urls) : [],
          thumbnail_url: item.thumbnail_url,
          supplier_id: item.supplier_id,
          supplier_name: item.supplier_name,
          supplier_code: item.supplier_code,
          location: item.location,
          expiry_date: item.expiry_date,
          batch_number: item.batch_number,
          is_active: item.is_active === 1,
          date_created: item.date_created,
          date_modified: item.date_modified,
        });
      }

      return products;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  // Offline sales operations
  async queueSale(saleData: Omit<OfflineSale, 'id' | 'status' | 'created_at'>): Promise<number> {
    if (this.disabled) return 0;
    if (!this.database) return 0;

    try {
      const result = await this.database.executeSql(
        `INSERT INTO offline_sales (items, total_amount, payment_method, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
        [saleData.items, saleData.total_amount, saleData.payment_method, new Date().toISOString()]
      );

      return result[0].insertId;
    } catch (error) {
      console.error('Error queuing sale:', error);
      throw error;
    }
  }

  async getPendingSales(): Promise<OfflineSale[]> {
    if (this.disabled) return [];
    if (!this.database) return [];

    try {
      const [results] = await this.database.executeSql(
        "SELECT * FROM offline_sales WHERE status = 'pending' ORDER BY created_at ASC"
      );

      const sales: OfflineSale[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        sales.push({
          id: item.id,
          items: item.items,
          total_amount: item.total_amount,
          payment_method: item.payment_method,
          status: item.status,
          created_at: item.created_at,
          synced_at: item.synced_at,
        });
      }

      return sales;
    } catch (error) {
      console.error('Error getting pending sales:', error);
      return [];
    }
  }

  async markSaleAsSynced(saleId: number): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    await this.database.executeSql(
      "UPDATE offline_sales SET status = 'synced', synced_at = ? WHERE id = ?",
      [new Date().toISOString(), saleId]
    );
  }

  // Scanned items operations for offline support
  async saveScannedItem(scannedItem: Omit<ScannedItem, 'id' | 'status' | 'scanned_at'>): Promise<number> {
    if (this.disabled) return 0;
    if (!this.database) return 0;

    try {
      const result = await this.database.executeSql(
        `INSERT INTO scanned_items (product_id, product_barcode, product_name, selling_price, quantity, scanned_at, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
          scannedItem.product_id,
          scannedItem.product_barcode,
          scannedItem.product_name,
          scannedItem.selling_price,
          scannedItem.quantity,
          new Date().toISOString()
        ]
      );

      return result[0].insertId;
    } catch (error) {
      console.error('Error saving scanned item:', error);
      throw error;
    }
  }

  async getPendingScannedItems(): Promise<ScannedItem[]> {
    if (this.disabled) return [];
    if (!this.database) return [];

    try {
      const [results] = await this.database.executeSql(
        "SELECT * FROM scanned_items WHERE status = 'pending' ORDER BY scanned_at ASC"
      );

      const items: ScannedItem[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        items.push({
          id: item.id,
          product_id: item.product_id,
          product_barcode: item.product_barcode,
          product_name: item.product_name,
          selling_price: item.selling_price,
          quantity: item.quantity,
          scanned_at: item.scanned_at,
          status: item.status,
          synced_at: item.synced_at,
        });
      }

      return items;
    } catch (error) {
      console.error('Error getting pending scanned items:', error);
      return [];
    }
  }

  async markScannedItemAsSynced(itemId: number): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    await this.database.executeSql(
      "UPDATE scanned_items SET status = 'synced', synced_at = ? WHERE id = ?",
      [new Date().toISOString(), itemId]
    );
  }

  async clearSyncedScannedItems(): Promise<void> {
    if (this.disabled) return;
    if (!this.database) return;

    await this.database.executeSql(
      "DELETE FROM scanned_items WHERE status = 'synced'"
    );
  }

  // Offline receipts operations
  async saveOfflineReceipt(receiptData: Omit<OfflineReceipt, 'id' | 'status' | 'created_at'>): Promise<number> {
    if (this.disabled) return 0;
    if (!this.database) return 0;

    try {
      const result = await this.database.executeSql(
        `INSERT INTO offline_receipts
         (sale_id, receipt_data, items, total_amount, subtotal_amount, tax_amount, tax_breakdown, payment_method, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          receiptData.sale_id,
          receiptData.receipt_data,
          receiptData.items,
          receiptData.total_amount,
          receiptData.subtotal_amount,
          receiptData.tax_amount,
          receiptData.tax_breakdown,
          receiptData.payment_method,
          new Date().toISOString()
        ]
      );

      return result[0].insertId;
    } catch (error) {
      console.error('Error saving offline receipt:', error);
      throw error;
    }
  }

  async getPendingReceipts(): Promise<OfflineReceipt[]> {
    if (this.disabled) return [];
    if (!this.database) return [];

    try {
      const [results] = await this.database.executeSql(
        "SELECT * FROM offline_receipts WHERE status = 'pending' ORDER BY created_at ASC"
      );

      const receipts: OfflineReceipt[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        receipts.push({
          id: item.id,
          sale_id: item.sale_id,
          receipt_data: item.receipt_data,
          items: item.items,
          total_amount: item.total_amount,
          subtotal_amount: item.subtotal_amount,
          tax_amount: item.tax_amount,
          tax_breakdown: item.tax_breakdown,
          payment_method: item.payment_method,
          status: item.status,
          created_at: item.created_at,
          synced_at: item.synced_at,
          printed_at: item.printed_at,
        });
      }

      return receipts;
    } catch (error) {
      console.error('Error getting pending receipts:', error);
      return [];
    }
  }

  async markReceiptAsPrinted(receiptId: number): Promise<void> {
    if (this.disabled) return;
    if (!this.database) return;

    await this.database.executeSql(
      "UPDATE offline_receipts SET status = 'printed', printed_at = ? WHERE id = ?",
      [new Date().toISOString(), receiptId]
    );
  }

  async markReceiptAsSynced(receiptId: number): Promise<void> {
    if (this.disabled) return;
    if (!this.database) return;

    await this.database.executeSql(
      "UPDATE offline_receipts SET status = 'synced', synced_at = ? WHERE id = ?",
      [new Date().toISOString(), receiptId]
    );
  }

  async getReceiptBySaleId(saleId: string): Promise<OfflineReceipt | null> {
    if (this.disabled) return null;
    if (!this.database) return null;

    try {
      const [results] = await this.database.executeSql(
        'SELECT * FROM offline_receipts WHERE sale_id = ?',
        [saleId]
      );

      if (results.rows.length > 0) {
        const item = results.rows.item(0);
        return {
          id: item.id,
          sale_id: item.sale_id,
          receipt_data: item.receipt_data,
          items: item.items,
          total_amount: item.total_amount,
          subtotal_amount: item.subtotal_amount,
          tax_amount: item.tax_amount,
          tax_breakdown: item.tax_breakdown,
          payment_method: item.payment_method,
          status: item.status,
          created_at: item.created_at,
          synced_at: item.synced_at,
          printed_at: item.printed_at,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting receipt by sale ID:', error);
      return null;
    }
  }

  // Sync status operations
  async updateSyncStatus(tableName: string, recordCount: number): Promise<void> {
    if (this.disabled) return;
    if (!this.database) return;

    await this.database.executeSql(
      `UPDATE sync_status SET last_sync_at = ?, record_count = ? WHERE table_name = ?`,
      [new Date().toISOString(), recordCount, tableName]
    );
  }

  async getLastSyncTime(tableName: string): Promise<string | null> {
    if (this.disabled) return null;
    if (!this.database) return null;

    try {
      const [results] = await this.database.executeSql(
        'SELECT last_sync_at FROM sync_status WHERE table_name = ?',
        [tableName]
      );

      if (results.rows.length > 0) {
        return results.rows.item(0).last_sync_at;
      }

      return null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    if (this.disabled) return;
    if (!this.database) return;

    const tables = ['products', 'offline_sales', 'scanned_items', 'offline_receipts', 'sync_status'];
    for (const table of tables) {
      await this.database.executeSql(`DELETE FROM ${table}`);
    }
  }

  async getDatabaseSize(): Promise<number> {
    if (this.disabled) return 0;
    if (!this.database) return 0;

    try {
      const [results] = await this.database.executeSql(
        "SELECT COUNT(*) as count FROM products WHERE is_active = 1"
      );
      return results.rows.item(0).count;
    } catch (error) {
      console.error('Error getting database size:', error);
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.database) {
      await this.database.close();
      this.database = null;
    }
  }

  // Check if database is properly initialized
  isInitialized(): boolean {
    return this.database !== null && !this.disabled;
  }

  // Get database instance (for debugging)
  getDatabase(): SQLite.SQLiteDatabase | null {
    return this.database;
  }
}

export const databaseService = new DatabaseService();

// Database initialization should be called explicitly by the application
// databaseService.initialize().catch(console.error);