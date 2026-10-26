import { useState, useEffect } from 'react';
import { syncService, SyncStatus } from '../services/syncService';
import { apiService } from '../services/api';

export interface OfflineStatus {
  isOnline: boolean;
  pendingSalesCount: number;
  pendingReceiptsCount: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
}

export const useOfflineStatus = () => {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: false,
    pendingSalesCount: 0,
    pendingReceiptsCount: 0,
    isSyncing: false,
    lastSyncTime: null,
  });

  useEffect(() => {
    // Initialize sync service listener
    const handleStatusChange = (syncStatus: SyncStatus) => {
      setStatus({
        isOnline: syncStatus.isOnline,
        pendingSalesCount: syncStatus.pendingSalesCount,
        pendingReceiptsCount: syncStatus.pendingReceiptsCount,
        isSyncing: syncStatus.isSyncing,
        lastSyncTime: syncStatus.lastSyncTime,
      });
    };

    syncService.addSyncListener(handleStatusChange);

    // Get initial status
    syncService.getSyncStatus().then(handleStatusChange);

    // Cleanup
    return () => {
      syncService.removeSyncListener(handleStatusChange);
    };
  }, []);

  const syncNow = async () => {
    try {
      const result = await syncService.performFullSync();
      return result;
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  };

  const getStatusMessage = () => {
    if (!status.isOnline) {
      return 'Offline Mode';
    }

    if (status.isSyncing) {
      return 'Syncing...';
    }

    if (status.pendingSalesCount > 0 || status.pendingReceiptsCount > 0) {
      return `${status.pendingSalesCount + status.pendingReceiptsCount} items pending sync`;
    }

    return 'Online';
  };

  const getStatusColor = () => {
    if (!status.isOnline) return '#ff9500'; // Orange for offline
    if (status.isSyncing) return '#007aff'; // Blue for syncing
    if (status.pendingSalesCount > 0 || status.pendingReceiptsCount > 0) return '#ff3b30'; // Red for pending
    return '#34c759'; // Green for online
  };

  return {
    ...status,
    syncNow,
    getStatusMessage,
    getStatusColor,
  };
};