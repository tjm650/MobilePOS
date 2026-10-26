import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { databaseService } from '../services/database';
import { syncService, SyncStatus } from '../services/syncService';

const SettingsScreen = () => {
  const router = useRouter();
  const { theme, themeMode, setThemeMode, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [offlineStats, setOfflineStats] = useState({
    productsCount: 0,
    pendingSales: 0,
    pendingScans: 0,
  });

  useEffect(() => {
    loadUserData();
    loadOfflineStats();
    initializeSyncListener();
  }, []);

  const initializeSyncListener = () => {
    const unsubscribe = syncService.addSyncListener((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  };

  const loadOfflineStats = async () => {
    try {
      const productsCount = await databaseService.getDatabaseSize();
      const pendingSales = (await databaseService.getPendingSales()).length;
      const pendingScans = (await databaseService.getPendingScannedItems()).length;

      setOfflineStats({
        productsCount,
        pendingSales,
        pendingScans,
      });
    } catch (error) {
      console.error('Error loading offline stats:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('user_data');
      if (userDataString) {
        setUserData(JSON.parse(userDataString));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_data']);
              router.replace('/LoginScreen');
            } catch (error) {
              console.error('Error during logout:', error);
            }
          },
        },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const handleManualSync = async () => {
    if (!syncStatus?.isOnline) {
      Alert.alert('Error', 'Device must be online to sync data');
      return;
    }

    setIsLoading(true);
    try {
      const result = await syncService.performFullSync();
      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Synced ${result.syncedSales} sales and ${result.syncedProducts} products successfully`
        );
        await loadOfflineStats(); // Refresh stats
      } else {
        Alert.alert(
          'Sync Issues',
          `Some items failed to sync. Check your connection and try again.`
        );
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      Alert.alert('Error', 'Failed to sync data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearOfflineData = async () => {
    Alert.alert(
      'Clear Offline Data',
      'This will delete all locally stored sales and scanned items. This cannot be undone. Make sure to sync first if you have important data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.clearAllData();
              await loadOfflineStats(); // Refresh stats
              Alert.alert('Success', 'Offline data cleared successfully');
            } catch (error) {
              console.error('Error clearing offline data:', error);
              Alert.alert('Error', 'Failed to clear offline data');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          {userData && (
            <View style={styles.profileCard}>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {userData.first_name} {userData.last_name}
                </Text>
                <Text style={styles.profileEmail}>{userData.username}</Text>
                <Text style={styles.profileRole}>Role: {userData.role}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.settingItem}>
            <MaterialIcons name="person" size={24} color="#666" />
            <Text style={styles.settingText}>Edit Profile</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* App Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>

          <View style={styles.settingItem}>
            <MaterialIcons name="notifications" size={24} color="#666" />
            <Text style={styles.settingText}>Push Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#ccc', true: '#007AFF' }}
            />
          </View>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={toggleTheme}
          >
            <MaterialIcons
              name={theme.isDark ? "light-mode" : "dark-mode"}
              size={24}
              color="#666"
            />
            <View style={styles.themeInfo}>
              <Text style={styles.settingText}>
                {themeMode === 'auto' ? 'Auto Theme' :
                 themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </Text>
              <Text style={styles.themeStatus}>
                {themeMode === 'auto' ? 'Follows device setting' :
                 theme.isDark ? 'Dark theme active' : 'Light theme active'}
              </Text>
            </View>
            <View style={styles.themeControls}>
              <Text style={styles.themeModeText}>
                {themeMode === 'auto' ? 'AUTO' : themeMode.toUpperCase()}
              </Text>
              <MaterialIcons name="chevron-right" size={24} color="#ccc" />
            </View>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <MaterialIcons name="sync" size={24} color="#666" />
            <Text style={styles.settingText}>Auto Sync</Text>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: '#ccc', true: '#007AFF' }}
            />
          </View>

          <TouchableOpacity
            style={[styles.settingItem, styles.taxManagementItem]}
            onPress={() => router.push('/TaxesScreen')}
          >
            <MaterialIcons name="receipt" size={24} color="#007AFF" />
            <Text style={[styles.settingText, styles.taxManagementText]}>Tax Management</Text>
            <MaterialIcons name="chevron-right" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Offline Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offline Data</Text>

          {/* Sync Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <MaterialIcons
                name={syncStatus?.isOnline ? "wifi" : "wifi-off"}
                size={20}
                color={syncStatus?.isOnline ? "#4CAF50" : "#ff3b30"}
              />
              <Text style={[
                styles.statusText,
                { color: syncStatus?.isOnline ? "#4CAF50" : "#ff3b30" }
              ]}>
                {syncStatus?.isOnline ? "Online" : "Offline"}
              </Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{offlineStats.productsCount}</Text>
                <Text style={styles.statLabel}>Products</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{offlineStats.pendingSales}</Text>
                <Text style={styles.statLabel}>Pending Sales</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{offlineStats.pendingScans}</Text>
                <Text style={styles.statLabel}>Pending Scans</Text>
              </View>
            </View>

            {syncStatus?.isOnline && (
              <TouchableOpacity
                style={[styles.syncButton, syncStatus?.isSyncing && styles.syncButtonDisabled]}
                onPress={handleManualSync}
                disabled={syncStatus?.isSyncing || isLoading}
              >
                {isLoading || syncStatus?.isSyncing ? (
                  <View style={styles.syncButtonContent}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.syncButtonText}>Syncing...</Text>
                  </View>
                ) : (
                  <Text style={styles.syncButtonText}>Sync Now</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.settingItem} onPress={handleClearCache}>
            <MaterialIcons name="cleaning-services" size={24} color="#ff9500" />
            <Text style={[styles.settingText, { color: '#ff9500' }]}>Clear Cache</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleClearOfflineData}>
            <MaterialIcons name="delete-sweep" size={24} color="#e74c3c" />
            <Text style={[styles.settingText, { color: '#e74c3c' }]}>Clear Offline Data</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>

          <TouchableOpacity style={styles.settingItem}>
            <MaterialIcons name="backup" size={24} color="#666" />
            <Text style={styles.settingText}>Backup Data</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <MaterialIcons name="restore" size={24} color="#666" />
            <Text style={styles.settingText}>Restore Data</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity style={styles.settingItem}>
            <MaterialIcons name="help" size={24} color="#666" />
            <Text style={styles.settingText}>Help & Support</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <MaterialIcons name="info" size={24} color="#666" />
            <Text style={styles.settingText}>About</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <MaterialIcons name="privacy-tip" size={24} color="#666" />
            <Text style={styles.settingText}>Privacy Policy</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#ff3b30" />
            <Text style={[styles.settingText, { color: '#ff3b30' }]}>Logout</Text>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>POSApp v1.0.0</Text>
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  profileCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  taxManagementItem: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    marginVertical: 4,
  },
  taxManagementText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  statusCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    backgroundColor: '#ccc',
  },
  syncButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  themeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  themeStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  themeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});

export default SettingsScreen;