import type { Supplier } from '../types';
import { googleDrive } from './googleDrive';
import { googleAuth } from './googleAuth';

const LOCAL_STORAGE_KEY = 'product-spec-sheet-creator-suppliers';
const LAST_SYNC_KEY = 'product-spec-sheet-creator-last-sync';
const PENDING_CHANGES_KEY = 'product-spec-sheet-creator-pending-changes';
const DIRTY_HEADERS_KEY = 'product-spec-sheet-creator-dirty-headers';
const DIRTY_ITEMS_KEY = 'product-spec-sheet-creator-dirty-items';
const DELETED_SUPPLIERS_KEY = 'product-spec-sheet-creator-deleted-suppliers';
const DELETED_ITEMS_KEY = 'product-spec-sheet-creator-deleted-items';

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
  private dirtyHeaders: Set<string> = this.loadDirtyHeaders();
  private dirtyItems: Map<string, Set<string>> = this.loadDirtyItems();
  private deletedSuppliers: Set<string> = this.loadDeletedSuppliers();
  private deletedItems: Map<string, Set<string>> = this.loadDeletedItems();

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
        currentDirtyHeaders: Array.from(this.dirtyHeaders),
        currentDirtyItems: Array.from(this.dirtyItems.entries()).map(([id, items]) => ({ id, items: Array.from(items) }))
      });

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(suppliers));

      // GRANULAR STORAGE: Track dirty headers and items
      if (changedSupplierId && changedItemId) {
        // Item-specific modification
        this.markItemDirty(changedSupplierId, changedItemId);
        // ALSO mark header as dirty to save updated itemOrder array
        this.markHeaderDirty(changedSupplierId);
      } else if (changedSupplierId) {
        // Header modification or supplier-wide operation
        this.markHeaderDirty(changedSupplierId);
      } else {
        // Fallback: mark all as dirty
        console.log('⚠️ No changedSupplierId provided - marking ALL as dirty');
        suppliers.forEach(s => {
          this.markHeaderDirty(s.id);
          s.items.forEach(item => this.markItemDirty(s.id, item.id));
        });
      }

      console.log('💾 After saveLocally:', {
        dirtyHeaders: Array.from(this.dirtyHeaders),
        dirtyItems: Array.from(this.dirtyItems.entries()).map(([id, items]) => ({ id, items: Array.from(items) }))
      });

      this.updateSyncStatus({ hasPendingChanges: true });
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
        console.log('💾 Saving to cloud with GRANULAR architecture...');
        console.log('🔍 Dirty headers:', Array.from(this.dirtyHeaders));
        console.log('🔍 Dirty items:', Array.from(this.dirtyItems.entries()).map(([id, items]) => ({
          supplierId: id,
          itemIds: Array.from(items)
        })));
        console.log('🗑️ Deleted suppliers:', Array.from(this.deletedSuppliers));
        console.log('🗑️ Deleted items:', Array.from(this.deletedItems.entries()).map(([id, items]) => ({
          supplierId: id,
          itemIds: Array.from(items)
        })));

        // Create copies for saving/deleting
        const headersToCopy = new Set(this.dirtyHeaders);
        const itemsToCopy = new Map(this.dirtyItems);
        const suppliersToDelete = new Set(this.deletedSuppliers);
        const itemsToDelete = new Map(this.deletedItems);

        // Clear IMMEDIATELY to prevent accumulation
        this.clearDirtyHeaders();
        this.clearDirtyItems();
        this.clearDeletedSuppliers();
        this.clearDeletedItems();

        // STEP 1: Process deletions FIRST
        // Delete complete suppliers
        for (const supplierId of suppliersToDelete) {
          console.log(`🗑️ Deleting supplier ${supplierId} from Drive...`);
          await googleDrive.deleteSupplierComplete(supplierId);
        }

        // Delete individual items
        for (const [supplierId, itemIds] of itemsToDelete) {
          for (const itemId of itemIds) {
            console.log(`🗑️ Deleting item ${itemId} from supplier ${supplierId}...`);
            await googleDrive.deleteSupplierItem(supplierId, itemId);
          }
        }

        // STEP 2: Save modifications

        // Save modified headers
        for (const supplierId of headersToCopy) {
          const supplier = localSuppliers.find(s => s.id === supplierId);
          if (supplier) {
            console.log(`💾 Saving header for ${supplier.name}...`);
            // Extract item order to preserve custom ordering
            const itemOrder = supplier.items.map(item => item.id);
            await googleDrive.saveSupplierHeader(supplierId, supplier.name, supplier.headerData, itemOrder);
          }
        }

        // Save modified items
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

        // Update index with selective timestamps
        await googleDrive.saveGranularIndexSelective(localSuppliers, headersToCopy, itemsToCopy);

        this.clearPendingChanges();
        console.log('✅ Synced from local to cloud (GRANULAR)');
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
      const cloudSuppliers = await googleDrive.loadSuppliersGranular();
      console.log('📥 Loaded from cloud using GRANULAR architecture');

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

  getSyncStatus(): SyncStatus {
    return { ...this.currentSyncStatus };
  }

  async forceSync(): Promise<void> {
    if (googleAuth.isUserSignedIn() && this.currentSyncStatus.isOnline) {
      await this.syncToCloud();
    }
  }

  // ==========================================
  // DELETION TRACKING (Deferred)
  // ==========================================

  private loadDeletedSuppliers(): Set<string> {
    try {
      const saved = localStorage.getItem(DELETED_SUPPLIERS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  }

  private loadDeletedItems(): Map<string, Set<string>> {
    try {
      const saved = localStorage.getItem(DELETED_ITEMS_KEY);
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

  private saveDeletedSuppliers(): void {
    localStorage.setItem(DELETED_SUPPLIERS_KEY, JSON.stringify(Array.from(this.deletedSuppliers)));
  }

  private saveDeletedItems(): void {
    const obj = Object.fromEntries(
      Array.from(this.deletedItems.entries()).map(([supplierId, itemIds]) => [
        supplierId,
        Array.from(itemIds)
      ])
    );
    localStorage.setItem(DELETED_ITEMS_KEY, JSON.stringify(obj));
  }

  private clearDeletedSuppliers(): void {
    this.deletedSuppliers.clear();
    localStorage.removeItem(DELETED_SUPPLIERS_KEY);
  }

  private clearDeletedItems(): void {
    this.deletedItems.clear();
    localStorage.removeItem(DELETED_ITEMS_KEY);
  }

  markSupplierDeleted(supplierId: string): void {
    console.log('🗑️ Marking supplier as deleted (deferred):', supplierId);
    this.deletedSuppliers.add(supplierId);
    this.saveDeletedSuppliers();
    this.markPendingChanges();
  }

  markItemDeleted(supplierId: string, itemId: string): void {
    console.log('🗑️ Marking item as deleted (deferred):', { supplierId, itemId });

    if (!this.deletedItems.has(supplierId)) {
      this.deletedItems.set(supplierId, new Set());
    }

    this.deletedItems.get(supplierId)!.add(itemId);
    this.saveDeletedItems();
    this.markPendingChanges();
  }
}

export const syncService = new SyncService();
