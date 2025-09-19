import React, { useState, useCallback, useEffect } from 'react';
import { SupplierListView } from './src/components/SupplierListView';
import { SupplierDetailView } from './src/components/SupplierDetailView';
import { AuthWrapper } from './src/components/AuthWrapper';
import { syncService } from './src/services/syncService';
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

  const updateSuppliers = useCallback((updater: (prev: Supplier[]) => Supplier[]) => {
    setSuppliers(prev => {
        const newSuppliers = updater(prev);
        syncService.saveLocally(newSuppliers);
        return newSuppliers;
    });
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
    updateSuppliers(prev => [...prev, newSupplier]);
    setSelectedSupplierId(newSupplier.id);
  }, [updateSuppliers]);
  
  const handleRemoveSupplier = useCallback((supplierId: string) => {
    updateSuppliers(prev => prev.filter(s => s.id !== supplierId));
  }, [updateSuppliers]);

  const handleSupplierNameChange = useCallback((supplierId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, name: value } : s));
  }, [updateSuppliers]);

  const handleHeaderChange = useCallback((supplierId: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateSuppliers(prev =>
      prev.map(s =>
        s.id === supplierId
          ? { ...s, headerData: { ...s.headerData, [name]: value } }
          : s
      )
    );
  }, [updateSuppliers]);

  const handleBusinessCardChange = useCallback(async (supplierId: string, file: File | null) => {
    try {
        const newImage = file ? await fileToImageFile(file) : null;
        updateSuppliers(prev =>
          prev.map(s => {
            if (s.id !== supplierId) return s;
            return { ...s, headerData: { ...s.headerData, businessCard: newImage }};
          })
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
      )
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
          )
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
      })
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
      )
    );
  }, [updateSuppliers]);

  const handleRemoveItem = useCallback((supplierId: string, itemId: string) => {
    updateSuppliers(prev =>
      prev.map(s =>
        s.id === supplierId
          ? { ...s, items: s.items.filter(item => item.id !== itemId) }
          : s
      )
    );
  }, [updateSuppliers]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {selectedSupplier ? (
          <SupplierDetailView
            key={selectedSupplier.id}
            supplier={selectedSupplier}
            onSupplierNameChange={(e) => handleSupplierNameChange(selectedSupplier.id, e)}
            onHeaderChange={(e) => handleHeaderChange(selectedSupplier.id, e)}
            onBusinessCardChange={(file) => handleBusinessCardChange(selectedSupplier.id, file)}
            onItemChange={(itemId, e) => handleItemChange(selectedSupplier.id, itemId, e)}
            onAddItemImages={(itemId, files) => handleAddItemImages(selectedSupplier.id, itemId, files)}
            onRemoveItemImage={(itemId, index) => handleRemoveItemImage(selectedSupplier.id, itemId, index)}
            onAddItem={() => handleAddItem(selectedSupplier.id)}
            onRemoveItem={(itemId) => handleRemoveItem(selectedSupplier.id, itemId)}
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