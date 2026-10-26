import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { DrawerParamList } from '../navigation/AppNavigator';
import { getProducts, getSalesReports } from '../services/api';

type SalesScreenNavigationProp = StackNavigationProp<DrawerParamList, 'Sales'>;

interface Props {
  navigation: SalesScreenNavigationProp;
}

interface Product {
  item_id: string;
  sku: string;
  barcode: string;
  product_name: string;
  brand: string;
  category: string;
  selling_price: number;
  price: Number,
  current_stock: number;
  stock_status: string;
  is_low_stock: boolean;
  profit_margin: number;
  is_featured: boolean;
}

interface SalesReport {
  id: number;
  period: string;
  period_start: string;
  total_sales: number;
  total_transactions: number;
  total_profit: number;
  profit_margin: number;
}

const SalesScreen: React.FC<Props> = ({ navigation }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'analytics'>('products');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, products]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, reportsData] = await Promise.all([
        getProducts(),
        getSalesReports(),
      ]);

      setProducts(productsData);
      setSalesReports(reportsData);
    } catch (error) {
      console.error('Error loading sales data:', error);
      Alert.alert('Error', 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={[styles.productCard, item.is_low_stock && styles.lowStockCard]}>
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.product_name}</Text>
          <Text style={styles.productBrand}>{item.brand}</Text>
          <Text style={styles.productBarcode}>{item.barcode}</Text>
        </View>
        {item.is_featured && (
          <View style={styles.featuredBadge}>
            <Icon name="star" size={16} color="#FFD700" />
          </View>
        )}
      </View>

      <View style={styles.productDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Category:</Text>
          <Text style={styles.detailValue}>{item.category}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price:</Text>
          <Text style={styles.detailValue}>{formatCurrency(item.price)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Stock:</Text>
          <Text style={[
            styles.detailValue,
            item.is_low_stock && styles.lowStockText
          ]}>
            {item.current_stock} {item.stock_status}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Margin:</Text>
          <Text style={[
            styles.detailValue,
            item.profit_margin > 0 && styles.profitText
          ]}>
            {item.profit_margin.toFixed(1)}%
          </Text>
        </View>
      </View>

      <View style={styles.productActions}>
        <TouchableOpacity style={styles.editButton}>
          <Icon name="edit" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.stockButton}>
          <Icon name="inventory" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAnalyticsCard = ({ item }: { item: SalesReport }) => (
    <View style={styles.analyticsCard}>
      <View style={styles.analyticsHeader}>
        <Text style={styles.analyticsPeriod}>{item.period}</Text>
        <Text style={styles.analyticsDate}>
          {new Date(item.period_start).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.analyticsStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatCurrency(item.total_sales)}</Text>
          <Text style={styles.statLabel}>Total Sales</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.total_transactions}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatCurrency(item.total_profit)}</Text>
          <Text style={styles.statLabel}>Profit</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.profit_margin.toFixed(1)}%</Text>
          <Text style={styles.statLabel}>Margin</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Sales & Products</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Products
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
          onPress={() => setActiveTab('analytics')}
        >
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={activeTab === 'products' ? filteredProducts : salesReports}
            renderItem={(itemInfo) => activeTab === 'products' ? renderProductItem(itemInfo) : renderAnalyticsCard(itemInfo as any)}
            keyExtractor={(item) => activeTab === 'products' ? (item as Product).item_id : (item as SalesReport).id.toString()}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lowStockCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 2,
  },
  productBarcode: {
    fontSize: 12,
    color: '#666',
  },
  featuredBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 4,
  },
  productDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  lowStockText: {
    color: '#FF6B35',
  },
  profitText: {
    color: '#4CAF50',
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editButton: {
    padding: 8,
  },
  stockButton: {
    padding: 8,
  },
  analyticsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analyticsHeader: {
    marginBottom: 16,
  },
  analyticsPeriod: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  analyticsDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  analyticsStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
});

export default SalesScreen;