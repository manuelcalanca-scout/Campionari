import React from 'react';
import type { Item } from '../types';
import { TrashIcon, FolderOpenIcon } from './icons';
import { ItemImage } from './ItemImage';

interface ItemCardProps {
  supplierId: string;
  item: Item;
  index: number;
  onItemChange: (id: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onAddItemImages: (id: string, files: FileList | null) => void;
  onRemoveItemImage: (supplierId: string, itemId: string, index: number) => void;
  onRemoveItem: (supplierId: string, itemId: string) => void;
}

interface ItemFieldProps {
    label: string;
    name: keyof Item;
    value: string;
    placeholder?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
}

const ItemField: React.FC<ItemFieldProps> = ({ label, name, value, placeholder, onChange, className }) => (
    <div className={`flex items-baseline gap-2 ${className}`}>
        <label className="text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">{label}</label>
        <input
            type="text"
            name={name}
            value={value}
            onChange={onChange}
            placeholder="..."
            className="w-full border-b-2 border-dotted border-gray-300 focus:border-solid focus:border-blue-500 outline-none transition-colors duration-300 pb-1 text-sm bg-transparent text-black"
        />
    </div>
);

export const ItemCard: React.FC<ItemCardProps> = ({ supplierId, item, index, onItemChange, onAddItemImages, onRemoveItemImage, onRemoveItem }) => {
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onItemChange(item.id, e);
  };

  const handleImageFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAddItemImages(item.id, e.target.files);
     // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleTakeImageClick = () => {
    cameraInputRef.current?.click();
  };
  
  const handleGalleryUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    galleryInputRef.current?.click();
  };


  return (
    <div className="p-4 sm:p-6 relative group bg-white hover:bg-gray-50/50 transition-colors">
      {/* Hidden file inputs moved to the top level to prevent event bubbling issues */}
      <input
          type="file"
          ref={galleryInputRef}
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageFilesSelected}
          aria-hidden="true"
      />
      <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageFilesSelected}
          aria-hidden="true"
      />

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-700 bg-gray-200 px-3 py-1 rounded">ITEM {index + 1}</h3>
        <button
            onClick={() => onRemoveItem(supplierId, item.id)}
            className="absolute top-4 right-4 p-2 text-gray-400 rounded-full hover:bg-red-100 hover:text-red-600 transition-opacity"
            aria-label="Remove Item"
        >
            <TrashIcon />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Details */}
        <div className="md:col-span-8 space-y-4">
            <ItemField label="ITEM" name="itemCode" value={item.itemCode} onChange={handleInputChange} />
            <ItemField label="DESCRIPTION" name="description" value={item.description} onChange={handleInputChange} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ItemField label="MOQ" name="moq" value={item.moq} onChange={handleInputChange} />
                <ItemField label="DELIVERY" name="delivery" value={item.delivery} onChange={handleInputChange} />
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ItemField label="PRICE" name="price" value={item.price} onChange={handleInputChange} />
                <ItemField label="COMPOSITION" name="composition" value={item.composition} onChange={handleInputChange} />
            </div>
             <div>
                <label className="text-xs font-bold text-black uppercase tracking-wider">NOTES</label>
                <textarea 
                    name="notes"
                    value={item.notes}
                    onChange={handleInputChange}
                    rows={2}
                    placeholder="..."
                    className="mt-1 w-full text-sm p-2 border-b-2 border-dotted border-gray-300 focus:border-solid focus:border-blue-500 outline-none transition-colors duration-300 rounded-t-md bg-transparent text-black"
                />
             </div>
        </div>

        {/* Right Column: Images */}
        <div className="md:col-span-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-black uppercase tracking-wider">Images</label>
            <button
                onClick={handleGalleryUploadClick}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                aria-label="Upload from gallery"
            >
                <FolderOpenIcon />
                <span>Gallery</span>
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
              {item.images.map((image, idx) => (
                  <ItemImage
                      key={idx}
                      image={image}
                      alt={image.name}
                      onRemove={() => onRemoveItemImage(supplierId, item.id, idx)}
                  />
              ))}
              <button
                  type="button"
                  onClick={handleTakeImageClick}
                  className="relative aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-500 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="mt-2 text-xs text-gray-500 text-center pointer-events-none">Take Photo</span>
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};