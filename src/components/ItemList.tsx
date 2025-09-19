import React from 'react';
import type { Item } from '../types';
import { ItemCard } from './ItemCard';
import { PlusIcon } from './icons';

interface ItemListProps {
  items: Item[];
  onItemChange: (id: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onAddItemImages: (id: string, files: FileList | null) => void;
  onRemoveItemImage: (id: string, index: number) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
}

export const ItemList: React.FC<ItemListProps> = ({ items, onItemChange, onAddItemImages, onRemoveItemImage, onAddItem, onRemoveItem }) => {
  return (
    <div className="divide-y-4 divide-black">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          index={index}
          onItemChange={onItemChange}
          onAddItemImages={onAddItemImages}
          onRemoveItemImage={onRemoveItemImage}
          onRemoveItem={onRemoveItem}
        />
      ))}
      <div className="p-4 sm:p-6 flex justify-center">
        <button
          onClick={onAddItem}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-transform transform hover:scale-105"
        >
          <PlusIcon />
          Add New Item
        </button>
      </div>
    </div>
  );
};
