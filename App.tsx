import React, { useState, useCallback, useEffect } from 'react';
import { SupplierListView } from './src/components/SupplierListView';
import { SupplierDetailView } from './src/components/SupplierDetailView';
import { AuthWrapper } from './src/components/AuthWrapper';
import { syncService, type SyncStatus } from './src/services/syncService';
import { googleDrive } from './src/services/googleDrive';
import { googleAuth } from './src/services/googleAuth';
import { generateUUID } from './src/utils/uuid';
import type { Supplier, Item, ImageFile } from './src/types';

const initialSuppliers: Supplier[] = [
  {
    id: generateUUID(),
    name: 'Bridge Power',
    headerData: {
        businessCard: null,
        date: '06/02/2023',
        booth: '',
        madeIn: 'CHINA',
        numSamples: '5',
        samplesArrivingDate: '',
        notes: 'M0Q: 500/COL - L/C AT SIGHT OK - 10DAYS PER PROTO SAMPLE 45DAYS PRODUCTION AFTER CONFIRMATION.\nSPEDIRE FELPA AMERICAN VINTAGE PER RICERCA MATERIALE SIMILE.\nCI MANDA CARTELLA DEGLI STONE WASH',
        factoryType: 'FACTORY',
    },
    items: [
        {
          id: generateUUID(),
          itemCode: 'MBPB-010',
          description: 'FLP GRIGIA',
          moq: '500/COL',
          delivery: '',
          price: '12,00 USD',
          composition: 'TERRY FLEECE 430GSM',
          notes: '',
          images: [],
        },
        {
          id: generateUUID(),
          itemCode: 'NGP-A-12',
          description: 'TSH STONE WASH',
          moq: '',
          delivery: '',
          price: '5,80 USD',
          composition: '100% COTTON 200gsm PIGMENT DYED OE-YARN',
          notes: '',
          images: [],
        },
    ]
  }
];


const fileToImageFile = (file: File): Promise<ImageFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                dataUrl: reader.result as string,
                name: file.name,
                type: file.type,
            });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};


const AppContent: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const localSuppliers = syncService.loadLocally();
    return localSuppliers.length > 0 ? localSuppliers : initialSuppliers;
  });

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncService.getSyncStatus());

  const updateSuppliers = useCallback((updater: (prev: Supplier[]) => Supplier[], changedSupplierId?: string, changedItemId?: string) => {
    setSuppliers(prev => {
        const newSuppliers = updater(prev);
        syncService.saveLocally(newSuppliers, changedSupplierId, changedItemId);
        return newSuppliers;
    });
  }, []);

  const handleSaveToCloud = useCallback(async () => {
    try {
      await syncService.forceSync();
    } catch (error) {
      console.error('Error saving to cloud:', error);
      alert('Errore durante il salvataggio su Drive. Riprova.');
    }
  }, []);

  const handleResetAll = useCallback(async () => {
    const confirmed = confirm(
      '⚠️ ATTENZIONE: Questa operazione cancellerà:\n\n' +
      '• TUTTI i dati locali\n' +
      '• TUTTI i file su Google Drive\n' +
      '• Ricomincerà da zero\n\n' +
      'Questa operazione è IRREVERSIBILE!\n\n' +
      'Continuare?'
    );

    if (!confirmed) return;

    try {
      // 1. Cancella localStorage
      localStorage.clear();

      // 2. Reset ai dati iniziali localmente
      setSuppliers(initialSuppliers);
      syncService.saveLocally(initialSuppliers);

      // 3. Cancella tutto da Google Drive (se autenticato)
      if (googleAuth.isUserSignedIn()) {
        console.log('🗑️ Cleaning Google Drive...');
        await googleDrive.deleteAllCloudData();
      }

      alert('✅ Reset completato!\n\nTutti i dati locali e cloud sono stati cancellati.\nL\'app è stata ripulita completamente.');
    } catch (error) {
      console.error('Error during reset:', error);
      alert('⚠️ Reset parzialmente completato.\n\nDati locali cancellati, ma errore nella pulizia di Google Drive.\nControlla la console per dettagli.');
    }
  }, []);

  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrateToGranular = useCallback(async () => {
    const confirmed = confirm(
      '🔄 MIGRAZIONE A STRUTTURA GRANULARE\n\n' +
      'Questa operazione:\n' +
      '• Creerà file separati per header e items\n' +
      '• Cancellerà i vecchi file monolitici\n' +
      '• Migliorerà performance e sync (95% più veloce)\n\n' +
      'I tuoi dati sono al sicuro, ma assicurati di avere una copia di backup.\n\n' +
      'Procedere con la migrazione?'
    );

    if (!confirmed) return;

    setIsMigrating(true);

    try {
      await googleDrive.migrateToGranularStructure();

      // Abilita architettura granulare
      syncService.enableGranularStorage();

      // Ricarica dati
      const updatedSuppliers = await syncService.syncFromCloud();
      setSuppliers(updatedSuppliers);

      alert('✅ Migrazione completata!\n\nL\'app ora usa la nuova architettura granulare.\nLe modifiche saranno molto più veloci!');
    } catch (error) {
      console.error('Migration error:', error);
      alert('❌ Errore durante la migrazione.\n\nI file originali sono preservati. Controlla la console per dettagli.');
    } finally {
      setIsMigrating(false);
    }
  }, []);

  // Listen to sync status changes
  useEffect(() => {
    const unsubscribe = syncService.onSyncStatusChange((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  }, []);

  // Effect to ensure selection is cleared if the selected supplier is deleted
  useEffect(() => {
    if (selectedSupplierId && !suppliers.some(s => s.id === selectedSupplierId)) {
      setSelectedSupplierId(null);
    }
  }, [suppliers, selectedSupplierId]);

  const handleAddSupplier = useCallback(() => {
    const newSupplier: Supplier = {
      id: generateUUID(),
      name: '',
      headerData: {
        businessCard: null,
        date: new Date().toLocaleDateString('it-IT'),
        booth: '',
        madeIn: '',
        numSamples: '',
        samplesArrivingDate: '',
        notes: '',
        factoryType: '',
      },
      items: []
    };
    updateSuppliers(prev => [...prev, newSupplier], newSupplier.id);
    setSelectedSupplierId(newSupplier.id);
  }, [updateSuppliers]);
  
  const handleRemoveSupplier = useCallback((supplierId: string) => {
    updateSuppliers(prev => prev.filter(s => s.id !== supplierId));
  }, [updateSuppliers]);

  const handleSupplierNameChange = useCallback((supplierId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, name: value } : s), supplierId);
  }, [updateSuppliers]);

  const handleHeaderChange = useCallback((supplierId: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateSuppliers(prev =>
      prev.map(s =>
        s.id === supplierId
          ? { ...s, headerData: { ...s.headerData, [name]: value } }
          : s
      ),
      supplierId
    );
  }, [updateSuppliers]);

  const handleBusinessCardChange = useCallback(async (supplierId: string, file: File | null) => {
    try {
        const newImage = file ? await fileToImageFile(file) : null;
        updateSuppliers(prev =>
          prev.map(s => {
            if (s.id !== supplierId) return s;
            return { ...s, headerData: { ...s.headerData, businessCard: newImage }};
          }),
          supplierId
        );
    } catch (error) {
        console.error("Error processing business card image:", error);
        alert("There was an error processing the business card image. Please try another file.");
    }
  }, [updateSuppliers]);

  const handleItemChange = useCallback((supplierId: string, itemId: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateSuppliers(prevSuppliers =>
      prevSuppliers.map(supplier =>
        supplier.id === supplierId
          ? {
              ...supplier,
              items: supplier.items.map(item =>
                item.id === itemId ? { ...item, [name]: value } : item
              ),
            }
          : supplier
      ),
      supplierId
    );
  }, [updateSuppliers]);
  
  const handleAddItemImages = useCallback(async (supplierId: string, itemId: string, newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;

    try {
        const newImageFilesPromises = Array.from(newFiles).map(fileToImageFile);
        const newImageFiles = await Promise.all(newImageFilesPromises);

        updateSuppliers(prevSuppliers =>
          prevSuppliers.map(supplier =>
            supplier.id === supplierId
              ? {
                  ...supplier,
                  items: supplier.items.map(item =>
                    item.id === itemId
                      ? { ...item, images: [...item.images, ...newImageFiles] }
                      : item
                  ),
                }
              : supplier
          ),
          supplierId
        );
    } catch (error) {
        console.error("Error processing item images:", error);
        alert("There was an error processing one or more images. Please check the files and try again.");
    }
  }, [updateSuppliers]);

  const handleRemoveItemImage = useCallback((supplierId: string, itemId: string, imageIndex: number) => {
    updateSuppliers(prevSuppliers =>
      prevSuppliers.map(supplier => {
        if (supplier.id === supplierId) {
          return {
            ...supplier,
            items: supplier.items.map(item => {
              if (item.id === itemId) {
                const newImages = item.images.filter((_, index) => index !== imageIndex);
                return { ...item, images: newImages };
              }
              return item;
            }),
          };
        }
        return supplier;
      }),
      supplierId,
      itemId
    );
  }, [updateSuppliers]);

  const handleAddItem = useCallback((supplierId: string) => {
    const newItem: Item = {
      id: generateUUID(),
      itemCode: '',
      description: '',
      moq: '',
      delivery: '',
      price: '',
      composition: '',
      notes: '',
      images: [],
    };
    updateSuppliers(prev =>
      prev.map(s =>
        s.id === supplierId ? { ...s, items: [...s.items, newItem] } : s
      ),
      supplierId
    );
  }, [updateSuppliers]);

  const handleRemoveItem = useCallback((supplierId: string, itemId: string) => {
    updateSuppliers(prev =>
      prev.map(s =>
        s.id === supplierId
          ? { ...s, items: s.items.filter(item => item.id !== itemId) }
          : s
      ),
      supplierId,
      itemId
    );
  }, [updateSuppliers]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header con pulsante Salva */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Campionari
          </h1>
          <div className="flex items-center gap-4">
            {/* Indicatore stato */}
            <div className="text-sm">
              {syncStatus.syncing ? (
                <span className="text-blue-600">🔄 Sincronizzando...</span>
              ) : syncStatus.hasPendingChanges ? (
                <span className="text-orange-600">⚠️ Modifiche non salvate</span>
              ) : (
                <span className="text-green-600">✅ Sincronizzato</span>
              )}
            </div>
            {/* Pulsanti */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveToCloud}
                disabled={syncStatus.syncing || !syncStatus.hasPendingChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {syncStatus.syncing ? 'Salvando...' : 'Salva su Drive'}
              </button>
              <button
                onClick={handleMigrateToGranular}
                disabled={isMigrating}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                title="Migra a storage granulare per sync più veloce"
              >
                {isMigrating ? '🔄 Migrando...' : '🚀 Migra Granulare'}
              </button>
              <button
                onClick={handleResetAll}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                title="Reset completo dei dati"
              >
                🗑️ Reset
              </button>
            </div>
          </div>
        </div>
        {selectedSupplier ? (
          <SupplierDetailView
            key={selectedSupplier.id}
            supplier={selectedSupplier}
            onSupplierNameChange={(e) => handleSupplierNameChange(selectedSupplier.id, e)}
            onHeaderChange={(e) => handleHeaderChange(selectedSupplier.id, e)}
            onBusinessCardChange={(file) => handleBusinessCardChange(selectedSupplier.id, file)}
            onItemChange={(itemId, e) => handleItemChange(selectedSupplier.id, itemId, e)}
            onAddItemImages={(itemId, files) => handleAddItemImages(selectedSupplier.id, itemId, files)}
            onRemoveItemImage={handleRemoveItemImage}
            onAddItem={() => handleAddItem(selectedSupplier.id)}
            onRemoveItem={handleRemoveItem}
            onRemoveSupplier={handleRemoveSupplier}
            onBack={() => setSelectedSupplierId(null)}
          />
        ) : (
          <SupplierListView
            suppliers={suppliers}
            onSelectSupplier={setSelectedSupplierId}
            onAddSupplier={handleAddSupplier}
            onRemoveSupplier={handleRemoveSupplier}
          />
        )}
        <footer className="text-center mt-8 text-sm text-gray-500">
          <p>Product Spec Sheet Creator</p>
        </footer>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthWrapper>
      {(user, isLoading) => {
        if (isLoading) {
          return (
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
            </div>
          );
        }
        return <AppContent />;
      }}
    </AuthWrapper>
  );
};

export default App;