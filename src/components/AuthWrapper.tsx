import React, { useState, useEffect } from 'react';
import { googleAuth, type GoogleUser } from '../services/googleAuth';
import { syncService } from '../services/syncService';

declare global {
  interface Window {
    gapi: any;
  }
}

interface AuthWrapperProps {
  children: (user: GoogleUser | null, isLoading: boolean) => React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipAuth, setSkipAuth] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      await googleAuth.initialize();

      const currentUser = googleAuth.getCurrentUser();
      setUser(currentUser);

      googleAuth.onAuthStateChange((isSignedIn) => {
        if (isSignedIn) {
          const user = googleAuth.getCurrentUser();
          setUser(user);
          syncService.syncFromCloud();
        } else {
          setUser(null);
        }
      });

    } catch (error) {
      console.error('Failed to initialize Google Auth:', error);
      let errorMessage = 'Errore sconosciuto';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setError(`Errore nell'inizializzazione di Google Auth: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      const user = await googleAuth.signIn();
      setUser(user);
      await syncService.syncFromCloud();
    } catch (error) {
      console.error('Sign in failed:', error);
      setError('Errore durante il login. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleAuth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Errore di Configurazione</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <p className="text-xs text-gray-400">
              Assicurati di aver configurato VITE_GOOGLE_CLIENT_ID e VITE_GOOGLE_API_KEY nel file .env
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Campionari</h2>
            <p className="text-gray-600 mb-6">
              Accedi con il tuo account Google Workspace per sincronizzare i tuoi dati su tutti i dispositivi
            </p>
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
            
              {isLoading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {isLoading ? 'Connessione...' : 'Accedi con Google'}
            </button>
            <button
              onClick={() => setSkipAuth(true)}
              className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Continua senza autenticazione (solo offline)
            </button>
            <p className="text-xs text-gray-500 mt-4">
              I tuoi dati saranno salvati in modo sicuro su Google Drive
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (skipAuth) {
    return (
      <div>
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center">
                <h1 className="text-lg font-semibold text-gray-900">Campionari (Offline)</h1>
              </div>
              <div className="text-sm text-orange-600">
                Modalità offline - i dati non vengono sincronizzati
              </div>
            </div>
          </div>
        </div>
        {children(null, false)}
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center">
              <h1 className="text-lg font-semibold text-gray-900">Campionari</h1>
            </div>
            <div className="flex items-center space-x-4">
              <SyncIndicator />
              <div className="flex items-center space-x-3">
                <img 
                  className="h-8 w-8 rounded-full" 
                  src={user.picture} 
                  alt={user.name}
                />
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-gray-700">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Esci
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {children(user, isLoading)}
    </div>
  );
};

const SyncIndicator: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState(syncService.getSyncStatus());

  useEffect(() => {
    const unsubscribe = syncService.onSyncStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  const handleForceSync = () => {
    syncService.forceSync();
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleForceSync}
        disabled={syncStatus.syncing || !syncStatus.isOnline}
        className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        title={syncStatus.syncing ? 'Sincronizzazione in corso...' : 'Forza sincronizzazione'}
      >
        <svg 
          className={`h-4 w-4 ${syncStatus.syncing ? 'animate-spin text-blue-600' : 'text-gray-400'}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      <div className="flex items-center space-x-1">
        <div className={`h-2 w-2 rounded-full ${syncStatus.isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-xs text-gray-500">
          {syncStatus.isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      {syncStatus.hasPendingChanges && (
        <span className="text-xs text-orange-600">Modifiche non sincronizzate</span>
      )}
    </div>
  );
};