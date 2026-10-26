import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDashboardData, getWeeklyRevenue, getWeeklyStats } from "../../services/api";
import { syncService, SyncStatus } from "../../services/syncService";

interface DashboardStats {
  total_sales: number;
  total_products: number;
  low_stock_items: number;
  weekly_revenue: number;
  weekly_transactions: number;
  weekly_growth?: number;
}

const DashboardScreen = () => {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    lastSyncTime: null,
    pendingSalesCount: 0,
    pendingScannedItemsCount: 0,
    pendingReceiptsCount: 0,
    isSyncing: false,
  });
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    checkDevelopmentMode();
    loadUserData();
    loadDashboardData();
    initializeWebSocket();
    initializeSyncService();

    let cleanupWebSocket: (() => void) | undefined;

    initializeWebSocket().then((cleanup) => {
      cleanupWebSocket = cleanup;
    });

    return () => {
      // Cleanup connections
      if (cleanupWebSocket) {
        cleanupWebSocket();
      }
      syncService.removeSyncListener(handleSyncStatusChange);
    };
  }, []);

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem("user_data");
      if (userDataString) {
        const user = JSON.parse(userDataString);
        setUserData(user);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const initializeSyncService = () => {
    // Get initial sync status
    syncService.getSyncStatus().then(setSyncStatus);

    // Listen for sync status changes
    syncService.addSyncListener(handleSyncStatusChange);
  };

  const handleSyncStatusChange = (newStatus: SyncStatus) => {
    setSyncStatus(newStatus);
  };

  const checkDevelopmentMode = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      setDevMode(token === "dev_token");
    } catch (error) {
      console.error("Error checking development mode:", error);
    }
  };

  const initializeWebSocket = async () => {
    try {
      // Get user store ID for WebSocket connection
      const userDataString = await AsyncStorage.getItem("user_data");
      if (userDataString) {
        const user = JSON.parse(userDataString);
        if (user.store_id) {
          // WebSocket functionality disabled - using HTTP endpoints instead
          // await websocketService.connect(user.store_id);

          // Listen for real-time updates using HTTP polling instead of WebSocket
          const cleanupMessageHandler = () => {
            // No-op since WebSocket is disabled
          };

          // Check connection status periodically
          // WebSocket disabled - no connection checking needed
          const connectionCheckInterval = setInterval(() => {
            setIsConnected(false); // WebSocket always disabled
          }, 1000);

          // Store cleanup functions for component unmount
          return () => {
            clearInterval(connectionCheckInterval);
            cleanupMessageHandler();
          };
        }
      }
    } catch (error) {
      console.error("WebSocket initialization error:", error);
      setIsConnected(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load real data from backend
      const [dashboardData, weeklyData, weeklyRevenueData] = await Promise.all([
        getDashboardData(),
        getWeeklyStats(),
        getWeeklyRevenue(),
      ]);

      const lowStockCount = Array.isArray(dashboardData.low_stock_items)
        ? dashboardData.low_stock_items.length
        : (dashboardData.low_stock_items ?? dashboardData.low_stock_products ?? 0);

      setStats({
        total_sales: dashboardData.total_sales || 0,
        total_products: dashboardData.total_products || 0,
        low_stock_items: lowStockCount,
        weekly_revenue: weeklyRevenueData.weekly_revenue || 0,
        weekly_transactions: weeklyData.weekly_transactions || 0,
        weekly_growth: weeklyData.weekly_growth || 0,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // Show error state or handle appropriately
      setStats({
        total_sales: 0,
        total_products: 0,
        low_stock_items: 0,
        weekly_revenue: 0,
        weekly_transactions: 0,
        weekly_growth: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");

      if (token === "dev_token") {
        // For development mode, just remove the dev token
        await AsyncStorage.multiRemove([
          "access_token",
          "refresh_token",
          "user_data",
        ]);
        Alert.alert(
          "Development Mode",
          "You have been logged out of development mode.",
          [{ text: "OK" }]
        );
      } else {
        // For production mode, remove tokens and logout
        await AsyncStorage.multiRemove([
          "access_token",
          "refresh_token",
          "user_data",
        ]);
      }

      router.replace("/LoginScreen");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const isDevelopmentMode = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      return token === "dev_token";
    } catch (error) {
      return false;
    }
  };

  const navigateToScanner = () => {
    router.push("/ScannerScreen");
  };

  const navigateToSales = () => {
    router.push("/SalesScreen");
  };

  const navigateToSettings = () => {
    router.push("/SettingsScreen");
  };

  const handleManualSync = async () => {
    try {
      const result = await syncService.performFullSync();
      if (result.success) {
        Alert.alert(
          "Sync Complete",
          `Synced ${result.syncedSales} sales and ${result.syncedProducts} products`,
          [{ text: "OK" }]
        );
        // Refresh dashboard data
        loadDashboardData();
      } else {
        Alert.alert(
          "Sync Issues",
          `Some items failed to sync. Check errors: ${result.errors.join(
            ", "
          )}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Manual sync error:", error);
      Alert.alert("Sync Error", "Failed to perform manual sync");
    }
  };

  const handleForceProductSync = async () => {
    try {
      const result = await syncService.forceSyncProducts();
      if (result.success) {
        Alert.alert(
          "Product Sync Complete",
          `Synced ${result.syncedProducts} products`,
          [{ text: "OK" }]
        );
        loadDashboardData();
      } else {
        Alert.alert("Product Sync Issues", result.errors.join(", "), [
          { text: "OK" },
        ]);
      }
    } catch (error) {
      console.error("Product sync error:", error);
      Alert.alert("Sync Error", "Failed to sync products");
    }
  };


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.container}>

        
                    {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerTop}>
                  <Text style={styles.headerTitle}>Dashboard</Text>
                  <View style={styles.indicators}>
                    {devMode && (
                      <View style={styles.devIndicator}>
                        <Text style={styles.devText}>POS</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.connectionIndicator,
                        isConnected ? styles.connected : styles.disconnected,
                      ]}
                    >
                      <View
                        style={[
                          styles.connectionDot,
                          isConnected
                            ? styles.connectedDot
                            : styles.disconnectedDot,
                        ]}
                      />
                      <Text
                        style={[
                          styles.connectionText,
                          isConnected
                            ? styles.connectedText
                            : styles.disconnectedText,
                        ]}
                      >
                        {isConnected ? "Live" : "Offline"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Personalized Greeting */}
                <Text style={styles.headerGreeting}>
                  Cashier: {userData?.name || "Cashier"}
                </Text>

                {/* User ID */}
                {userData?.id && (
                  // <Text style={styles.headerUserId}>ID: {userData.id}</Text>
                  <Text style={styles.headerGreeting}>ID: {userData.id}</Text>
                )}
              </View>

              {/* <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <MaterialIcons name="logout" size={24} color="#ff3b30" />
          </TouchableOpacity> */}
            </View>


        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <MaterialIcons
                    name="attach-money"
                    size={32}
                    color="#007AFF"
                  />
                  <Text style={styles.statNumber}>
                    ${stats?.weekly_revenue || 0}
                  </Text>
                  <Text style={styles.statLabel}>Weekly Revenue</Text>
                </View>
                <View style={styles.statCard}>
                  <MaterialIcons
                    name="shopping-cart"
                    size={32}
                    color="#34C759"
                  />
                  <Text style={styles.statNumber}>
                    {stats?.weekly_transactions || 0}
                  </Text>
                  <Text style={styles.statLabel}>Weekly Transactions</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <MaterialIcons name="inventory" size={32} color="#FF9500" />
                  <Text style={styles.statNumber}>
                    {stats?.total_products || 0}
                  </Text>
                  <Text style={styles.statLabel}>Products</Text>
                </View>
                <View style={styles.statCard}>
                  <MaterialIcons name="warning" size={32} color="#FF3B30" />
                  <Text style={styles.statNumber}>
                    {stats?.low_stock_items || 0}
                  </Text>
                  <Text style={styles.statLabel}>Low Stock Items</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <MaterialIcons name="trending-up" size={32} color="#34C759" />
                  <Text style={styles.statNumber}>
                    {stats?.weekly_growth ? `${stats.weekly_growth}%` : '0%'}
                  </Text>
                  <Text style={styles.statLabel}>Weekly Growth</Text>
                </View>
                <View style={styles.statCard}>
                  <MaterialIcons name="analytics" size={32} color="#007AFF" />
                  <Text style={styles.statNumber}>
                    {stats?.total_sales || 0}
                  </Text>
                  <Text style={styles.statLabel}>Total Sales</Text>
                </View>
              </View>
            </View>

            

            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={navigateToScanner}
              >
                <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Scan Product</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={navigateToSales}
              >
                <MaterialIcons name="point-of-sale" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Sales & Products</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={navigateToSettings}
              >
                <MaterialIcons name="settings" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Settings</Text>
              </TouchableOpacity>
            </View>




            {/* Sync Status */}
            <View style={styles.syncContainer}>
              <View style={styles.syncHeader}>
                <Text style={styles.sectionTitle}>Sync Status</Text>
                {syncStatus.isSyncing && (
                  <ActivityIndicator size="small" color="#007AFF" />
                )}
              </View>

              <View style={styles.syncInfo}>
                <View style={styles.syncRow}>
                  <Text style={styles.syncLabel}>Sync Status:</Text>
                  <Text
                    style={[
                      styles.syncValue,
                      syncStatus.isOnline
                        ? styles.onlineText
                        : styles.offlineText,
                    ]}
                  >
                    {"  "}{syncStatus.isOnline ? "Online" : "Offline"}
                  </Text>
                </View>

                {syncStatus.lastSyncTime && (
                  <View style={styles.syncRow}>
                    <Text style={styles.syncLabel}>Last Sync:</Text>
                    <Text style={styles.syncValue}>
                      {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}
                    </Text>
                  </View>
                )}

                {syncStatus.pendingSalesCount > 0 && (
                  <View style={styles.syncRow}>
                    <Text style={styles.syncLabel}>Pending Sales:</Text>
                    <Text style={[styles.syncValue, styles.pendingText]}>
                      {syncStatus.pendingSalesCount}
                    </Text>
                  </View>
                )}
              </View>

              {syncStatus.isOnline && (
                <View style={styles.syncButtons}>
                  <TouchableOpacity
                    style={styles.syncButton}
                    onPress={handleManualSync}
                    disabled={syncStatus.isSyncing}
                  >
                    <MaterialIcons name="sync" size={16} color="#fff" />
                    <Text style={styles.syncButtonText}>Full Sync</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.syncButton}
                    onPress={handleForceProductSync}
                    disabled={syncStatus.isSyncing}
                  >
                    <MaterialIcons name="inventory" size={16} color="#fff" />
                    <Text style={styles.syncButtonText}>Sync Products</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: StatusBar.currentHeight || 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  },
  headerLeft: {
    flex: 1,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  indicators: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  devIndicator: {
    backgroundColor: "#ff9500",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  devText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 2,
  },
  headerGreeting: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 8,
  },
  headerUserId: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  connectionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  connected: {
    backgroundColor: "#e8f5e8",
  },
  disconnected: {
    backgroundColor: "#fce8e8",
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedDot: {
    backgroundColor: "#34C759",
  },
  disconnectedDot: {
    backgroundColor: "#FF3B30",
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  connectedText: {
    color: "#34C759",
  },
  disconnectedText: {
    color: "#FF3B30",
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    padding: 20,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
  syncContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    // paddingHorizontal:"5%",
    marginHorizontal: "5%",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  syncHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 12,
  },
  syncInfo: {
    marginBottom: 16,
  },
  syncRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 8,
  },
  syncLabel: {
    fontSize: 14,
    color: "#666",
  },
  syncValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    // paddingLeft: ,
  },
  onlineText: {
    color: "#34C759",
  },
  offlineText: {
    color: "#FF3B30",
  },
  pendingText: {
    color: "#FF9500",
  },
  syncButtons: {
    flexDirection: "row",
    gap: 8,
  },
  syncButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  syncButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default DashboardScreen;
