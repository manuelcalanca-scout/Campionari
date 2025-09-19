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

    // Se è configurato un Drive condiviso, usa quello come parent
    if (SHARED_DRIVE_ID) {
      // Se SHARED_DRIVE_ID è l'ID di una cartella condivisa, usala direttamente
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

    const appFolderId = await this.ensureAppFolder();

    // Se stiamo usando la cartella condivisa direttamente, crea la sottocartella images
    const queryParams: any = {
      q: `name='images' and mimeType='application/vnd.google-apps.folder' and '${appFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)'
    };

    // Per Drive condivisi, aggiungi il parametro supportAllDrives
    if (SHARED_DRIVE_ID) {
      queryParams.supportsAllDrives = true;
      queryParams.includeItemsFromAllDrives = true;
    }

    const response = await gapi.client.drive.files.list(queryParams);

    const folders = response.result.files;
    if (folders && folders.length > 0) {
      this.imagesFolderId = folders[0].id!;
    } else {
      const createParams: any = {
        resource: {
          name: 'images',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [appFolderId]
        }
      };

      // Per Drive condivisi, aggiungi il parametro supportAllDrives
      if (SHARED_DRIVE_ID) {
        createParams.supportsAllDrives = true;
      }

      const createResponse = await gapi.client.drive.files.create(createParams);
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
    const content = JSON.stringify(suppliers, null, 2);

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

      const fileResponse = await gapi.client.drive.files.get({
        fileId: files[0].id!,
        alt: 'media'
      });

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

    const response = await gapi.client.request({
      path: 'https://www.googleapis.com/upload/drive/v3/files',
      method: 'POST',
      params: {
        uploadType: 'multipart'
      },
      headers: {
        'Content-Type': 'multipart/related; boundary="foo_bar_baz"'
      },
      body: this.createMultipartBody(metadata, media, 'foo_bar_baz')
    });

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