import React, { useRef } from 'react';
import type { ImageFile } from '../types';
import { CameraIcon } from './icons';
import { useImageLoader } from '../hooks/useImageLoader';

interface ImageUploaderProps {
  label: string;
  image: ImageFile | null;
  onImageSelect: (file: File | null) => void;
  className?: string;
}

const ImageIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);


export const ImageUploader: React.FC<ImageUploaderProps> = ({ label, image, onImageSelect, className }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = React.useId();
  const { dataUrl, isLoading, error } = useImageLoader(image);

  // Debug forzato
  console.log('🖼️ ImageUploader render:', {
    label,
    hasImage: !!image,
    imageName: image?.name,
    driveFileId: image?.driveFileId,
    hookResult: { dataUrl: !!dataUrl, isLoading, error }
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onImageSelect(file || null);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>, action: 'camera' | 'upload') => {
    e.preventDefault(); // Critically, prevent the label's default action from firing.
    e.stopPropagation(); 
    if (action === 'camera') {
      cameraInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };


  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</label>
        <label 
            htmlFor={fileInputId}
            className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-gray-50 transition-all relative group"
        >
            <input
                type="file"
                id={fileInputId}
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />
            <input
                type="file"
                ref={cameraInputRef}
                onChange={handleFileChange}
                accept="image/*"
                capture="environment"
                className="hidden"
            />
            {image ? (
                <>
                    {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-sm text-gray-500">Loading image...</span>
                        </div>
                    ) : error ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                                <ImageIcon />
                                <p className="text-sm text-red-500 mt-2">{error}</p>
                            </div>
                        </div>
                    ) : dataUrl ? (
                        <img src={dataUrl} alt={image.name} className="w-full h-full object-contain p-1" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            type="button" 
                            onClick={(e) => handleButtonClick(e, 'upload')}
                            className="px-4 py-2 text-base font-semibold text-white bg-gray-700/80 rounded-lg hover:bg-gray-600/80"
                        >
                            Change
                        </button>
                        <button 
                            type="button" 
                            onClick={(e) => handleButtonClick(e, 'camera')}
                            className="inline-flex items-center gap-2 px-4 py-2 text-base font-semibold text-white bg-blue-600/80 rounded-lg hover:bg-blue-500/80"
                        >
                            <CameraIcon />
                            Retake
                        </button>
                    </div>
                </>
            ) : (
                <div className="text-center p-4">
                    <ImageIcon />
                    <p className="text-sm text-gray-500 mt-2">Click to upload or</p>
                    <button 
                        type="button" 
                        onClick={(e) => handleButtonClick(e, 'camera')}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-base font-semibold text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    >
                        <CameraIcon />
                        Take Photo
                    </button>
                </div>
            )}
        </label>
    </div>
  );
};