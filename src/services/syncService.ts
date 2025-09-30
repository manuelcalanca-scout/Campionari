import type { Supplier } from '../types';
import { googleDrive } from './googleDrive';
import { googleAuth } from './googleAuth';

const LOCAL_STORAGE_KEY = 'product-spec-sheet-creator-suppliers';
const LAST_SYNC_KEY = 'product-spec-sheet-creator-last-sync';
const PENDING_CHANGES_KEY = 'product-spec-sheet-creator-pending-changes';

export interface SyncStatus {
  isOnline: boolean;
  lastSync: string | null;
  hasPendingChanges: boolean;
  syncing: boolean;
}

class SyncService {
  private syncCallbacks: ((status: SyncStatus) => void)[] = [];
  private currentSyncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    lastSync: localStorage.getItem(LAST_SYNC_KEY),
    hasPendingChanges: this.hasPendingChanges(),
    syncing: false
  };

  constructor() {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline(): void {
    this.updateSyncStatus({ isOnline: true });
    if (googleAuth.isUserSignedIn()) {
      this.syncToCloud();
    }
  }

  private handleOffline(): void {
    this.updateSyncStatus({ isOnline: false });
  }

  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    this.currentSyncStatus = { ...this.currentSyncStatus, ...updates };
    this.syncCallbacks.forEach(callback => callback(this.currentSyncStatus));
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncCallbacks.push(callback);
    callback(this.currentSyncStatus);
    
    return () => {
      const index = this.syncCallbacks.indexOf(callback);
      if (index > -1) {
        this.syncCallbacks.splice(index, 1);
      }
    };
  }

  saveLocally(suppliers: Supplier[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(suppliers));
      this.markPendingChanges();
      this.updateSyncStatus({ hasPendingChanges: true });
    } catch (error) {
      console.error('Error saving suppliers locally:', error);
    }
  }

  saveLocallyAndSync(suppliers: Supplier[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(suppliers));
      this.markPendingChanges();
      this.updateSyncStatus({ hasPendingChanges: true });

      if (this.currentSyncStatus.isOnline && googleAuth.isUserSignedIn()) {
        this.syncToCloud();
      }
    } catch (error) {
      console.error('Error saving suppliers locally:', error);
    }
  }

  loadLocally(): Supplier[] {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading suppliers locally:', error);
      return [];
    }
  }

  async syncToCloud(): Promise<void> {
    if (!googleAuth.isUserSignedIn() || !this.currentSyncStatus.isOnline) {
      return;
    }

    if (this.currentSyncStatus.syncing) {
      return;
    }

    this.updateSyncStatus({ syncing: true });

    try {
      const localSuppliers = this.loadLocally();

      // Sistema JSON-per-supplier: salva sempre locale → cloud quando ci sono pending changes
      // Non facciamo merge automatico per evitare conflitti
      if (this.hasPendingChanges()) {
        console.log('💾 Saving to cloud with JSON-per-supplier architecture...');
        await googleDrive.saveSuppliersNew(localSuppliers);
        this.clearPendingChanges();
        console.log('✅ Synced from local to cloud (JSON-per-supplier)');
      }

      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);

      this.updateSyncStatus({
        lastSync: now,
        hasPendingChanges: false,
        syncing: false
      });

    } catch (error) {
      console.error('Error syncing to cloud:', error);
      this.updateSyncStatus({ syncing: false });
      throw error;
    }
  }

  async syncFromCloud(): Promise<Supplier[]> {
    if (!googleAuth.isUserSignedIn()) {
      return this.loadLocally();
    }

    this.updateSyncStatus({ syncing: true });

    try {
      const cloudSuppliers = await googleDrive.loadSuppliersNew();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudSuppliers));
      
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      this.clearPendingChanges();

      this.updateSyncStatus({
        lastSync: now,
        hasPendingChanges: false,
        syncing: false
      });

      return cloudSuppliers;
    } catch (error) {
      console.error('Error syncing from cloud:', error);
      this.updateSyncStatus({ syncing: false });
      return this.loadLocally();
    }
  }

  private hasPendingChanges(): boolean {
    return localStorage.getItem(PENDING_CHANGES_KEY) === 'true';
  }

  private markPendingChanges(): void {
    localStorage.setItem(PENDING_CHANGES_KEY, 'true');
  }

  private clearPendingChanges(): void {
    localStorage.removeItem(PENDING_CHANGES_KEY);
  }

  getSyncStatus(): SyncStatus {
    return { ...this.currentSyncStatus };
  }

  async forceSync(): Promise<void> {
    if (googleAuth.isUserSignedIn() && this.currentSyncStatus.isOnline) {
      await this.syncToCloud();
    }
  }
}

export const syncService = new SyncService();