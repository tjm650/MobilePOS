import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainTabParamList } from '../navigation/AppNavigator';
import { getDashboardData, getTodayStats } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DashboardScreenNavigationProp = StackNavigationProp<MainTabParamList, 'Dashboard'>;

interface Props {
  navigation: DashboardScreenNavigationProp;
}

interface DashboardData {
  today_sales: number;
  today_transactions: number;
  total_products: number;
  low_stock_products: number;
  active_cashiers: number;
}

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [todayStats, setTodayStats] = useState({ sales: 0, transactions: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    loadDashboardData();
    loadUserData();

    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.first_name || user.username || 'Cashier');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const [dashboard, stats] = await Promise.all([
        getDashboardData(),
        getTodayStats(),
      ]);

      setDashboardData(dashboard);
      setTodayStats(stats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, [loadDashboardData]);

  const handleNewSale = () => {
    navigation.navigate('Scanner');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {userName}</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Icon name="person" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Sales</Text>
            <Text style={styles.statValue}>
              {formatCurrency(todayStats.sales)}
            </Text>
            <Text style={styles.statSubtext}>
              {todayStats.transactions} transactions
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Active Cashiers</Text>
            <Text style={styles.statValue}>{dashboardData.active_cashiers}</Text>
            <Text style={styles.statSubtext}>in your store</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryActionButton} onPress={handleNewSale}>
            <Icon name="add" size={24} color="#fff" />
            <Text style={styles.primaryActionButtonText}>New Sale</Text>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryActionButton}>
              <Icon name="inventory" size={20} color="#007AFF" />
              <Text style={styles.secondaryActionButtonText}>Inventory</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryActionButton}>
              <Icon name="assessment" size={20} color="#007AFF" />
              <Text style={styles.secondaryActionButtonText}>Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryActionButton}>
              <Icon name="settings" size={20} color="#007AFF" />
              <Text style={styles.secondaryActionButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Inventory Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.sectionTitle}>Inventory Summary</Text>

          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {dashboardData.total_products}
              </Text>
              <Text style={styles.summaryStatLabel}>Total Products</Text>
            </View>

            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatValue, styles.lowStockValue]}>
                {dashboardData.low_stock_products}
              </Text>
              <Text style={styles.summaryStatLabel}>Low Stock Items</Text>
            </View>
          </View>

          {dashboardData.low_stock_products > 0 && (
            <TouchableOpacity style={styles.alertButton}>
              <Icon name="warning" size={20} color="#FF6B35" />
              <Text style={styles.alertButtonText}>
                Review Low Stock Items
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.activityContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityItem}>
            <Icon name="schedule" size={20} color="#666" />
            <Text style={styles.activityText}>
              Dashboard loaded at {new Date().toLocaleTimeString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  profileButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 10,
    color: '#999',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  primaryActionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryActionButtonText: {
    color: '#007AFF',
    fontSize: 12,
    marginTop: 4,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  lowStockValue: {
    color: '#FF6B35',
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  alertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
  },
  alertButtonText: {
    color: '#FF6B35',
    fontSize: 14,
    marginLeft: 8,
  },
  activityContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
});

export default DashboardScreen;