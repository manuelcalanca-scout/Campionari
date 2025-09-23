import React from 'react';
import type { ImageFile } from '../types';
import { useImageLoader } from '../hooks/useImageLoader';

interface ItemImageProps {
  image: ImageFile;
  alt: string;
  onRemove: () => void;
}

export const ItemImage: React.FC<ItemImageProps> = ({ image, alt, onRemove }) => {
  const { dataUrl, isLoading, error } = useImageLoader(image);

  console.log('🖼️ ItemImage render:', {
    imageName: image.name,
    driveFileId: image.driveFileId,
    hookResult: { dataUrl: !!dataUrl, isLoading, error }
  });

  return (
    <div className="relative group aspect-square">
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md border border-gray-200">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md border border-gray-200">
          <div className="text-xs text-red-500 text-center p-1">
            Error loading image
          </div>
        </div>
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt={alt}
          className="w-full h-full object-cover rounded-md border border-gray-200"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md border border-gray-200">
          <div className="text-xs text-gray-500 text-center p-1">
            No image
          </div>
        </div>
      )}

      <button
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
        aria-label="Remove image"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};