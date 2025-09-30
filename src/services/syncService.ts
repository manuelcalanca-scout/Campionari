import type { Supplier } from '../types';
import { googleDrive } from './googleDrive';
import { googleAuth } from './googleAuth';

const LOCAL_STORAGE_KEY = 'product-spec-sheet-creator-suppliers';
const LAST_SYNC_KEY = 'product-spec-sheet-creator-last-sync';
const PENDING_CHANGES_KEY = 'product-spec-sheet-creator-pending-changes';
const DIRTY_SUPPLIERS_KEY = 'product-spec-sheet-creator-dirty-suppliers'; // IDs dei fornitori modificati (old - per supplier intero)
const DIRTY_HEADERS_KEY = 'product-spec-sheet-creator-dirty-headers'; // IDs dei fornitori con header modificato
const DIRTY_ITEMS_KEY = 'product-spec-sheet-creator-dirty-items'; // Map supplierId -> Set<itemId>

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
  private dirtySupplierIds: Set<string> = this.loadDirtySupplierIds(); // Legacy - per compatibilità
  private dirtyHeaders: Set<string> = this.loadDirtyHeaders(); // Nuova architettura granulare
  private dirtyItems: Map<string, Set<string>> = this.loadDirtyItems(); // Nuova architettura granulare
  private useGranularStorage: boolean = localStorage.getItem('use-granular-storage') === 'true'; // Feature flag

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

  saveLocally(suppliers: Supplier[], changedSupplierId?: string, changedItemId?: string): void {
    try {
      console.log('💾 saveLocally called with:', {
        changedSupplierId,
        changedItemId,
        useGranular: this.useGranularStorage,
        currentDirtySuppliers: Array.from(this.dirtySupplierIds),
        currentDirtyHeaders: Array.from(this.dirtyHeaders),
        currentDirtyItems: Array.from(this.dirtyItems.entries()).map(([id, items]) => ({ id, items: Array.from(items) }))
      });

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(suppliers));

      if (this.useGranularStorage) {
        // NUOVA ARCHITETTURA GRANULARE
        if (changedSupplierId && changedItemId) {
          // Modifica item specifico
          this.markItemDirty(changedSupplierId, changedItemId);
        } else if (changedSupplierId) {
          // Modifica header o operazione sul fornitore intero
          this.markHeaderDirty(changedSupplierId);
        } else {
          // Fallback: marca tutto come dirty
          console.log('⚠️ No changedSupplierId provided - marking ALL as dirty');
          suppliers.forEach(s => {
            this.markHeaderDirty(s.id);
            s.items.forEach(item => this.markItemDirty(s.id, item.id));
          });
        }
      } else {
        // ARCHITETTURA LEGACY (supplier intero)
        if (changedSupplierId) {
          this.markSupplierDirty(changedSupplierId);
        } else {
          console.log('⚠️ No changedSupplierId provided - marking ALL suppliers as dirty');
          suppliers.forEach(s => this.dirtySupplierIds.add(s.id));
          this.saveDirtySupplierIds();
          this.markPendingChanges();
        }
      }

      console.log('💾 After saveLocally:', {
        dirtySuppliers: Array.from(this.dirtySupplierIds),
        dirtyHeaders: Array.from(this.dirtyHeaders),
        dirtyItems: Array.from(this.dirtyItems.entries()).map(([id, items]) => ({ id, items: Array.from(items) }))
      });

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

      if (this.hasPendingChanges()) {
        if (this.useGranularStorage) {
          // NUOVA ARCHITETTURA GRANULARE
          console.log('💾 Saving to cloud with GRANULAR architecture...');
          console.log('🔍 Dirty headers:', Array.from(this.dirtyHeaders));
          console.log('🔍 Dirty items:', Array.from(this.dirtyItems.entries()).map(([id, items]) => ({
            supplierId: id,
            itemIds: Array.from(items)
          })));

          // Crea copie per il salvataggio
          const headersToCopy = new Set(this.dirtyHeaders);
          const itemsToCopy = new Map(this.dirtyItems);

          // Pulisci IMMEDIATAMENTE per evitare accumulo
          this.clearDirtyHeaders();
          this.clearDirtyItems();

          // Salva headers modificati
          for (const supplierId of headersToCopy) {
            const supplier = localSuppliers.find(s => s.id === supplierId);
            if (supplier) {
              console.log(`💾 Saving header for ${supplier.name}...`);
              await googleDrive.saveSupplierHeader(supplierId, supplier.name, supplier.headerData);
            }
          }

          // Salva items modificati
          for (const [supplierId, itemIds] of itemsToCopy) {
            const supplier = localSuppliers.find(s => s.id === supplierId);
            if (!supplier) continue;

            for (const itemId of itemIds) {
              const item = supplier.items.find(i => i.id === itemId);
              if (item) {
                console.log(`💾 Saving item ${item.itemCode || 'untitled'} for ${supplier.name}...`);
                await googleDrive.saveSupplierItem(supplierId, item);
              }
            }
          }

          // Aggiorna index con timestamp selettivi
          await googleDrive.saveGranularIndexSelective(localSuppliers, headersToCopy, itemsToCopy);

          this.clearPendingChanges();
          console.log('✅ Synced from local to cloud (GRANULAR)');
        } else {
          // ARCHITETTURA LEGACY (supplier intero)
          console.log('💾 Saving to cloud with JSON-per-supplier architecture...');
          console.log('🔍 Dirty suppliers:', Array.from(this.dirtySupplierIds));

          // Crea una copia dei dirty IDs da salvare
          const idsToSave = new Set(this.dirtySupplierIds);

          // Pulisci IMMEDIATAMENTE i dirty IDs per evitare accumulo
          this.clearDirtySupplierIds();

          // Salva usando la copia
          await googleDrive.saveSuppliersNew(localSuppliers, idsToSave);
          this.clearPendingChanges();
          console.log('✅ Synced from local to cloud (JSON-per-supplier)');
        }
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
      // Use granular or legacy loading based on feature flag
      const cloudSuppliers = this.useGranularStorage
        ? await googleDrive.loadSuppliersGranular()
        : await googleDrive.loadSuppliersNew();

      console.log(`📥 Loaded from cloud using ${this.useGranularStorage ? 'GRANULAR' : 'LEGACY'} architecture`);

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

  // ==========================================
  // GRANULAR DIRTY TRACKING (Headers + Items)
  // ==========================================

  private loadDirtyHeaders(): Set<string> {
    try {
      const saved = localStorage.getItem(DIRTY_HEADERS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  }

  private loadDirtyItems(): Map<string, Set<string>> {
    try {
      const saved = localStorage.getItem(DIRTY_ITEMS_KEY);
      if (!saved) return new Map();

      const parsed = JSON.parse(saved);
      return new Map(Object.entries(parsed).map(([supplierId, itemIds]) => [
        supplierId,
        new Set(itemIds as string[])
      ]));
    } catch {
      return new Map();
    }
  }

  private saveDirtyHeaders(): void {
    localStorage.setItem(DIRTY_HEADERS_KEY, JSON.stringify(Array.from(this.dirtyHeaders)));
  }

  private saveDirtyItems(): void {
    const obj = Object.fromEntries(
      Array.from(this.dirtyItems.entries()).map(([supplierId, itemIds]) => [
        supplierId,
        Array.from(itemIds)
      ])
    );
    localStorage.setItem(DIRTY_ITEMS_KEY, JSON.stringify(obj));
  }

  private clearDirtyHeaders(): void {
    console.log('🧹 Clearing dirty headers. Before:', Array.from(this.dirtyHeaders));
    this.dirtyHeaders.clear();
    localStorage.removeItem(DIRTY_HEADERS_KEY);
    console.log('🧹 After clear:', Array.from(this.dirtyHeaders));
  }

  private clearDirtyItems(): void {
    console.log('🧹 Clearing dirty items. Before:', Array.from(this.dirtyItems.entries()).map(([id, items]) => ({ id, items: Array.from(items) })));
    this.dirtyItems.clear();
    localStorage.removeItem(DIRTY_ITEMS_KEY);
    console.log('🧹 After clear: Map size =', this.dirtyItems.size);
  }

  markHeaderDirty(supplierId: string): void {
    console.log('🏷️ Marking header as dirty:', supplierId);
    this.dirtyHeaders.add(supplierId);
    this.saveDirtyHeaders();
    this.markPendingChanges();
  }

  markItemDirty(supplierId: string, itemId: string): void {
    console.log('🏷️ Marking item as dirty:', { supplierId, itemId });

    if (!this.dirtyItems.has(supplierId)) {
      this.dirtyItems.set(supplierId, new Set());
    }

    this.dirtyItems.get(supplierId)!.add(itemId);
    this.saveDirtyItems();
    this.markPendingChanges();
  }

  enableGranularStorage(): void {
    localStorage.setItem('use-granular-storage', 'true');
    this.useGranularStorage = true;
    console.log('✅ Granular storage ENABLED');
  }

  disableGranularStorage(): void {
    localStorage.setItem('use-granular-storage', 'false');
    this.useGranularStorage = false;
    console.log('⚠️ Granular storage DISABLED (fallback to legacy)');
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