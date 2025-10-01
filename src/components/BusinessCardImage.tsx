import React from 'react';
import type { ImageFile } from '../types';
import { useImageLoader } from '../hooks/useImageLoader';
import { BuildingStorefrontIcon } from './icons';

// Set to true to enable verbose rendering logs (useful for debugging)
const DEBUG_RENDER = false;

interface BusinessCardImageProps {
  businessCard: ImageFile | null;
  className?: string;
}

export const BusinessCardImage: React.FC<BusinessCardImageProps> = ({ businessCard, className = "" }) => {
  const { dataUrl, isLoading, error } = useImageLoader(businessCard);

  if (DEBUG_RENDER) {
    console.log('🖼️ BusinessCardImage render:', {
      hasBusinessCard: !!businessCard,
      imageName: businessCard?.name,
      driveFileId: businessCard?.driveFileId,
      hookResult: { dataUrl: !!dataUrl, isLoading, error }
    });
  }

  if (!businessCard) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-100 ${className}`}>
        <BuildingStorefrontIcon />
        <p className="mt-2 text-xs text-gray-500">No business card</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-100 ${className}`}>
        <BuildingStorefrontIcon />
        <p className="mt-2 text-xs text-red-500">Error loading card</p>
      </div>
    );
  }

  if (!dataUrl) {
    // TEST: Show a simple test image to verify img tag works
    const testImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwNzBmMyIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VEVTVDI8L3RleHQ+PC9zdmc+";

    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-100 ${className}`}>
        <img src={testImage} alt="test" className="w-16 h-16 mb-2" />
        <p className="mt-2 text-xs text-gray-500">No image data</p>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={businessCard.name}
      className={`w-full h-full object-contain ${className}`}
      onError={(e) => {
        console.error('🖼️ Image failed to load:', e);
        console.error('🖼️ Failed dataUrl:', dataUrl.substring(0, 100));
      }}
      onLoad={() => {
        if (DEBUG_RENDER) console.log('🖼️ Image loaded successfully:', businessCard.name);
      }}
    />
  );
};