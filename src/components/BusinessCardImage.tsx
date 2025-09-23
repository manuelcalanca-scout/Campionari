import React from 'react';
import type { ImageFile } from '../types';
import { useImageLoader } from '../hooks/useImageLoader';
import { BuildingStorefrontIcon } from './icons';

interface BusinessCardImageProps {
  businessCard: ImageFile | null;
  className?: string;
}

export const BusinessCardImage: React.FC<BusinessCardImageProps> = ({ businessCard, className = "" }) => {
  const { dataUrl, isLoading, error } = useImageLoader(businessCard);

  console.log('🖼️ BusinessCardImage render:', {
    hasBusinessCard: !!businessCard,
    imageName: businessCard?.name,
    driveFileId: businessCard?.driveFileId,
    hookResult: { dataUrl: !!dataUrl, isLoading, error }
  });

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
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-100 ${className}`}>
        <BuildingStorefrontIcon />
        <p className="mt-2 text-xs text-gray-500">No image data</p>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={businessCard.name}
      className={`w-full h-full object-contain ${className}`}
    />
  );
};