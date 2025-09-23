import type { Supplier, ImageFile } from '../types';
import { googleAuth } from './googleAuth';

// Usa lo stesso pattern di googleAuth.ts
declare global {
  interface Window {
    gapi: any;
  }
}

const gapi = window.gapi;

const APP_FOLDER_NAME = 'Campionari';
const SUPPLIERS_FILE_NAME = 'suppliers.json';
const SHARED_DRIVE_ID = import.meta.env.VITE_SHARED_DRIVE_ID;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

class GoogleDriveService {
  private appFolderId: string | null = null;
  private imagesFolderId: string | null = null;

  private setAuthToken(): void {
    const token = googleAuth.getAccessToken();
    if (token && gapi.client) {
      gapi.client.setToken({ access_token: token });
    }
  }

  async ensureAppFolder(): Promise<string> {
    if (this.appFolderId) return this.appFolderId;

    this.setAuthToken();

    // Se è configurato un Drive condiviso (Team Drive), usa direttamente la sua root
    if (SHARED_DRIVE_ID) {
      this.appFolderId = SHARED_DRIVE_ID;
      return this.appFolderId;
    }

    // Altrimenti, cerca/crea la cartella nel Drive personale
    const response = await gapi.client.drive.files.list({
      q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });

    const folders = response.result.files;
    if (folders && folders.length > 0) {
      this.appFolderId = folders[0].id!;
    } else {
      const createResponse = await gapi.client.drive.files.create({
        resource: {
          name: APP_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        }
      });
      this.appFolderId = createResponse.result.id!;
    }

    return this.appFolderId;
  }

  async ensureImagesFolder(): Promise<string> {
    if (this.imagesFolderId) return this.imagesFolderId;

    // Se stiamo usando un Team Drive, usa direttamente la sua root per le immagini
    if (SHARED_DRIVE_ID) {
      this.imagesFolderId = SHARED_DRIVE_ID;
      return this.imagesFolderId;
    }

    // Altrimenti, per Drive personali, crea/cerca la sottocartella images
    const appFolderId = await this.ensureAppFolder();

    const response = await gapi.client.drive.files.list({
      q: `name='images' and mimeType='application/vnd.google-apps.folder' and '${appFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)'
    });

    const folders = response.result.files;
    if (folders && folders.length > 0) {
      this.imagesFolderId = folders[0].id!;
    } else {
      const createResponse = await gapi.client.drive.files.create({
        resource: {
          name: 'images',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [appFolderId]
        }
      });
      this.imagesFolderId = createResponse.result.id!;
    }

    return this.imagesFolderId;
  }

  async saveSuppliers(suppliers: Supplier[]): Promise<void> {
    // Verifica che gapi sia inizializzato
    if (!gapi.client.drive) {
      throw new Error('Google Drive API not initialized');
    }

    this.setAuthToken();
    const appFolderId = await this.ensureAppFolder();

    // Analizza le dimensioni prima dell'ottimizzazione
    const beforeAnalysis = this.analyzeSuppliersSize(suppliers);
    console.log(`Before optimization: ${Math.round(beforeAnalysis.totalSize / 1024)}KB, ${beforeAnalysis.details}`);

    // Prima ottimizza convertendo immagini base64 in file separati su Drive
    console.log('Converting suppliers to optimized format...');
    const optimizedSuppliers = await this.convertSuppliersToOptimized(suppliers);

    // Poi prepara per il salvataggio rimuovendo dataUrl dai file già su Drive
    const cleanSuppliers = this.prepareSuppliersForSaving(optimizedSuppliers);

    const content = JSON.stringify(cleanSuppliers, null, 2);
    const afterAnalysis = this.analyzeSuppliersSize(cleanSuppliers);
    console.log(`After optimization: ${Math.round(afterAnalysis.totalSize / 1024)}KB, ${afterAnalysis.details}`);
    console.log(`Saving suppliers.json (${Math.round(content.length / 1024)}KB) to Drive...`);

    const queryParams: any = {
      q: `name='${SUPPLIERS_FILE_NAME}' and '${appFolderId}' in parents and trashed=false`,
      fields: 'files(id)'
    };

    if (SHARED_DRIVE_ID) {
      queryParams.supportsAllDrives = true;
      queryParams.includeItemsFromAllDrives = true;
    }

    const response = await gapi.client.drive.files.list(queryParams);

    const files = response.result.files;
    const metadata = {
      name: SUPPLIERS_FILE_NAME,
      parents: [appFolderId]
    };

    const media = {
      mimeType: 'application/json',
      body: content
    };

    if (files && files.length > 0) {
      const updateParams: any = {
        path: `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}`,
        method: 'PATCH',
        params: {
          uploadType: 'media'
        },
        headers: {
          'Content-Type': 'application/json',
        },
        body: content
      };

      if (SHARED_DRIVE_ID) {
        updateParams.params.supportsAllDrives = true;
      }

      await gapi.client.request(updateParams);
    } else {
      const createParams: any = {
        path: 'https://www.googleapis.com/upload/drive/v3/files',
        method: 'POST',
        params: {
          uploadType: 'multipart'
        },
        headers: {
          'Content-Type': 'multipart/related; boundary="foo_bar_baz"'
        },
        body: this.createMultipartBody(metadata, media, 'foo_bar_baz')
      };

      if (SHARED_DRIVE_ID) {
        createParams.params.supportsAllDrives = true;
      }

      await gapi.client.request(createParams);
    }
  }

  async loadSuppliers(): Promise<Supplier[]> {
    try {
      this.setAuthToken();
      const appFolderId = await this.ensureAppFolder();
      
      const queryParams: any = {
        q: `name='${SUPPLIERS_FILE_NAME}' and '${appFolderId}' in parents and trashed=false`,
        fields: 'files(id)'
      };

      if (SHARED_DRIVE_ID) {
        queryParams.supportsAllDrives = true;
        queryParams.includeItemsFromAllDrives = true;
      }

      const response = await gapi.client.drive.files.list(queryParams);

      const files = response.result.files;
      if (!files || files.length === 0) {
        return [];
      }

      const getParams: any = {
        fileId: files[0].id!,
        alt: 'media'
      };

      if (SHARED_DRIVE_ID) {
        getParams.supportsAllDrives = true;
      }

      const fileResponse = await gapi.client.drive.files.get(getParams);

      return JSON.parse(fileResponse.body);
    } catch (error) {
      console.error('Error loading suppliers from Drive:', error);
      return [];
    }
  }

  async uploadImage(imageFile: ImageFile, supplierId: string, type: 'business-card' | 'item'): Promise<string> {
    this.setAuthToken();
    const imagesFolderId = await this.ensureImagesFolder();
    
    const base64Data = imageFile.dataUrl.split(',')[1];
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }

    const fileName = `${supplierId}_${type}_${Date.now()}_${imageFile.name}`;
    const metadata = {
      name: fileName,
      parents: [imagesFolderId]
    };

    const media = {
      mimeType: imageFile.type,
      body: bytes
    };

    const uploadParams: any = {
      path: 'https://www.googleapis.com/upload/drive/v3/files',
      method: 'POST',
      params: {
        uploadType: 'multipart'
      },
      headers: {
        'Content-Type': 'multipart/related; boundary="foo_bar_baz"'
      },
      body: this.createMultipartBody(metadata, media, 'foo_bar_baz')
    };

    if (SHARED_DRIVE_ID) {
      uploadParams.params.supportsAllDrives = true;
    }

    const response = await gapi.client.request(uploadParams);

    return response.result.id;
  }

  async downloadImage(fileId: string): Promise<string> {
    this.setAuthToken();
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });

    return `data:image/jpeg;base64,${btoa(response.body)}`;
  }

  async deleteImage(fileId: string): Promise<void> {
    this.setAuthToken();
    await gapi.client.drive.files.delete({
      fileId: fileId
    });
  }

  async getLastModified(): Promise<string | null> {
    try {
      this.setAuthToken();
      const appFolderId = await this.ensureAppFolder();
      
      const queryParams: any = {
        q: `name='${SUPPLIERS_FILE_NAME}' and '${appFolderId}' in parents and trashed=false`,
        fields: 'files(modifiedTime)'
      };

      if (SHARED_DRIVE_ID) {
        queryParams.supportsAllDrives = true;
        queryParams.includeItemsFromAllDrives = true;
      }

      const response = await gapi.client.drive.files.list(queryParams);

      const files = response.result.files;
      if (!files || files.length === 0) {
        return null;
      }

      return files[0].modifiedTime!;
    } catch (error) {
      console.error('Error getting last modified time:', error);
      return null;
    }
  }

  // Funzione per cancellare TUTTO da Google Drive (reset completo)
  async deleteAllCloudData(): Promise<void> {
    this.setAuthToken();
    const appFolderId = await this.ensureAppFolder();

    try {
      // Lista tutti i file nella cartella (o Team Drive)
      const queryParams: any = {
        q: `'${appFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)'
      };

      if (SHARED_DRIVE_ID) {
        queryParams.supportsAllDrives = true;
        queryParams.includeItemsFromAllDrives = true;
      }

      const response = await gapi.client.drive.files.list(queryParams);
      const files = response.result.files || [];

      console.log(`🗑️ Deleting ${files.length} files from Drive...`);

      // Cancella tutti i file
      for (const file of files) {
        try {
          const deleteParams: any = { fileId: file.id };
          if (SHARED_DRIVE_ID) {
            deleteParams.supportsAllDrives = true;
          }

          await gapi.client.drive.files.delete(deleteParams);
          console.log(`✓ Deleted: ${file.name}`);
        } catch (error) {
          console.error(`✗ Failed to delete ${file.name}:`, error);
        }
      }

      console.log('🗑️ Drive cleanup completed');
    } catch (error) {
      console.error('Error during Drive cleanup:', error);
      throw error;
    }
  }

  // Funzione per pulire immagini base64 rimaste (solo se hanno driveFileId)
  private forceCleanImageData(image: ImageFile): ImageFile {
    if (image.driveFileId && image.dataUrl) {
      console.log(`Force cleaning dataUrl from ${image.name} (has driveFileId: ${image.driveFileId})`);
      const { dataUrl, isLoaded, ...cleanImage } = image;
      return cleanImage;
    }
    return image;
  }

  // Funzione di debug per analizzare le dimensioni
  analyzeSuppliersSize(suppliers: Supplier[]): { totalSize: number, imageCount: number, details: string } {
    const json = JSON.stringify(suppliers, null, 2);
    const totalSize = json.length;
    let imageCount = 0;
    let details = '';

    suppliers.forEach(supplier => {
      if (supplier.headerData.businessCard?.dataUrl) imageCount++;
      supplier.items.forEach(item => {
        imageCount += item.images.filter(img => img.dataUrl).length;
      });
    });

    details = `Total suppliers: ${suppliers.length}, Images with dataUrl: ${imageCount}`;

    return {
      totalSize,
      imageCount,
      details
    };
  }

  // Converte suppliers dal formato legacy a quello ottimizzato
  async convertSuppliersToOptimized(suppliers: Supplier[]): Promise<Supplier[]> {
    const optimizedSuppliers: Supplier[] = [];

    for (const supplier of suppliers) {
      const optimizedSupplier: Supplier = {
        ...supplier,
        headerData: {
          ...supplier.headerData,
          businessCard: supplier.headerData.businessCard
            ? await this.convertImageToOptimized(supplier.headerData.businessCard, supplier.id, 'business-card')
            : null
        },
        items: await Promise.all(supplier.items.map(async (item) => ({
          ...item,
          images: await Promise.all(item.images.map(async (image) =>
            await this.convertImageToOptimized(image, supplier.id, 'item')
          ))
        })))
      };

      optimizedSuppliers.push(optimizedSupplier);
    }

    return optimizedSuppliers;
  }

  // Converte una singola immagine al formato ottimizzato
  private async convertImageToOptimized(
    image: ImageFile,
    supplierId: string,
    type: 'business-card' | 'item'
  ): Promise<ImageFile> {
    // Se già ottimizzata, ritorna così com'è
    if (image.driveFileId) {
      return image;
    }

    // Se ha dataUrl, caricala su Drive
    if (image.dataUrl) {
      console.log(`Converting image ${image.name} to Drive...`);
      try {
        const driveFileId = await this.uploadImage(image, supplierId, type);
        console.log(`✓ Converted ${image.name} → Drive file ${driveFileId}`);
        return {
          name: image.name,
          type: image.type,
          driveFileId: driveFileId,
          isLoaded: false
        };
      } catch (error) {
        console.error(`✗ Failed to convert ${image.name}:`, error);
        // Invece di fallback, riprova una volta
        try {
          console.log(`Retrying conversion of ${image.name}...`);
          const driveFileId = await this.uploadImage(image, supplierId, type);
          console.log(`✓ Retry successful: ${image.name} → Drive file ${driveFileId}`);
          return {
            name: image.name,
            type: image.type,
            driveFileId: driveFileId,
            isLoaded: false
          };
        } catch (retryError) {
          console.error(`✗ Retry failed for ${image.name}:`, retryError);
          // Solo ora usa fallback
          return image;
        }
      }
    }

    return image;
  }

  // Carica i dati dell'immagine quando necessario
  async loadImageData(image: ImageFile): Promise<ImageFile> {
    if (image.dataUrl || !image.driveFileId) {
      return image; // Già caricata o formato legacy
    }

    if (image.isLoaded) {
      return image; // Già caricata in questa sessione
    }

    try {
      const dataUrl = await this.downloadImage(image.driveFileId);
      return {
        ...image,
        dataUrl: dataUrl,
        isLoaded: true
      };
    } catch (error) {
      console.error('Error loading image from Drive:', error);
      return image;
    }
  }

  // Prepara suppliers per il salvataggio (rimuove dataUrl se presente driveFileId)
  private prepareSuppliersForSaving(suppliers: Supplier[]): Supplier[] {
    return suppliers.map(supplier => ({
      ...supplier,
      headerData: {
        ...supplier.headerData,
        businessCard: supplier.headerData.businessCard
          ? this.stripImageDataUrl(supplier.headerData.businessCard)
          : null
      },
      items: supplier.items.map(item => ({
        ...item,
        images: item.images.map(image => this.stripImageDataUrl(image))
      }))
    }));
  }

  private stripImageDataUrl(image: ImageFile): ImageFile {
    // Prima forza pulizia se esistono entrambi
    const cleanedImage = this.forceCleanImageData(image);

    if (cleanedImage.driveFileId) {
      // Se ha driveFileId, rimuovi dataUrl per ridurre dimensioni
      const { dataUrl, isLoaded, ...cleanImage } = cleanedImage;
      return cleanImage;
    }
    return cleanedImage;
  }

  private createMultipartBody(metadata: any, media: any, boundary: string): string {
    const delimiter = '\r\n--' + boundary + '\r\n';
    const close_delim = '\r\n--' + boundary + '--';

    let body = delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + media.mimeType + '\r\n\r\n';

    if (typeof media.body === 'string') {
      body += media.body;
    } else {
      body += String.fromCharCode.apply(null, Array.from(media.body));
    }

    body += close_delim;
    return body;
  }
}

export const googleDrive = new GoogleDriveService();