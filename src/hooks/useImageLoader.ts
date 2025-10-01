import { useState, useEffect } from 'react';
import type { ImageFile } from '../types';
import { googleDrive } from '../services/googleDrive';

// Set to true to enable verbose image loading logs (useful for debugging)
const DEBUG_IMAGE_LOADING = false;

export interface ImageLoaderState {
  dataUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useImageLoader = (image: ImageFile | null): ImageLoaderState => {
  const [state, setState] = useState<ImageLoaderState>({
    dataUrl: null,
    isLoading: false,
    error: null
  });

  useEffect(() => {
    if (DEBUG_IMAGE_LOADING) {
      console.log('🖼️ useImageLoader:', {
        hasImage: !!image,
        imageName: image?.name,
        hasDataUrl: !!image?.dataUrl,
        hasDriveFileId: !!image?.driveFileId,
        driveFileId: image?.driveFileId
      });
    }

    if (!image) {
      if (DEBUG_IMAGE_LOADING) console.log('🖼️ No image provided');
      setState({ dataUrl: null, isLoading: false, error: null });
      return;
    }

    // PRIORITÀ 1: Se ha dataUrl (base64), usalo sempre (modalità legacy/fallback)
    if (image.dataUrl) {
      if (DEBUG_IMAGE_LOADING) console.log('🖼️ Using base64 dataUrl for:', image.name);
      setState({ dataUrl: image.dataUrl, isLoading: false, error: null });
      return;
    }

    // PRIORITÀ 2: Se ha solo driveFileId, prova a caricare (modalità ottimizzata)
    if (image.driveFileId) {
      if (DEBUG_IMAGE_LOADING) console.log('🖼️ Attempting to load optimized version from Drive:', image.name);
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      googleDrive.loadImageData(image)
        .then(loadedImage => {
          if (DEBUG_IMAGE_LOADING) {
            console.log('🖼️ Drive load result:', {
              name: image.name,
              success: !!loadedImage.dataUrl,
              dataUrlLength: loadedImage.dataUrl?.length
            });
          }

          if (loadedImage.dataUrl) {
            setState({
              dataUrl: loadedImage.dataUrl,
              isLoading: false,
              error: null
            });
          } else {
            setState({
              dataUrl: null,
              isLoading: false,
              error: 'Failed to load optimized image'
            });
          }
        })
        .catch(error => {
          console.error('🖼️ Error loading optimized image:', image.name, error);
          setState({
            dataUrl: null,
            isLoading: false,
            error: 'Failed to load image from Drive'
          });
        });
      return;
    }

    // PRIORITÀ 3: Nessun dato disponibile
    if (DEBUG_IMAGE_LOADING) console.log('🖼️ No image data available for:', image.name);
    setState({ dataUrl: null, isLoading: false, error: 'No image data available' });
  }, [image?.driveFileId, image?.dataUrl]);

  return state;
};