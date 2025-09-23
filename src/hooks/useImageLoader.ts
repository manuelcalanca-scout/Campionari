import { useState, useEffect } from 'react';
import type { ImageFile } from '../types';
import { googleDrive } from '../services/googleDrive';

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
    console.log('🖼️ useImageLoader:', {
      hasImage: !!image,
      imageName: image?.name,
      hasDataUrl: !!image?.dataUrl,
      hasDriveFileId: !!image?.driveFileId,
      driveFileId: image?.driveFileId
    });

    if (!image) {
      console.log('🖼️ No image provided');
      setState({ dataUrl: null, isLoading: false, error: null });
      return;
    }

    // Se l'immagine ha già il dataUrl (formato legacy), usalo
    if (image.dataUrl) {
      console.log('🖼️ Using existing dataUrl for:', image.name);
      setState({ dataUrl: image.dataUrl, isLoading: false, error: null });
      return;
    }

    // Se non ha driveFileId, non può essere caricata
    if (!image.driveFileId) {
      console.log('🖼️ No driveFileId for:', image.name);
      setState({ dataUrl: null, isLoading: false, error: 'No image data available' });
      return;
    }

    // Se ha driveFileId, caricala da Drive
    console.log('🖼️ Loading from Drive:', image.name, 'ID:', image.driveFileId);
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    googleDrive.loadImageData(image)
      .then(loadedImage => {
        console.log('🖼️ Drive load result:', {
          name: image.name,
          success: !!loadedImage.dataUrl,
          dataUrlLength: loadedImage.dataUrl?.length
        });
        setState({
          dataUrl: loadedImage.dataUrl || null,
          isLoading: false,
          error: loadedImage.dataUrl ? null : 'Failed to load image data'
        });
      })
      .catch(error => {
        console.error('🖼️ Error loading image:', image.name, error);
        setState({
          dataUrl: null,
          isLoading: false,
          error: 'Failed to load image'
        });
      });
  }, [image?.driveFileId, image?.dataUrl]);

  return state;
};