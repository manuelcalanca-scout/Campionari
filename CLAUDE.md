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

## ✅ SISTEMA FUNZIONANTE - Base64 in suppliers.json

### 🎯 **Soluzione Implementata (30/09/2025)**
**APPROCCIO**: Mantenere immagini base64 embedded direttamente nel file `suppliers.json`

**DECISIONE ARCHITETTURALE**:
- ❌ Sistema immagini separate su Drive non affidabile (corruzione dati binari)
- ❌ URL diretti richiedono permessi pubblici complessi
- ✅ **Base64 embedded funziona sempre** - semplice, robusto, offline-first

### 📊 **Stato Finale Sistema**
- ✅ Immagini base64 salvate in `suppliers.json`
- ✅ `useImageLoader` prioritizza base64 (sempre disponibile)
- ✅ Componenti BusinessCardImage/ItemImage funzionanti
- ✅ Caricamento fornitori corretto
- ✅ Export Excel con immagini funzionante
- ✅ App completamente operativa

### 🏗️ **Architettura Attuale**
```
Google Drive /Campionari/
└── 📄 suppliers.json  (completo con base64 embedded)
```

**Vantaggi Sistema Corrente**:
1. **Affidabilità**: Base64 sempre disponibile, no dipendenze esterne
2. **Semplicità**: Un solo file da sincronizzare
3. **Offline-First**: Funziona senza connessione dopo primo caricamento
4. **Compatibilità**: Nessun problema di CORS/permessi/encoding
5. **Manutenibilità**: Meno punti di fallimento

### 🔧 **Fix Applicati (Sessione 30/09/2025)**
1. ✅ Errore `SUPPLIERS_FILE_NAME` undefined risolto
2. ✅ Errore `supplierWithImages` scope risolto
3. ✅ Ripristinato sistema base64 funzionante
4. ✅ Rimossi pulsanti test sperimentali
5. ✅ Pulizia codice non utilizzato

### 🧪 **Esperimenti Tentati (Non Implementati)**
- Sistema JSON per fornitore separato
- Download immagini da Drive con conversione binary
- URL diretti Google Drive con permessi pubblici
- Sistema ibrido base64 + Drive fallback

**Conclusione**: Il sistema base64 embedded è la soluzione più robusta per questo tipo di applicazione.

### 🚀 **Note Tecniche**
- **File Size**: suppliers.json può crescere (OK per ~50-100 fornitori)
- **Performance**: localStorage gestisce file fino a 10MB senza problemi
- **Sync**: Manuale via pulsante "Salva su Drive"
- **Team Drive**: Configurato e funzionante per condivisione team