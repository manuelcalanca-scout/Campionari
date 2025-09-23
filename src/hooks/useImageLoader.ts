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
    if (!image) {
      setState({ dataUrl: null, isLoading: false, error: null });
      return;
    }

    // Se l'immagine ha già il dataUrl (formato legacy), usalo
    if (image.dataUrl) {
      setState({ dataUrl: image.dataUrl, isLoading: false, error: null });
      return;
    }

    // Se non ha driveFileId, non può essere caricata
    if (!image.driveFileId) {
      setState({ dataUrl: null, isLoading: false, error: 'No image data available' });
      return;
    }

    // Se ha driveFileId, caricala da Drive
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    googleDrive.loadImageData(image)
      .then(loadedImage => {
        setState({
          dataUrl: loadedImage.dataUrl || null,
          isLoading: false,
          error: loadedImage.dataUrl ? null : 'Failed to load image data'
        });
      })
      .catch(error => {
        console.error('Error loading image:', error);
        setState({
          dataUrl: null,
          isLoading: false,
          error: 'Failed to load image'
        });
      });
  }, [image?.driveFileId, image?.dataUrl]);

  return state;
};