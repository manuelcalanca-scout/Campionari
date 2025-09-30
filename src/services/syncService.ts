import type { Supplier } from '../types';
import { googleDrive } from './googleDrive';
import { googleAuth } from './googleAuth';

const LOCAL_STORAGE_KEY = 'product-spec-sheet-creator-suppliers';
const LAST_SYNC_KEY = 'product-spec-sheet-creator-last-sync';
const PENDING_CHANGES_KEY = 'product-spec-sheet-creator-pending-changes';
const DIRTY_SUPPLIERS_KEY = 'product-spec-sheet-creator-dirty-suppliers'; // IDs dei fornitori modificati

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
  private dirtySupplierIds: Set<string> = this.loadDirtySupplierIds();

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

  saveLocally(suppliers: Supplier[], changedSupplierId?: string): void {
    try {
      console.log('💾 saveLocally called with:', {
        changedSupplierId,
        currentDirtyIds: Array.from(this.dirtySupplierIds)
      });

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(suppliers));

      // Se specificato, marca solo quel fornitore come dirty
      // Altrimenti marca tutti (caso sicuro ma meno efficiente)
      if (changedSupplierId) {
        this.markSupplierDirty(changedSupplierId);
      } else {
        console.log('⚠️ No changedSupplierId provided - marking ALL suppliers as dirty');
        // Marca tutti i fornitori come dirty
        suppliers.forEach(s => this.dirtySupplierIds.add(s.id));
        this.saveDirtySupplierIds();
        this.markPendingChanges();
      }

      console.log('💾 After saveLocally, dirty IDs:', Array.from(this.dirtySupplierIds));
      this.updateSyncStatus({ hasPendingChanges: true });
    } catch (error) {
      console.error('Error saving suppliers locally:', error);
    }
  }

  saveLocallyAndSync(suppliers: Supplier[], changedSupplierId?: string): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(suppliers));

      // Marca fornitori dirty
      if (changedSupplierId) {
        this.markSupplierDirty(changedSupplierId);
      } else {
        suppliers.forEach(s => this.dirtySupplierIds.add(s.id));
        this.saveDirtySupplierIds();
        this.markPendingChanges();
      }

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

      // Sistema JSON-per-supplier: salva solo fornitori modificati
      if (this.hasPendingChanges()) {
        console.log('💾 Saving to cloud with JSON-per-supplier architecture...');
        console.log('🔍 Dirty suppliers:', Array.from(this.dirtySupplierIds));
        await googleDrive.saveSuppliersNew(localSuppliers, this.dirtySupplierIds);
        this.clearPendingChanges();
        this.clearDirtySupplierIds(); // Pulisci dopo il salvataggio riuscito
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

  private loadDirtySupplierIds(): Set<string> {
    try {
      const saved = localStorage.getItem(DIRTY_SUPPLIERS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      return new Set();
    }
  }

  private saveDirtySupplierIds(): void {
    localStorage.setItem(DIRTY_SUPPLIERS_KEY, JSON.stringify(Array.from(this.dirtySupplierIds)));
  }

  private clearDirtySupplierIds(): void {
    console.log('🧹 Clearing dirty suppliers. Before:', Array.from(this.dirtySupplierIds));
    this.dirtySupplierIds.clear();
    localStorage.removeItem(DIRTY_SUPPLIERS_KEY);
    console.log('🧹 After clear:', Array.from(this.dirtySupplierIds));
  }

  markSupplierDirty(supplierId: string): void {
    console.log('🏷️ Marking supplier as dirty:', supplierId, '| Current dirty:', Array.from(this.dirtySupplierIds));
    this.dirtySupplierIds.add(supplierId);
    this.saveDirtySupplierIds();
    this.markPendingChanges();
    console.log('🏷️ After marking, dirty IDs:', Array.from(this.dirtySupplierIds));
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