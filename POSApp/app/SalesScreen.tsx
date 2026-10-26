import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getProducts, getSalesReports } from '../services/api';
import { databaseService, Product } from '../services/database';
import { webSocketService } from '../services/websocket';

interface SalesReport {
  id: number;
  total_amount: number;
  item_count: number;
  created_at: string;
  payment_method: string;
}

const SalesScreen = () => {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'reports'>('products');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    item_id: '',
    sku: '',
    barcode: '',
    product_name: '',
    brand: '',
    product_line: '',
    variant: '',
    category: '',
    subcategory: '',
    description: '',
    features: '',
    cost_price: '',
    selling_price: '',
    current_stock: '',
    minimum_stock_level: '',
    reorder_quantity: '',
    size: '',
    unit_of_measure: 'each',
    weight: '',
    tags: '',
    collection: '',
    region_code: 'A',
    region_specific_id: '',
    display_name: '',
    is_new: false,
    is_featured: false,
    image_urls: '',
    thumbnail_url: '',
    supplier_id: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    initializeDatabase();
    loadData();
  }, []);

  const initializeDatabase = async () => {
    try {
      await databaseService.initialize();
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load products from local database first, then try to sync from server
      const localProducts = await databaseService.getAllProducts();
      setProducts(localProducts);

      // Try to load products from server and cache locally
      try {
        const remoteProducts = await getProducts();
        if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
          // Map API items to local DB shape
          const mapped = remoteProducts.map((p: any) => ({
            id: p.item_id ? Number(p.item_id) : (p.id ?? Date.now()),
            item_id: p.item_id || String(p.id || p.barcode || ''),
            sku: p.sku || '',
            barcode: p.barcode,
            product_name: p.product_name,
            brand: p.brand || '',
            product_line: '',
            variant: '',
            category: p.category || '',
            subcategory: '',
            description: '',
            features: [],
            cost_price: 0,
            selling_price: p.selling_price,
            wholesale_price: 0,
            retail_price: 0,
            current_stock: p.current_stock ?? 0,
            minimum_stock_level: p.is_low_stock ? (p.current_stock ?? 0) : 5,
            reorder_quantity: 10,
            size: '',
            unit_of_measure: 'each',
            weight: undefined,
            weight_unit: undefined,
            dimensions: undefined,
            color: undefined,
            material: undefined,
            tags: [],
            collection: '',
            region_code: 'A',
            region_specific_id: '',
            display_name: p.product_name,
            is_new: false,
            is_featured: !!p.is_featured,
            image_urls: [],
            thumbnail_url: '',
            supplier_id: '',
            supplier_name: '',
            supplier_code: '',
            location: '',
            expiry_date: '',
            batch_number: '',
            is_active: true,
            date_created: new Date().toISOString(),
            date_modified: new Date().toISOString(),
          }));
          await databaseService.saveProducts(mapped);
          const refreshed = await databaseService.getAllProducts();
          setProducts(refreshed);
        }
      } catch (e) {
        console.log('Could not sync products from server');
      }

      // Try to load from server for reports (sales reports need backend)
      try {
        const reportsData = await getSalesReports();
        setSalesReports(Array.isArray(reportsData) ? reportsData : []);
      } catch (error) {
        console.log('Could not load sales reports from server');
      }

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const refreshFromServer = async () => {
    try {
      setRefreshing(true);
      const remoteProducts = await getProducts();
      if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
        const mapped = remoteProducts.map((p: any) => ({
          id: p.item_id ? Number(p.item_id) : (p.id ?? Date.now()),
          item_id: p.item_id || String(p.id || p.barcode || ''),
          sku: p.sku || '',
          barcode: p.barcode,
          product_name: p.product_name,
          brand: p.brand || '',
          product_line: '',
          variant: '',
          category: p.category || '',
          subcategory: '',
          description: '',
          features: [],
          cost_price: 0,
          selling_price: p.selling_price,
          wholesale_price: 0,
          retail_price: 0,
          current_stock: p.current_stock ?? 0,
          minimum_stock_level: p.is_low_stock ? (p.current_stock ?? 0) : 5,
          reorder_quantity: 10,
          size: '',
          unit_of_measure: 'each',
          weight: undefined,
          weight_unit: undefined,
          dimensions: undefined,
          color: undefined,
          material: undefined,
          tags: [],
          collection: '',
          region_code: 'A',
          region_specific_id: '',
          display_name: p.product_name,
          is_new: false,
          is_featured: !!p.is_featured,
          image_urls: [],
          thumbnail_url: '',
          supplier_id: '',
          supplier_name: '',
          supplier_code: '',
          location: '',
          expiry_date: '',
          batch_number: '',
          is_active: true,
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
        }));
        await databaseService.saveProducts(mapped);
      }
      const refreshed = await databaseService.getAllProducts();
      setProducts(refreshed);
      const reportsData = await getSalesReports();
      setSalesReports(Array.isArray(reportsData) ? reportsData : []);
    } catch (e) {
      Alert.alert('Refresh Failed', 'Could not load from server');
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleProductPress = (product: Product) => {
    Alert.alert(
      product.product_name,
      `Price: $${product.selling_price.toFixed(2)}\nStock: ${product.current_stock}\nBrand: ${product.brand || 'N/A'}\nCategory: ${product.category || 'N/A'}\nBarcode: ${product.barcode}`,
      [
        {
          text: 'Add to Cart',
          onPress: () => {
            router.push({
              pathname: '/CheckoutScreen',
              params: {
                productId: product.id.toString(),
                productName: product.product_name,
                productPrice: product.selling_price.toString(),
                barcode: product.barcode
              }
            });
          },
        },
        {
          text: 'Edit Product',
          onPress: () => {
            handleEditProduct(product);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      item_id: '',
      sku: '',
      barcode: '',
      product_name: '',
      brand: '',
      product_line: '',
      variant: '',
      category: '',
      subcategory: '',
      description: '',
      features: '',
      cost_price: '',
      selling_price: '',
      current_stock: '',
      minimum_stock_level: '',
      reorder_quantity: '',
      size: '',
      unit_of_measure: 'each',
      weight: '',
      tags: '',
      collection: '',
      region_code: 'A',
      region_specific_id: '',
      display_name: '',
      is_new: false,
      is_featured: false,
      image_urls: '',
      thumbnail_url: '',
      supplier_id: '',
    });
    setShowProductModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      item_id: product.item_id || '',
      sku: product.sku || '',
      barcode: product.barcode,
      product_name: product.product_name,
      brand: product.brand || '',
      product_line: product.product_line || '',
      variant: product.variant || '',
      category: product.category || '',
      subcategory: product.subcategory || '',
      description: product.description || '',
      features: product.features ? JSON.stringify(product.features) : '',
      cost_price: product.cost_price ? product.cost_price.toString() : '',
      selling_price: product.selling_price.toString(),
      current_stock: product.current_stock.toString(),
      minimum_stock_level: product.minimum_stock_level ? product.minimum_stock_level.toString() : '',
      reorder_quantity: product.reorder_quantity ? product.reorder_quantity.toString() : '',
      size: product.size || '',
      unit_of_measure: product.unit_of_measure || 'each',
      weight: product.weight ? product.weight.toString() : '',
      tags: product.tags ? JSON.stringify(product.tags) : '',
      collection: product.collection || '',
      region_code: product.region_code || 'A',
      region_specific_id: product.region_specific_id || '',
      display_name: product.display_name || '',
      is_new: product.is_new || false,
      is_featured: product.is_featured || false,
      image_urls: product.image_urls ? JSON.stringify(product.image_urls) : '',
      thumbnail_url: product.thumbnail_url || '',
      supplier_id: product.supplier_id || '',
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    // Validation
    if (!productForm.product_name || !productForm.barcode || !productForm.selling_price || !productForm.current_stock) {
      Alert.alert('Error', 'Please fill in all required fields (Product Name, Barcode, Selling Price, Current Stock)');
      return;
    }

    setFormLoading(true);
    try {
      const now = new Date().toISOString();
      const productData: Product = {
        id: editingProduct?.id || Date.now(), // Use timestamp as ID for new products
        item_id: productForm.item_id || `ITEM_${Date.now()}`,
        sku: productForm.sku || `SKU_${Date.now()}`,
        barcode: productForm.barcode,
        product_name: productForm.product_name,
        brand: productForm.brand || '',
        product_line: productForm.product_line || '',
        variant: productForm.variant || '',
        category: productForm.category || '',
        subcategory: productForm.subcategory || '',
        description: productForm.description || '',
        features: productForm.features ? JSON.parse(productForm.features) : [],
        cost_price: productForm.cost_price ? parseFloat(productForm.cost_price) : 0,
        selling_price: parseFloat(productForm.selling_price),
        current_stock: parseInt(productForm.current_stock),
        minimum_stock_level: productForm.minimum_stock_level ? parseInt(productForm.minimum_stock_level) : 5,
        reorder_quantity: productForm.reorder_quantity ? parseInt(productForm.reorder_quantity) : 10,
        size: productForm.size || '',
        unit_of_measure: productForm.unit_of_measure || 'each',
        weight: productForm.weight ? parseFloat(productForm.weight) : undefined,
        tags: productForm.tags ? JSON.parse(productForm.tags) : [],
        collection: productForm.collection || '',
        region_code: productForm.region_code || 'A',
        region_specific_id: productForm.region_specific_id || '',
        display_name: productForm.display_name || productForm.product_name,
        is_new: productForm.is_new || false,
        is_featured: productForm.is_featured || false,
        image_urls: productForm.image_urls ? JSON.parse(productForm.image_urls) : [],
        thumbnail_url: productForm.thumbnail_url || '',
        supplier_id: productForm.supplier_id || '',
        is_active: true,
        date_created: editingProduct?.date_created || now,
        date_modified: now,
      };

      // Save to local database
      await databaseService.saveProducts([productData]);

      // WebSocket functionality disabled - inventory updates handled via HTTP

      // Reload products
      await loadData();

      setShowProductModal(false);
      Alert.alert(
        'Success',
        editingProduct ? 'Product updated successfully' : 'Product added successfully'
      );
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', 'Failed to save product. Please check your input format.');
    } finally {
      setFormLoading(false);
    }
  };

  const generateBarcode = () => {
    // Generate a simple barcode for demo purposes
    const barcode = '123456789' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    setProductForm(prev => ({ ...prev, barcode }));
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => handleProductPress(item)}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.product_name}</Text>
        <Text style={styles.productBarcode}>{item.barcode}</Text>
        <Text style={styles.productBrand}>{item.brand || 'No Brand'}</Text>
        <Text style={styles.productPrice}>${Number(item.selling_price || 0).toFixed(2)}</Text>
      </View>
      <View style={styles.productStock}>
        <Text style={[
          styles.stockText,
          item.current_stock < (item.minimum_stock_level || 10) ? styles.lowStock : styles.normalStock
        ]}>
          Stock: {item.current_stock ?? 0}
        </Text>
        {item.category && (
          <Text style={styles.productCategory}>{item.category}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSalesReport = ({ item }: { item: SalesReport }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Text style={styles.paymentMethod}>{item.payment_method}</Text>
      </View>
      <View style={styles.reportDetails}>
        <Text style={styles.reportAmount}>${Number(item.total_amount || 0).toFixed(2)}</Text>
        <Text style={styles.reportItems}>{Number(item.item_count || 0)} items</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sales & Products</Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={refreshFromServer} style={styles.addButton}>
              <MaterialIcons name="refresh" size={24} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddProduct} style={styles.addButton}>
              <MaterialIcons name="add" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Products ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
            Sales Reports ({salesReports.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'products' ? (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inventory" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={salesReports}
          renderItem={renderSalesReport}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="receipt" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No sales reports found</Text>
            </View>
          }
        />
      )}

      {/* Product Management Modal */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProductModal(false)}>
              <MaterialIcons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </Text>
            <View style={{ padding: 8 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Product Name *</Text>
                <TextInput
                  style={styles.input}
                  value={productForm.product_name}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, product_name: text }))}
                  placeholder="Enter product name"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Barcode *</Text>
                <View style={styles.barcodeContainer}>
                  <TextInput
                    style={[styles.input, styles.barcodeInput]}
                    value={productForm.barcode}
                    onChangeText={(text) => setProductForm(prev => ({ ...prev, barcode: text }))}
                    placeholder="Enter or generate barcode"
                  />
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={generateBarcode}
                  >
                    <MaterialIcons name="refresh" size={20} color="#007AFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Selling Price *</Text>
                <TextInput
                  style={styles.input}
                  value={productForm.selling_price}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, selling_price: text }))}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Current Stock *</Text>
                <TextInput
                  style={styles.input}
                  value={productForm.current_stock}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, current_stock: text }))}
                  placeholder="0"
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Category</Text>
                <TextInput
                  style={styles.input}
                  value={productForm.category}
                  onChangeText={(text) => setProductForm(prev => ({ ...prev, category: text }))}
                  placeholder="Enter category (optional)"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, formLoading && styles.saveButtonDisabled]}
                onPress={handleSaveProduct}
                disabled={formLoading}
              >
                {formLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingProduct ? 'Update Product' : 'Add Product'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  taxesButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
  },
  listContainer: {
    padding: 16,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productBarcode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  productBrand: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  productCategory: {
    fontSize: 10,
    color: '#007AFF',
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  productStock: {
    alignItems: 'flex-end',
  },
  stockText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lowStock: {
    color: '#ff3b30',
  },
  normalStock: {
    color: '#34C759',
  },
  reportCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reportDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34C759',
  },
  reportItems: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  addButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barcodeInput: {
    flex: 1,
    marginRight: 12,
  },
  generateButton: {
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default SalesScreen;