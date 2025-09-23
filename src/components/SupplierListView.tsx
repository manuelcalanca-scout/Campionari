import React, { useState } from 'react';
import type { Supplier } from '../types';
import { PlusIcon, BuildingStorefrontIcon, TrashIcon } from './icons';
import { Modal } from './Modal';
import { BusinessCardImage } from './BusinessCardImage';

interface SupplierListViewProps {
  suppliers: Supplier[];
  onSelectSupplier: (id: string) => void;
  onAddSupplier: () => void;
  onRemoveSupplier: (id: string) => void;
}


export const SupplierListView: React.FC<SupplierListViewProps> = ({ suppliers, onSelectSupplier, onAddSupplier, onRemoveSupplier }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>, supplierId: string) => {
    e.stopPropagation();
    setSupplierToDelete(supplierId);
    setIsModalOpen(true);
  };

  const confirmDelete = () => {
    if (supplierToDelete) {
      onRemoveSupplier(supplierToDelete);
    }
    setIsModalOpen(false);
    setSupplierToDelete(null);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setSupplierToDelete(null);
  };

  const handleCardClick = (supplierId: string) => {
    onSelectSupplier(supplierId);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, supplierId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        onSelectSupplier(supplierId);
      }
    }
  };


  return (
    <>
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={confirmDelete}
        title="Delete Supplier"
      >
        Are you sure you want to delete this supplier and all its data? This action cannot be undone.
      </Modal>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Campionature</h1>
          <button
            onClick={onAddSupplier}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-transform transform hover:scale-105"
          >
            <PlusIcon />
            Add New Supplier
          </button>
        </div>

        {suppliers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {suppliers.map(supplier => (
              <div 
                key={supplier.id} 
                onClick={() => handleCardClick(supplier.id)}
                className="relative group bg-white rounded-lg shadow-md overflow-hidden cursor-pointer border border-gray-200 hover:shadow-xl hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-1"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => handleCardKeyDown(e, supplier.id)}
              >
                <button
                    onClick={(e) => handleDeleteClick(e, supplier.id)}
                    className="absolute top-2 right-2 z-10 p-1.5 bg-white/80 text-gray-500 rounded-full hover:bg-red-100 hover:text-red-600 transition-all"
                    aria-label={`Delete ${supplier.name}`}
                >
                    <TrashIcon />
                </button>
                <div className="aspect-[16/9] w-full overflow-hidden">
                  <BusinessCardImage
                    businessCard={supplier.headerData.businessCard}
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="p-4 font-bold text-lg text-center text-gray-800 truncate">{supplier.name || 'Untitled Supplier'}</h3>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-6 border-2 border-dashed border-gray-300 rounded-lg">
              <h2 className="text-xl font-semibold text-gray-700">No Suppliers Found</h2>
              <p className="text-gray-500 mt-2">Click "Add New Supplier" to get started.</p>
          </div>
        )}
      </div>
    </>
  );
};
