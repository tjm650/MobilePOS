import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

interface OfflineStatusIndicatorProps {
  showDetails?: boolean;
  onSyncPress?: () => void;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  showDetails = false,
  onSyncPress,
}) => {
  const {
    isOnline,
    pendingSalesCount,
    pendingReceiptsCount,
    isSyncing,
    syncNow,
    getStatusMessage,
    getStatusColor,
  } = useOfflineStatus();

  const handleSyncPress = async () => {
    if (onSyncPress) {
      onSyncPress();
    } else {
      try {
        await syncNow();
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  };

  if (!showDetails) {
    // Simple indicator
    return (
      <View style={[styles.simpleContainer, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.simpleText}>
          {isSyncing ? '⟳' : isOnline ? '●' : '○'}
        </Text>
      </View>
    );
  }

  // Detailed indicator
  return (
    <View style={[styles.container, { borderColor: getStatusColor() }]}>
      <View style={styles.statusRow}>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusMessage()}
        </Text>
        {isOnline && (pendingSalesCount > 0 || pendingReceiptsCount > 0) && (
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
            onPress={handleSyncPress}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.syncButtonText}>Sync Now</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {(pendingSalesCount > 0 || pendingReceiptsCount > 0) && (
        <Text style={styles.pendingText}>
          {pendingSalesCount} sales, {pendingReceiptsCount} receipts pending
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  simpleContainer: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  simpleText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncButtonDisabled: {
    backgroundColor: '#ccc',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});