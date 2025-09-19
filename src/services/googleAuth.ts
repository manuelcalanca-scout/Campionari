// Dichiarazioni globali per le nuove Google Identity Services
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}

class GoogleAuthService {
  private isInitialized = false;
  private isSignedIn = false;
  private currentUser: GoogleUser | null = null;
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private authStateChangeCallbacks: ((isSignedIn: boolean) => void)[] = [];

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!CLIENT_ID || !API_KEY) {
      throw new Error('Google API credentials not configured. Please set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY in your .env file');
    }

    // Aspetta che le librerie Google siano disponibili
    await this.waitForGoogleLibraries();

    // Inizializza gapi per Drive API
    await new Promise<void>((resolve, reject) => {
      window.gapi.load('client', {
        callback: resolve,
        onerror: reject
      });
    });

    await window.gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });

    // Inizializza Google Identity Services per OAuth
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          console.error('Token error:', response);
          return;
        }
        this.accessToken = response.access_token;
        this.handleSignInSuccess(response.access_token);
      },
    });

    this.isInitialized = true;
  }

  private async waitForGoogleLibraries(): Promise<void> {
    const maxAttempts = 20;
    let attempts = 0;

    while ((!window.google || !window.gapi) && attempts < maxAttempts) {
      console.log(`Waiting for Google libraries to load... attempt ${attempts + 1}`);
      await new Promise(resolve => setTimeout(resolve, 250));
      attempts++;
    }

    if (!window.google || !window.gapi) {
      throw new Error('Google libraries failed to load after 5 seconds');
    }
  }

  private async handleSignInSuccess(accessToken: string): Promise<void> {
    try {
      // Ottieni informazioni utente usando People API
      const response = await fetch(
        `https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profile = await response.json();

      this.currentUser = {
        id: profile.resourceName.split('/')[1],
        name: profile.names?.[0]?.displayName || 'Unknown',
        email: profile.emailAddresses?.[0]?.value || 'unknown@email.com',
        picture: profile.photos?.[0]?.url || ''
      };

      this.isSignedIn = true;
      this.notifyAuthStateChange(true);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  private notifyAuthStateChange(isSignedIn: boolean): void {
    this.authStateChangeCallbacks.forEach(callback => callback(isSignedIn));
  }

  async signIn(): Promise<GoogleUser> {
    if (!this.tokenClient) {
      throw new Error('Google Auth not initialized');
    }

    return new Promise((resolve, reject) => {
      const originalCallback = this.tokenClient.callback;
      this.tokenClient.callback = (response: any) => {
        this.tokenClient.callback = originalCallback;

        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        this.accessToken = response.access_token;
        this.handleSignInSuccess(response.access_token)
          .then(() => {
            if (this.currentUser) {
              resolve(this.currentUser);
            } else {
              reject(new Error('Failed to get user profile'));
            }
          })
          .catch(reject);
      };

      this.tokenClient.requestAccessToken();
    });
  }

  async signOut(): Promise<void> {
    if (this.accessToken) {
      window.google.accounts.oauth2.revoke(this.accessToken);
    }

    this.isSignedIn = false;
    this.currentUser = null;
    this.accessToken = null;
    this.notifyAuthStateChange(false);
  }

  isUserSignedIn(): boolean {
    return this.isSignedIn;
  }

  getCurrentUser(): GoogleUser | null {
    return this.currentUser;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  onAuthStateChange(callback: (isSignedIn: boolean) => void): void {
    this.authStateChangeCallbacks.push(callback);
  }
}

export const googleAuth = new GoogleAuthService();