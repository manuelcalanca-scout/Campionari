# Campionari - Product Spec Creator

App multi-piattaforma per la gestione di cataloghi fornitori e campioni di prodotto con sincronizzazione cloud tramite Google Drive.

## Caratteristiche

- ✅ **Multi-piattaforma**: Windows, Android, iPhone (PWA)
- ✅ **Offline-first**: Funziona senza connessione internet
- ✅ **Sincronizzazione cloud**: Dati salvati automaticamente su Google Drive
- ✅ **Autenticazione sicura**: Login con Google Workspace
- ✅ **Gestione immagini**: Upload e gestione di biglietti da visita e foto prodotti
- ✅ **Export Excel**: Esportazione dati in formato Excel

## Setup e Installazione

### Prerequisiti
- Node.js (versione 16 o superiore)
- Account Google Workspace o Google personale
- Credenziali Google API (vedi sotto)

### 1. Configurazione Google API

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita le seguenti API:
   - Google Drive API
   - Google People API (per profilo utente)
4. Crea le credenziali:
   - **API Key**: Vai su "Credenziali" > "Crea credenziali" > "Chiave API"
   - **OAuth 2.0 Client ID**: Vai su "Credenziali" > "Crea credenziali" > "ID client OAuth 2.0"
     - Tipo: Applicazione web
     - Origini JavaScript autorizzate: 
       - `http://localhost:5173` (sviluppo)
       - Il tuo dominio di produzione
5. Copia le credenziali nel file `.env`

### 2. Installazione

```bash
# Clona o scarica il progetto
cd Campionari

# Copia il file di configurazione
cp .env.example .env

# Modifica .env con le tue credenziali Google
# VITE_GOOGLE_CLIENT_ID=il_tuo_client_id
# VITE_GOOGLE_API_KEY=la_tua_api_key

# Installa le dipendenze
npm install

# Avvia l'app in sviluppo
npm run dev
```

### 3. Build per produzione

```bash
# Build dell'app
npm run build

# Anteprima del build
npm run preview
```

## Utilizzo

1. **Login**: Accedi con il tuo account Google
2. **Sincronizzazione**: I dati vengono sincronizzati automaticamente con Google Drive
3. **Offline**: L'app continua a funzionare offline, sincronizzando al ritorno della connessione
4. **Mobile**: Installa l'app su mobile visitando il sito e seguendo le istruzioni del browser

## Struttura Dati

I dati vengono salvati in:
- **Locale**: localStorage del browser
- **Cloud**: Google Drive nella cartella "Campionari/"
  - `suppliers.json`: Dati principali dei fornitori
  - `images/`: Cartella per le immagini
  - `exports/`: Cartella per i file Excel esportati

## Tecnologie

- **Frontend**: React 18 + TypeScript
- **Styling**: TailwindCSS  
- **Build**: Vite
- **PWA**: Service Worker per funzionalità offline
- **Cloud**: Google Drive API per storage
- **Auth**: Google OAuth 2.0

## Supporto Browser

- ✅ Chrome (raccomandato)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers (iOS Safari, Android Chrome)

## Troubleshooting

### Errori di autenticazione
- Verifica che le credenziali Google siano corrette nel file `.env`
- Controlla che le origini autorizzate includano il tuo dominio
- Assicurati che le API Google siano abilitate nel progetto

### Problemi di sincronizzazione
- Verifica la connessione internet
- Controlla che l'account Google abbia accesso a Google Drive
- Controlla la console del browser per errori specifici

### App non installabile su mobile
- Verifica che il sito sia servito tramite HTTPS (obbligatorio per PWA)
- Controlla che il manifest.json sia accessibile
- Assicurati che il service worker sia registrato correttamente
# Updated Fri, Sep 19, 2025  2:12:19 PM
