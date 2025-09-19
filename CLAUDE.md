# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Panoramica del Progetto

Applicazione React multi-piattaforma per la gestione di cataloghi fornitori e campioni di prodotto con sincronizzazione cloud tramite Google Drive. L'app funziona come PWA (Progressive Web App) e supporta modalità offline-first con sincronizzazione automatica.

## Comandi Comuni

- **Sviluppo**: `npm run dev` - Avvia il server di sviluppo Vite
- **Build**: `npm run build` - Build per la produzione
- **Anteprima**: `npm run preview` - Anteprima del build di produzione
- **Installazione**: `npm install` - Installa le dipendenze

## Architettura

### Struttura Principale
- **App.tsx**: Componente root che gestisce l'autenticazione e il routing tra vista lista e dettaglio
- **AppContent**: Componente principale che gestisce stato suppliers, handlers e persistenza
- **src/types.ts**: Interfacce TypeScript centrali (Supplier, Item, HeaderData, ImageFile)
- **src/components/**: Componenti React riutilizzabili
- **src/services/**: Servizi per Google Auth, Google Drive e sincronizzazione

### Componenti Principali
- **AuthWrapper**: Gestisce autenticazione Google OAuth e stato loading
- **SupplierListView**: Vista griglia dei fornitori con anteprime biglietti da visita
- **SupplierDetailView**: Editor completo per fornitore singolo
- **Header**: Form per metadati fornitore (biglietto da visita, date, booth, factory type)
- **ItemList & ItemCard**: Gestione articoli prodotto con specifiche e immagini
- **ImageUploader**: Upload e gestione immagini con conversione base64
- **Modal**: Dialoghi conferma per eliminazioni

### Gestione dello Stato
- Stato centralizzato in AppContent usando useState per suppliers array
- Tutti gli update tramite callback `updateSuppliers` che:
  - Applica modifiche immutabili
  - Salva automaticamente in localStorage via syncService
  - Mantiene sincronizzazione con Google Drive
- Nessuna libreria esterna per state management (no Redux/Zustand)

### Struttura Dati Core
```typescript
Supplier {
  id: string (UUID)
  name: string
  headerData: HeaderData (metadati e business card)
  items: Item[] (prodotti con immagini e specifiche)
}

HeaderData {
  businessCard: ImageFile | null
  date: string
  booth: string
  madeIn: string
  factoryType: 'TRADING' | 'FACTORY' | ''
  // + altri campi
}

Item {
  id: string (UUID)
  itemCode: string
  description: string
  moq: string (Minimum Order Quantity)
  price: string
  composition: string
  images: ImageFile[]
  // + altri campi
}
```

### Sincronizzazione Cloud
- **googleAuth.ts**: Gestisce OAuth Google con scope Drive e profilo
- **googleDrive.ts**: API wrapper per upload/download files su Google Drive
- **syncService.ts**: Orchestratore sync tra localStorage e Google Drive
- Salvataggio automatico locale + sync cloud in background
- Gestione conflitti e offline-first approach

### Tecnologie e Build
- **Frontend**: React 18 + TypeScript strict
- **Styling**: TailwindCSS con design responsive
- **Build Tool**: Vite con hot reload e ottimizzazioni
- **PWA**: vite-plugin-pwa con Service Worker per offline
- **File Processing**: FileReader API per conversione immagini in base64
- **Export**: ExcelJS caricato via CDN per generazione file Excel
- **Auth**: Google APIs (gapi-script) per OAuth 2.0

### Gestione Immagini
- Tutte le immagini convertite in data URL base64 via FileReader
- Storage completo in localStorage e Google Drive come JSON
- Supporto multi-formato (JPEG, PNG, etc.) con preview immediate
- Nessun server backend necessario per image hosting

## Configurazione Ambiente

1. **Google API Setup**: Configura OAuth client e abilita Google Drive API
2. **Environment Variables**:
   - `VITE_GOOGLE_CLIENT_ID`: OAuth client ID
   - `VITE_GOOGLE_API_KEY`: Google API key
3. **File**: `.env` per produzione, `.env.local` per sviluppo locale

## Pattern di Sviluppo

- **Event Handlers**: Tutti passati via props con pattern callback
- **ID Generation**: `crypto.randomUUID()` con fallback per compatibility
- **Error Handling**: Try-catch con alert user-friendly per operazioni async
- **TypeScript**: Strict typing su tutte le interfacce e props
- **Immutability**: Update state sempre con spread operator e map/filter
- **File Conversion**: Async/await pattern per FileReader operations

## Deployment e Produzione

### GitHub Pages Setup
- **Repository**: https://github.com/manuelcalanca-scout/Campionari.git
- **URL Produzione**: https://manuelcalanca-scout.github.io/Campionari/
- **Deployment**: Automatico via GitHub Actions su push a main branch
- **Build Configuration**: Vite configurato con base path `/Campionari/` per GitHub Pages

### Team Drive Configuration
- **Google Team Drive**: "Campionari" per condivisione dati tra utenti
- **File Structure**:
  - `suppliers.json` - Dati principali condivisi
  - `*.jpg/*.png` - Immagini prodotti direttamente in root (no sottocartelle)
- **Sincronizzazione**: Manuale tramite pulsante "Salva su Drive"

### Autenticazione Google
- **OAuth Origins**: Configurate per GitHub Pages domain
- **API Credentials**: Gestite tramite GitHub Secrets
- **Scopes**: Google Drive API + Google People API

## Stato Attuale del Progetto

### ✅ Completato
1. **App Core**: Interfaccia completa per gestione fornitori e prodotti
2. **PWA**: Funzionalità offline con Service Worker e caching
3. **Google Auth**: Migrazione da gapi-script deprecato a Google Identity Services
4. **Team Drive Sync**: Configurazione corretta per condivisione dati team
5. **GitHub Deployment**: Pipeline automatica con secrets configurati
6. **Manual Sync**: Pulsante salvataggio manuale con indicatori di stato
7. **Mobile Ready**: App testata e funzionante da dispositivi mobile

### 🔧 Implementazioni Recenti
- **Risolto Race Conditions**: Separazione salvataggio locale da sync cloud
- **UX Sync**: Indicatori visivi stato sincronizzazione (🔄 ⚠️ ✅)
- **Team Drive Fix**: Uso diretto root drive invece sottocartelle
- **Build Compatibility**: Fix crypto.randomUUID() per production builds

### 📋 Todo per Prossima Sessione
1. **Migliorare UX Salvataggio**: L'utente preferisce un approccio diverso per il pulsante salva
2. **Test Multi-User**: Verificare sincronizzazione con più utenti simultanei
3. **Ottimizzazioni Performance**: Possibili miglioramenti UX/loading

### 🔧 Note Tecniche Importanti
- **Sync Strategy**: Ora manuale invece che automatica per evitare conflitti
- **Data Storage**: Team Drive root per `suppliers.json` e immagini
- **Error Handling**: Gestione fallback per browser compatibility issues
- **Mobile Support**: PWA installabile e funzionale offline

### 💡 Problemi Risolti
1. **Auth Deprecated**: Migrazione completa a Google Identity Services
2. **Team Drive**: Configurazione corretta per accesso condiviso
3. **Race Conditions**: Sync manuale previene perdita modifiche rapide
4. **GitHub Pages**: Base path e deployment workflow funzionanti
5. **UUID Generation**: Fallback per browser senza crypto.randomUUID()

---

**Ultima Sessione**: Implementato sistema salvataggio manuale per risolvere problemi sincronizzazione. App completamente funzionale e deployata. Prossimo step: migliorare UX del pulsante salva secondo preferenze utente.