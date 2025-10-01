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
const SUPPLIERS_FILE_NAME = 'suppliers.json'; // LEGACY: Not used with granular storage
const SUPPLIERS_INDEX_FILE_NAME = 'suppliers-index.json'; // New architecture
const SHARED_DRIVE_ID = import.meta.env.VITE_SHARED_DRIVE_ID;

// Nuova architettura: JSON separati per ogni fornitore
export interface SupplierIndex {
  suppliers: {
    id: string;
    name: string;
    lastModified: string;
    fileId?: string; // ID del file supplier-{id}.json su Drive
  }[];
  lastUpdated: string;
}

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

  // === NUOVE FUNZIONI PER ARCHITETTURA JSON SEPARATI ===

  async loadSuppliersIndex(): Promise<SupplierIndex> {
    try {
      this.setAuthToken();
      const appFolderId = await this.ensureAppFolder();

      const queryParams: any = {
        q: `name='${SUPPLIERS_INDEX_FILE_NAME}' and '${appFolderId}' in parents and trashed=false`,
        fields: 'files(id)'
      };

      if (SHARED_DRIVE_ID) {
        queryParams.supportsAllDrives = true;
        queryParams.includeItemsFromAllDrives = true;
      }

      const response = await gapi.client.drive.files.list(queryParams);
      const files = response.result.files;

      if (!files || files.length === 0) {
        // File indice non esiste, crea uno vuoto
        const emptyIndex: SupplierIndex = {
          suppliers: [],
          lastUpdated: new Date().toISOString()
        };
        return emptyIndex;
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
      console.error('Error loading suppliers index:', error);
      return {
        suppliers: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async saveSuppliersIndex(index: SupplierIndex): Promise<void> {
    this.setAuthToken();
    const appFolderId = await this.ensureAppFolder();

    const content = JSON.stringify(index, null, 2);
    console.log(`Saving suppliers index (${Math.round(content.length / 1024)}KB)...`);

    const queryParams: any = {
      q: `name='${SUPPLIERS_INDEX_FILE_NAME}' and '${appFolderId}' in parents and trashed=false`,
      fields: 'files(id)'
    };

    if (SHARED_DRIVE_ID) {
      queryParams.supportsAllDrives = true;
      queryParams.includeItemsFromAllDrives = true;
    }

    const response = await gapi.client.drive.files.list(queryParams);
    const files = response.result.files;
    const metadata = {
      name: SUPPLIERS_INDEX_FILE_NAME,
      parents: [appFolderId]
    };

    if (files && files.length > 0) {
      // Update esistente
      const updateParams: any = {
        path: `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: content
      };

      if (SHARED_DRIVE_ID) {
        updateParams.params.supportsAllDrives = true;
      }

      await gapi.client.request(updateParams);
    } else {
      // Crea nuovo
      const createParams: any = {
        path: 'https://www.googleapis.com/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary="foo_bar_baz"' },
        body: this.createMultipartBody(metadata, { mimeType: 'application/json', body: content }, 'foo_bar_baz')
      };

      if (SHARED_DRIVE_ID) {
        createParams.params.supportsAllDrives = true;
      }

      await gapi.client.request(createParams);
    }
  }

  // LEGACY: Only used by loadSuppliersNew (also legacy). Use loadSupplierComplete instead.
  async loadSingleSupplier(supplierId: string): Promise<Supplier | null> {
    try {
      this.setAuthToken();
      const appFolderId = await this.ensureAppFolder();

      const fileName = `supplier-${supplierId}.json`;
      const queryParams: any = {
        q: `name='${fileName}' and '${appFolderId}' in parents and trashed=false`,
        fields: 'files(id)'
      };

      if (SHARED_DRIVE_ID) {
        queryParams.supportsAllDrives = true;
        queryParams.includeItemsFromAllDrives = true;
      }

      const response = await gapi.client.drive.files.list(queryParams);
      const files = response.result.files;

      if (!files || files.length === 0) {
        console.log(`Supplier file ${fileName} not found`);
        return null;
      }

      const getParams: any = {
        fileId: files[0].id!,
        alt: 'media'
      };

      if (SHARED_DRIVE_ID) {
        getParams.supportsAllDrives = true;
      }

      const fileResponse = await gapi.client.drive.files.get(getParams);
      const supplier = JSON.parse(fileResponse.body);
      console.log(`✓ Loaded supplier ${supplier.name} (${Math.round(fileResponse.body.length / 1024)}KB)`);
      return supplier;
    } catch (error) {
      console.error(`Error loading supplier ${supplierId}:`, error);
      return null;
    }
  }

  async saveSingleSupplier(supplier: Supplier): Promise<void> {
    this.setAuthToken();
    const appFolderId = await this.ensureAppFolder();

    const fileName = `supplier-${supplier.id}.json`;
    const content = JSON.stringify(supplier, null, 2);
    console.log(`Saving ${supplier.name} (${Math.round(content.length / 1024)}KB)...`);

    const queryParams: any = {
      q: `name='${fileName}' and '${appFolderId}' in parents and trashed=false`,
      fields: 'files(id)'
    };

    if (SHARED_DRIVE_ID) {
      queryParams.supportsAllDrives = true;
      queryParams.includeItemsFromAllDrives = true;
    }

    const response = await gapi.client.drive.files.list(queryParams);
    const files = response.result.files;
    const metadata = {
      name: fileName,
      parents: [appFolderId]
    };

    if (files && files.length > 0) {
      // Update esistente
      const updateParams: any = {
        path: `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: content
      };

      if (SHARED_DRIVE_ID) {
        updateParams.params.supportsAllDrives = true;
      }

      await gapi.client.request(updateParams);
    } else {
      // Crea nuovo
      const createParams: any = {
        path: 'https://www.googleapis.com/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary="foo_bar_baz"' },
        body: this.createMultipartBody(metadata, { mimeType: 'application/json', body: content }, 'foo_bar_baz')
      };

      if (SHARED_DRIVE_ID) {
        createParams.params.supportsAllDrives = true;
      }

      await gapi.client.request(createParams);
    }
  }

  // === FUNZIONI LEGACY (MANTENIAMO PER COMPATIBILITÀ) ===

  // LEGACY: Not used - kept for reference only. Use saveSupplierHeader/saveSupplierItem instead.
  async saveSuppliers(suppliers: Supplier[]): Promise<void> {
    // Verifica che gapi sia inizializzato
    if (!gapi.client.drive) {
      throw new Error('Google Drive API not initialized');
    }

    this.setAuthToken();
    const appFolderId = await this.ensureAppFolder();

    // Salva tutto con base64 embedded (sistema stabile)
    const content = JSON.stringify(suppliers, null, 2);
    const analysis = this.analyzeSuppliersSize(suppliers);
    console.log(`💾 Saving suppliers.json: ${Math.round(content.length / 1024)}KB with ${analysis.imageCount} images (base64 embedded)`);

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

  // === NUOVE FUNZIONI HIGH-LEVEL PER IL NUOVO SISTEMA ===

  async loadSuppliersIndexOnly(): Promise<SupplierIndex> {
    console.log('📚 Loading suppliers index only (lazy mode)...');
    const index = await this.loadSuppliersIndex();
    console.log(`📋 Index loaded: ${index.suppliers.length} suppliers (${JSON.stringify(index).length} bytes)`);
    return index;
  }

  // LEGACY: Not used - kept for reference only. Use loadSuppliersGranular instead.
  async loadSuppliersNew(): Promise<Supplier[]> {
    console.log('📚 Loading ALL suppliers (full load - use only for migration)...');
    try {
      // 1. Carica l'indice
      const index = await this.loadSuppliersIndex();
      console.log(`📋 Index loaded: ${index.suppliers.length} suppliers`);

      // 2. Carica tutti i fornitori individuali
      const suppliers: Supplier[] = [];
      for (const supplierRef of index.suppliers) {
        console.log(`📄 Loading ${supplierRef.name}...`);
        const supplier = await this.loadSingleSupplier(supplierRef.id);
        if (supplier) {
          suppliers.push(supplier);
        } else {
          console.warn(`⚠️ Could not load supplier ${supplierRef.name}`);
        }
      }

      console.log(`✅ Loaded ${suppliers.length} suppliers successfully`);
      return suppliers;
    } catch (error) {
      console.error('Error loading suppliers with new system:', error);
      return [];
    }
  }

  async saveSuppliersNew(suppliers: Supplier[], dirtySupplierIds?: Set<string>): Promise<void> {
    console.log('💾 Saving suppliers with new architecture...');

    // Se non sono specificati ID "sporchi", salva tutti
    const shouldSaveAll = !dirtySupplierIds || dirtySupplierIds.size === 0;

    if (shouldSaveAll) {
      console.log('⚠️ Saving ALL suppliers (no dirty tracking)');
    } else {
      console.log(`✅ Saving only ${dirtySupplierIds.size} modified supplier(s)`);
    }

    try {
      // 1. Salva solo i fornitori modificati (o tutti se non specificato)
      for (const supplier of suppliers) {
        if (shouldSaveAll || dirtySupplierIds!.has(supplier.id)) {
          console.log(`💾 Saving ${supplier.name}...`);
          await this.saveSingleSupplier(supplier);
        } else {
          console.log(`⏭️ Skipping ${supplier.name} (not modified)`);
        }
      }

      // 2. Carica l'indice esistente per preservare lastModified
      const existingIndex = await this.loadSuppliersIndex();
      const existingMap = new Map(existingIndex.suppliers.map(s => [s.id, s.lastModified]));

      // 3. Aggiorna l'indice (solo lastModified dei fornitori salvati)
      const now = new Date().toISOString();
      const index: SupplierIndex = {
        suppliers: suppliers.map(s => ({
          id: s.id,
          name: s.name,
          // Aggiorna lastModified solo se questo fornitore è stato salvato
          lastModified: (shouldSaveAll || dirtySupplierIds!.has(s.id))
            ? now
            : (existingMap.get(s.id) || now) // Mantieni il vecchio lastModified
        })),
        lastUpdated: now
      };

      await this.saveSuppliersIndex(index);
      console.log('✅ Suppliers and index saved successfully');
    } catch (error) {
      console.error('Error saving suppliers with new system:', error);
      throw error;
    }
  }

  // === FUNZIONI LEGACY (MANTENIAMO PER BACKWARD COMPATIBILITY) ===

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
    const fileId = response.result.id;

    // Rendi il file pubblicamente accessibile per URL diretti
    await this.makeFilePublic(fileId);

    return fileId;
  }

  async downloadImage(fileId: string): Promise<string> {
    console.log('📥 Downloading image from Drive, fileId:', fileId);
    this.setAuthToken();

    try {
      // Use XMLHttpRequest for better binary handling
      const accessToken = gapi.auth.getToken().access_token;

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.responseType = 'arraybuffer';

        xhr.onload = () => {
          if (xhr.status === 200) {
            console.log('📥 XHR response:', {
              status: xhr.status,
              responseType: xhr.responseType,
              bufferSize: xhr.response.byteLength
            });

            // Convert ArrayBuffer to base64
            const arrayBuffer = xhr.response;
            const uint8Array = new Uint8Array(arrayBuffer);

            console.log('📥 First 10 bytes:', Array.from(uint8Array.slice(0, 10)));

            // Convert to binary string
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binaryString += String.fromCharCode(uint8Array[i]);
            }

            const base64Data = btoa(binaryString);
            const dataUrl = `data:image/jpeg;base64,${base64Data}`;

            console.log('📥 Base64 sample:', base64Data.substring(0, 50));
            console.log('📥 Created dataUrl, length:', dataUrl.length, 'prefix:', dataUrl.substring(0, 50));

            // Validate base64
            const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data);
            console.log('📥 Base64 validation:', isValidBase64);

            // Try to decode and re-encode to test validity
            try {
              const testDecode = atob(base64Data.substring(0, 100));
              console.log('📥 Base64 decode test: SUCCESS, first 10 bytes:', Array.from(testDecode.substring(0, 10)).map(c => c.charCodeAt(0)));
            } catch (e) {
              console.error('📥 Base64 decode test: FAILED', e);
            }

            resolve(dataUrl);
          } else {
            reject(new Error(`HTTP error! status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send();
      });
    } catch (error) {
      console.error('📥 Download failed:', error);
      throw error;
    }
  }

  async makeFilePublic(fileId: string): Promise<void> {
    try {
      const permissionParams: any = {
        path: `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      };

      if (SHARED_DRIVE_ID) {
        permissionParams.params = { supportsAllDrives: true };
      }

      await gapi.client.request(permissionParams);
      console.log(`✓ Made file ${fileId} publicly accessible`);
    } catch (error) {
      console.error(`Failed to make file ${fileId} public:`, error);
      // Non bloccare l'upload se i permessi falliscono
    }
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

  // Funzione per rendere pubblici tutti i file immagine esistenti
  async makeAllImagesPublic(): Promise<void> {
    this.setAuthToken();
    const appFolderId = await this.ensureAppFolder();

    try {
      // Lista tutti i file immagine nella cartella (o Team Drive)
      const queryParams: any = {
        q: `'${appFolderId}' in parents and (mimeType contains 'image/' or name contains '.jpg' or name contains '.png' or name contains '.jpeg') and trashed=false`,
        fields: 'files(id, name)'
      };

      if (SHARED_DRIVE_ID) {
        queryParams.supportsAllDrives = true;
        queryParams.includeItemsFromAllDrives = true;
      }

      const response = await gapi.client.drive.files.list(queryParams);
      const files = response.result.files || [];

      console.log(`🔓 Making ${files.length} image files public...`);

      // Rendi pubblici tutti i file immagine
      for (const file of files) {
        try {
          await this.makeFilePublic(file.id);
          console.log(`✓ Made public: ${file.name}`);
        } catch (error) {
          console.error(`✗ Failed to make public ${file.name}:`, error);
        }
      }

      console.log('🔓 All images made public');
    } catch (error) {
      console.error('Error making images public:', error);
      throw error;
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
        // MANTIENI base64 come fallback + aggiungi driveFileId per ottimizzazione
        return {
          ...image, // Mantiene dataUrl originale
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
            ...image, // Mantiene dataUrl originale
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
    // NUOVO APPROCCIO: Non rimuovere mai base64, usalo come fallback
    if (image.driveFileId && image.dataUrl) {
      // Ha entrambi - mantieni entrambi per robustezza
      console.log(`Keeping both base64 and Drive ID for ${image.name}`);
      return image;
    }
    return image;
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

  // ==========================================
  // GRANULAR STORAGE: Header + Item Files
  // ==========================================

  /**
   * Find files by name prefix
   */
  private async findFilesByPrefix(prefix: string): Promise<Array<{ id: string; name: string }>> {
    const appFolderId = await this.ensureAppFolder();

    const queryParams: any = {
      q: `name contains '${prefix}' and '${appFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
    };

    if (SHARED_DRIVE_ID) {
      queryParams.supportsAllDrives = true;
      queryParams.includeItemsFromAllDrives = true;
    }

    const response = await gapi.client.drive.files.list(queryParams);
    return response.result.files || [];
  }

  /**
   * Find single file by exact name
   */
  private async findFileByName(fileName: string): Promise<{ id: string; name: string } | null> {
    const appFolderId = await this.ensureAppFolder();

    const queryParams: any = {
      q: `name='${fileName}' and '${appFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
    };

    if (SHARED_DRIVE_ID) {
      queryParams.supportsAllDrives = true;
      queryParams.includeItemsFromAllDrives = true;
    }

    const response = await gapi.client.drive.files.list(queryParams);
    const files = response.result.files;

    return files && files.length > 0 ? files[0] : null;
  }

  /**
   * Create or update file with content
   */
  private async createOrUpdateFile(fileName: string, content: string): Promise<void> {
    const appFolderId = await this.ensureAppFolder();
    const existingFile = await this.findFileByName(fileName);

    const metadata = {
      name: fileName,
      parents: [appFolderId]
    };

    if (existingFile) {
      // Update existing file
      const updateParams: any = {
        path: `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: content
      };

      if (SHARED_DRIVE_ID) {
        updateParams.params.supportsAllDrives = true;
      }

      await gapi.client.request(updateParams);
    } else {
      // Create new file
      const createParams: any = {
        path: 'https://www.googleapis.com/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary="foo_bar_baz"' },
        body: this.createMultipartBody(metadata, { mimeType: 'application/json', body: content }, 'foo_bar_baz')
      };

      if (SHARED_DRIVE_ID) {
        createParams.params.supportsAllDrives = true;
      }

      await gapi.client.request(createParams);
    }
  }

  /**
   * Download file content by file ID
   */
  private async downloadFileContent(fileId: string): Promise<string> {
    const getParams: any = {
      fileId,
      alt: 'media'
    };

    if (SHARED_DRIVE_ID) {
      getParams.supportsAllDrives = true;
    }

    const response = await gapi.client.drive.files.get(getParams);
    return response.body;
  }

  /**
   * Delete file by file ID
   */
  private async deleteFileById(fileId: string): Promise<void> {
    const deleteParams: any = {
      path: `https://www.googleapis.com/drive/v3/files/${fileId}`,
      method: 'DELETE'
    };

    if (SHARED_DRIVE_ID) {
      deleteParams.params = { supportsAllDrives: true };
    }

    await gapi.client.request(deleteParams);
  }

  // ==========================================
  // HEADER OPERATIONS
  // ==========================================

  async saveSupplierHeader(supplierId: string, name: string, headerData: any, itemOrder?: string[]): Promise<void> {
    this.setAuthToken();
    const fileName = `supplier-${supplierId}-header.json`;

    // Include itemOrder in headerData if provided
    const headerWithOrder = itemOrder
      ? { ...headerData, itemOrder }
      : headerData;

    const content = JSON.stringify({ id: supplierId, name, headerData: headerWithOrder }, null, 2);

    console.log(`💾 Saving header for ${name} (${Math.round(content.length / 1024)}KB)...`);
    await this.createOrUpdateFile(fileName, content);
  }

  async loadSupplierHeader(supplierId: string): Promise<{ name: string; headerData: any } | null> {
    try {
      this.setAuthToken();
      const fileName = `supplier-${supplierId}-header.json`;
      const file = await this.findFileByName(fileName);

      if (!file) {
        console.log(`Header file ${fileName} not found`);
        return null;
      }

      const content = await this.downloadFileContent(file.id);
      const parsed = JSON.parse(content);
      return { name: parsed.name, headerData: parsed.headerData };
    } catch (error) {
      console.error(`Error loading header for ${supplierId}:`, error);
      return null;
    }
  }

  async deleteSupplierHeader(supplierId: string): Promise<void> {
    this.setAuthToken();
    const fileName = `supplier-${supplierId}-header.json`;
    const file = await this.findFileByName(fileName);

    if (file) {
      await this.deleteFileById(file.id);
      console.log(`🗑️ Deleted header: ${fileName}`);
    }
  }

  // ==========================================
  // ITEM OPERATIONS
  // ==========================================

  async saveSupplierItem(supplierId: string, item: any): Promise<void> {
    this.setAuthToken();
    const fileName = `supplier-${supplierId}-item-${item.id}.json`;
    const content = JSON.stringify({ ...item, supplierId }, null, 2);

    console.log(`💾 Saving item ${item.itemCode || 'untitled'} (${Math.round(content.length / 1024)}KB)...`);
    await this.createOrUpdateFile(fileName, content);
  }

  async loadSupplierItem(supplierId: string, itemId: string): Promise<any | null> {
    try {
      this.setAuthToken();
      const fileName = `supplier-${supplierId}-item-${itemId}.json`;
      const file = await this.findFileByName(fileName);

      if (!file) {
        console.log(`Item file ${fileName} not found`);
        return null;
      }

      const content = await this.downloadFileContent(file.id);
      const parsed = JSON.parse(content);

      // Remove supplierId from item (denormalize)
      const { supplierId: _, ...item } = parsed;
      return item;
    } catch (error) {
      console.error(`Error loading item ${itemId}:`, error);
      return null;
    }
  }

  async loadAllSupplierItems(supplierId: string): Promise<any[]> {
    try {
      this.setAuthToken();
      const prefix = `supplier-${supplierId}-item-`;
      const files = await this.findFilesByPrefix(prefix);

      console.log(`📄 Loading ${files.length} items for supplier ${supplierId}...`);

      const items = await Promise.all(
        files.map(async (file) => {
          const content = await this.downloadFileContent(file.id);
          const parsed = JSON.parse(content);
          const { supplierId: _, ...item } = parsed;
          return item;
        })
      );

      return items;
    } catch (error) {
      console.error(`Error loading items for ${supplierId}:`, error);
      return [];
    }
  }

  async deleteSupplierItem(supplierId: string, itemId: string): Promise<void> {
    this.setAuthToken();
    const fileName = `supplier-${supplierId}-item-${itemId}.json`;
    const file = await this.findFileByName(fileName);

    if (file) {
      await this.deleteFileById(file.id);
      console.log(`🗑️ Deleted item: ${fileName}`);
    }

    // Remove from index
    await this.removeItemFromIndex(supplierId, itemId);
  }

  async deleteAllSupplierItems(supplierId: string): Promise<void> {
    this.setAuthToken();
    const prefix = `supplier-${supplierId}-item-`;
    const files = await this.findFilesByPrefix(prefix);

    console.log(`🗑️ Deleting ${files.length} items for supplier ${supplierId}...`);

    await Promise.all(files.map(file => this.deleteFileById(file.id)));
  }

  // ==========================================
  // FULL SUPPLIER OPERATIONS
  // ==========================================

  /**
   * Sort items by saved order from headerData.itemOrder
   * Falls back to original array order if itemOrder is not available
   */
  private sortItemsByOrder(items: any[], itemOrder?: string[]): any[] {
    if (!itemOrder || itemOrder.length === 0) {
      return items;
    }

    // Create a map of itemId -> item for fast lookup
    const itemMap = new Map(items.map(item => [item.id, item]));

    // Build sorted array based on itemOrder
    const sortedItems: any[] = [];

    // Add items in the order specified by itemOrder
    for (const itemId of itemOrder) {
      const item = itemMap.get(itemId);
      if (item) {
        sortedItems.push(item);
        itemMap.delete(itemId); // Remove to track what's left
      }
    }

    // Append any items not in itemOrder (new items added since last save)
    itemMap.forEach(item => sortedItems.push(item));

    return sortedItems;
  }

  async loadSupplierComplete(supplierId: string): Promise<Supplier | null> {
    try {
      this.setAuthToken();

      const header = await this.loadSupplierHeader(supplierId);
      if (!header) return null;

      const items = await this.loadAllSupplierItems(supplierId);

      // Sort items according to saved order
      const sortedItems = this.sortItemsByOrder(items, header.headerData.itemOrder);

      return {
        id: supplierId,
        name: header.name,
        headerData: header.headerData,
        items: sortedItems
      };
    } catch (error) {
      console.error(`Error loading complete supplier ${supplierId}:`, error);
      return null;
    }
  }

  async deleteSupplierComplete(supplierId: string): Promise<void> {
    this.setAuthToken();

    console.log(`🗑️ Deleting complete supplier ${supplierId}...`);

    // Delete header
    await this.deleteSupplierHeader(supplierId);

    // Delete all items
    await this.deleteAllSupplierItems(supplierId);

    // Remove from index
    await this.removeSupplierFromIndex(supplierId);

    console.log(`✅ Supplier ${supplierId} deleted completely`);
  }

  // ==========================================
  // GRANULAR INDEX MANAGEMENT
  // ==========================================

  async saveGranularIndexSelective(
    suppliers: Supplier[],
    dirtyHeaders: Set<string>,
    dirtyItems: Map<string, Set<string>>
  ): Promise<void> {
    this.setAuthToken();

    // Load existing index to preserve timestamps
    const existingIndex = await this.loadSuppliersIndex();
    const existingMap = new Map(existingIndex.suppliers.map((s: any) => [s.id, s]));

    const now = new Date().toISOString();

    const index = {
      suppliers: suppliers.map(s => {
        const existing = existingMap.get(s.id);
        const headerModified = dirtyHeaders.has(s.id);
        const itemsDirty = dirtyItems.get(s.id) || new Set();

        return {
          id: s.id,
          name: s.name,
          headerLastModified: headerModified ? now : (existing?.headerLastModified || now),
          items: s.items.map((item: any) => {
            const itemModified = itemsDirty.has(item.id);
            const existingItem = existing?.items?.find((i: any) => i.id === item.id);

            return {
              id: item.id,
              itemCode: item.itemCode,
              lastModified: itemModified ? now : (existingItem?.lastModified || now)
            };
          })
        };
      }),
      lastUpdated: now
    };

    await this.createOrUpdateFile('suppliers-index.json', JSON.stringify(index, null, 2));
    console.log('📋 Granular index updated');
  }

  async removeSupplierFromIndex(supplierId: string): Promise<void> {
    this.setAuthToken();

    try {
      // Load existing index
      const existingIndex = await this.loadSuppliersIndex();

      // Remove supplier from index
      const updatedIndex = {
        suppliers: existingIndex.suppliers.filter((s: any) => s.id !== supplierId),
        lastUpdated: new Date().toISOString()
      };

      await this.createOrUpdateFile('suppliers-index.json', JSON.stringify(updatedIndex, null, 2));
      console.log(`📋 Removed supplier ${supplierId} from index`);
    } catch (error) {
      console.error('Error removing supplier from index:', error);
      throw error;
    }
  }

  async removeItemFromIndex(supplierId: string, itemId: string): Promise<void> {
    this.setAuthToken();

    try {
      // Load existing index
      const existingIndex = await this.loadSuppliersIndex();

      // Update supplier to remove item
      const updatedIndex = {
        suppliers: existingIndex.suppliers.map((s: any) => {
          if (s.id === supplierId) {
            return {
              ...s,
              items: s.items.filter((item: any) => item.id !== itemId)
            };
          }
          return s;
        }),
        lastUpdated: new Date().toISOString()
      };

      await this.createOrUpdateFile('suppliers-index.json', JSON.stringify(updatedIndex, null, 2));
      console.log(`📋 Removed item ${itemId} from index`);
    } catch (error) {
      console.error('Error removing item from index:', error);
      throw error;
    }
  }

  // ==========================================
  // GRANULAR ARCHITECTURE (Current Active System)
  // ==========================================

  /**
   * Load all suppliers with GRANULAR architecture
   * This is the ACTIVE loading method used by the app.
   */
  async loadSuppliersGranular(): Promise<Supplier[]> {
    try {
      this.setAuthToken();

      // Load index
      const index = await this.loadSuppliersIndex();
      console.log(`📚 Loading suppliers with GRANULAR architecture...`);
      console.log(`📋 Index contains ${index.suppliers.length} suppliers`);

      // Load each supplier completely (header + all items)
      const suppliers: Supplier[] = [];

      for (const supplierMeta of index.suppliers) {
        console.log(`📄 Loading ${supplierMeta.name} (granular)...`);
        const supplier = await this.loadSupplierComplete(supplierMeta.id);

        if (supplier) {
          suppliers.push(supplier);
          console.log(`✓ Loaded ${supplier.name} (${supplier.items.length} items)`);
        } else {
          console.warn(`⚠️ Could not load supplier ${supplierMeta.name} (granular)`);
        }
      }

      console.log(`✅ Loaded ${suppliers.length} suppliers successfully (GRANULAR)`);
      return suppliers;

    } catch (error) {
      console.error('Error loading suppliers with granular architecture:', error);
      return [];
    }
  }

  /**
   * LEGACY: Migration from monolithic to granular structure
   * NOT USED - Migration already completed. Kept for reference only.
   */
  async migrateToGranularStructure(): Promise<void> {
    console.log('🔄 Starting migration to granular structure...');

    try {
      this.setAuthToken();

      // 1. Load all suppliers with old architecture
      const suppliers = await this.loadSuppliersNew();

      if (suppliers.length === 0) {
        console.log('ℹ️ No suppliers to migrate');
        return;
      }

      console.log(`📦 Found ${suppliers.length} suppliers to migrate`);

      // 2. For each supplier, create header + items
      for (const supplier of suppliers) {
        console.log(`🔄 Migrating ${supplier.name}...`);

        // Save header
        await this.saveSupplierHeader(supplier.id, supplier.name, supplier.headerData);
        console.log(`  ✓ Header saved`);

        // Save each item
        for (const item of supplier.items) {
          await this.saveSupplierItem(supplier.id, item);
          console.log(`  ✓ Item ${item.itemCode || 'untitled'} saved`);
        }

        // Delete old monolithic file
        const oldFileName = `supplier-${supplier.id}.json`;
        const oldFile = await this.findFileByName(oldFileName);
        if (oldFile) {
          await this.deleteFileById(oldFile.id);
          console.log(`  🗑️ Old monolithic file deleted`);
        }
      }

      // 3. Update index with granular structure
      const dirtyHeaders = new Set(suppliers.map(s => s.id));
      const dirtyItems = new Map(
        suppliers.map(s => [s.id, new Set(s.items.map((i: any) => i.id))])
      );

      await this.saveGranularIndexSelective(suppliers, dirtyHeaders, dirtyItems);
      console.log('📋 Index updated');

      console.log('✅ Migration completed successfully!');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw new Error('Migration failed. Old files preserved for safety.');
    }
  }
}

export const googleDrive = new GoogleDriveService();