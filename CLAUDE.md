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

## 🚨 PROBLEMA CRITICO IN CORSO - Visualizzazione Immagini

### 🔍 **Diagnosi Attuale (Sessione 23/09/2025)**
**PROBLEMA**: Le immagini ottimizzate (separate da suppliers.json) non si visualizzano nell'app.

**STATUS**:
- ✅ Download da Google Drive funziona (54527 bytes, status 200)
- ✅ Sistema lazy loading `useImageLoader` funziona
- ✅ Componenti BusinessCardImage/ItemImage implementati correttamente
- ❌ **ISSUE CRITICO**: Corruzione dati binari in tutti i metodi testati

### 🔬 **Analisi Tecnica del Problema**
**Causa Identificata**: Google Drive API restituisce dati binari corrotti indipendentemente dal metodo:

1. **Bytes Ricevuti**: `[195, 191, 195, 152, 195, 191, 195, 160, 0, 16]`
2. **Bytes JPEG Corretti**: Dovrebbero essere `[255, 216, 255, 224, ...]`
3. **Corruzione**: I valori 195,191,195,152 indicano encoding UTF-8 di bytes binari
4. **Base64 Risultante**: `w7/DmMO/w6AAEEpGSUYAAQEBAEg` (corrotto)

### ❌ **Metodi Testati e Falliti**
1. `gapi.client.drive.files.get()` con `alt: 'media'` - Dati UTF-8 corrotti
2. `fetch()` con `response.blob()` - Stessi dati corrotti
3. `XMLHttpRequest` con `responseType: 'arraybuffer'` - Ancora corrotti
4. Conversioni manuali byte-by-byte con `& 0xff` - Non risolve il problema a monte

### 🎯 **PROSSIMA SOLUZIONE DA IMPLEMENTARE**
**Approccio URL Diretto** (evitare download binary):
```typescript
// Invece di scaricare e convertire
const dataUrl = await downloadImage(fileId);

// USARE URL PUBBLICO DIRETTO
const publicUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
// Impostare come src diretto dell'img tag
```

### 📋 **Todo Immediato - Prossima Sessione**
1. **PRIORITÀ 1**: Implementare sistema URL diretto per immagini
2. **PRIORITÀ 2**: Verificare permessi Google Drive per accesso pubblico
3. **PRIORITÀ 3**: Se fallisce, considerare rollback completo al sistema base64
4. **PRIORITÀ 4**: Se necessario, valutare servizio esterno per hosting immagini

### 🔧 **Stato Codebase**
- ✅ Tutti i componenti usano correttamente `useImageLoader`
- ✅ Sistema di lazy loading implementato e funzionante
- ✅ Errore `supplierWithImages` corretto in SupplierDetailView
- ✅ Debug logging completo per troubleshooting
- ✅ Gestione errori onError/onLoad su img tags
- ❌ **BLOCCANTE**: Download binary da Google Drive non funziona

### 🔄 **Opzione Rollback Pronta**
Se il problema persiste, rollback al sistema originale:
- Immagini base64 salvate direttamente in suppliers.json
- File grande ma funzionante (4.7MB vs 50KB attuale)
- Sistema provato e stabile

### 💡 **Problemi Risolti in Questa Sessione**
1. **Error JavaScript**: Corretto `supplierWithImages` undefined
2. **Component Architecture**: Tutti i componenti usano hook lazy loading
3. **Debug System**: Sistema logging completo implementato
4. **Issue Identification**: Problema identificato con precisione (corruzione a monte)

### 🔧 Note Tecniche Importanti
- **Sync Strategy**: Manuale, funziona correttamente
- **Data Storage**: Team Drive root per `suppliers.json` (ora 50KB) e immagini separate
- **Image System**: Architettura corretta ma bloccata da problema Google Drive
- **Mobile Support**: PWA funzionale, solo immagini non visualizzate

---

**Ultima Sessione**: Identificato problema critico visualizzazione immagini. Causa: corruzione dati binari da Google Drive API. Prossimo step: implementare sistema URL diretto invece di download binary. Sistema ottimizzato pronto, solo questo ostacolo da superare.