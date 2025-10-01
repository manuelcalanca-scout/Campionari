# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Panoramica del Progetto

Applicazione React multi-piattaforma per la gestione di cataloghi fornitori e campioni di prodotto con sincronizzazione cloud tramite Google Drive. L'app funziona come PWA (Progressive Web App) e supporta modalità offline-first con sincronizzazione manuale.

## Comandi Comuni

- **Sviluppo**: `npm run dev` - Avvia il server di sviluppo Vite
- **Build**: `npm run build` - Build per la produzione
- **Anteprima**: `npm run preview` - Anteprima del build di produzione
- **Installazione**: `npm install` - Installa le dipendenze

## Architettura

### Struttura Principale
- **App.tsx**: Componente root che gestisce l'autenticazione e il routing tra vista lista e dettaglio
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
- Stato centralizzato in App.tsx usando useState per suppliers array
- Tutti gli update tramite callback `updateSuppliers` che:
  - Applica modifiche immutabili
  - Salva automaticamente in localStorage via syncService
  - Traccia modifiche con dirty tracking granulare
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
  itemOrder?: string[]  // Preserva ordine custom degli items
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

## 🚀 Architettura Storage Granulare (Sistema Attuale)

### Struttura File su Google Drive
```
Drive/Campionari/
├── suppliers-index.json (metadata + timestamp per header/items)
├── supplier-{id}-header.json (metadati + business card ~5-50KB)
├── supplier-{id}-item-{itemId}.json (singolo prodotto ~20-800KB)
├── supplier-{id}-item-{itemId}.json
└── ...
```

**Vantaggi:**
- ✅ Sync ultra-veloce (95% riduzione dati rispetto a file monolitici)
- ✅ Zero conflitti multi-utente (ogni modifica tocca solo il file specifico)
- ✅ Timestamp granulare per ogni header e item
- ✅ Ordine items preservato tramite `itemOrder` array

### Dirty Tracking Granulare

**Modifiche tracciate separatamente:**
- `dirtyHeaders: Set<supplierId>` - Headers modificati
- `dirtyItems: Map<supplierId, Set<itemId>>` - Items modificati per fornitore
- `deletedSuppliers: Set<supplierId>` - Fornitori da cancellare
- `deletedItems: Map<supplierId, Set<itemId>>` - Items da cancellare

**Salvataggio differito:** Tutte le modifiche vengono tracciate localmente e sincronizzate su Drive solo quando l'utente clicca "Salva su Drive".

### Processo di Sync

**Quando si modifica qualcosa:**
1. Modifica applicata immediatamente all'array locale → UI si aggiorna
2. Modifica tracciata nei Set/Map di dirty tracking
3. Indicatore "⚠️ Modifiche non salvate" appare

**Quando si clicca "Salva su Drive":**
1. Processa cancellazioni (elimina file da Drive + aggiorna index)
2. Salva headers modificati (solo quelli dirty)
3. Salva items modificati (solo quelli dirty)
4. Aggiorna `suppliers-index.json` con nuovi timestamp
5. Pulisce tutti i Set/Map di dirty tracking

### Servizi

- **googleAuth.ts**: OAuth Google con scope Drive e profilo
- **googleDrive.ts**:
  - API wrapper per upload/download files granulari
  - Funzioni principali: `saveSupplierHeader()`, `saveSupplierItem()`, `loadSupplierComplete()`
  - Funzioni delete: `deleteSupplierComplete()`, `deleteSupplierItem()`
  - Funzioni index: `saveGranularIndexSelective()`, `removeSupplierFromIndex()`, `removeItemFromIndex()`
- **syncService.ts**:
  - Orchestratore sync tra localStorage e Google Drive
  - Dirty tracking granulare per headers, items, deletions
  - Salvataggio locale immediato, sync cloud differito
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
- Storage completo in localStorage e Google Drive come JSON embedded
- Supporto multi-formato (JPEG, PNG, etc.) con preview immediate
- Nessun server backend necessario per image hosting
- Sistema semplice, robusto e offline-first

## Configurazione Ambiente

1. **Google API Setup**: Configura OAuth client e abilita Google Drive API
2. **Environment Variables**:
   - `VITE_GOOGLE_CLIENT_ID`: OAuth client ID
   - `VITE_GOOGLE_API_KEY`: Google API key
   - `VITE_SHARED_DRIVE_ID`: (Opzionale) ID del Team Drive condiviso
3. **File**: `.env` per produzione, `.env.local` per sviluppo locale

## Pattern di Sviluppo

- **Event Handlers**: Tutti passati via props con pattern callback
- **ID Generation**: `crypto.randomUUID()` con fallback per compatibility
- **Error Handling**: Try-catch con alert user-friendly per operazioni async
- **TypeScript**: Strict typing su tutte le interfacce e props
- **Immutability**: Update state sempre con spread operator e map/filter
- **File Conversion**: Async/await pattern per FileReader operations
- **Dirty Tracking**: Passa `changedSupplierId` e `changedItemId` a `updateSuppliers()`
  - Per cancellazioni: passa `''` come `changedSupplierId` per skip dirty tracking

## Deployment e Produzione

### GitHub Pages Setup
- **Repository**: https://github.com/manuelcalanca-scout/Campionari.git
- **URL Produzione**: https://manuelcalanca-scout.github.io/Campionari/
- **Deployment**: Automatico via GitHub Actions su push a main branch
- **Build Configuration**: Vite configurato con base path `/Campionari/` per GitHub Pages

### Team Drive Configuration
- **Google Team Drive**: "Campionari" per condivisione dati tra utenti
- **File Structure**: Architettura granulare con file separati per header e items
- **Sincronizzazione**: Manuale tramite pulsante "Salva su Drive"

### Autenticazione Google
- **OAuth Origins**: Configurate per GitHub Pages domain
- **API Credentials**: Gestite tramite GitHub Secrets
- **Scopes**: Google Drive API + Google People API

## Debug e Logging

### Flag di Debug (Produzione: Disabilitati)

Per riattivare i log verbosi quando necessario:

**Logs caricamento immagini:**
- File: `src/hooks/useImageLoader.ts`
- Flag: `DEBUG_IMAGE_LOADING = false` → cambia a `true`

**Logs rendering componenti immagine:**
- File: `src/components/BusinessCardImage.tsx`, `ItemImage.tsx`, `ImageUploader.tsx`
- Flag: `DEBUG_RENDER = false` → cambia a `true`

**Reset completo app (emergenze):**
- File: `App.tsx` linee 95-130 e 342-351
- Decommenta `handleResetAll` e il pulsante Reset nell'UI

### Log Importanti (Sempre Attivi)

Console mostra questi log critici:
- `💾 Saving to cloud with GRANULAR architecture...`
- `🔍 Dirty headers:`, `🔍 Dirty items:`, `🗑️ Deleted suppliers:`, `🗑️ Deleted items:`
- `✅ Synced from local to cloud (GRANULAR)`
- Errori: sempre loggati con dettagli per debugging

## Stato Attuale del Progetto (Ottobre 2025)

### ✅ Sistema Completamente Funzionante

1. **Architettura Granulare**: Implementata e testata in produzione
2. **Dirty Tracking**: Header, items e cancellazioni tracciate separatamente
3. **Item Ordering**: Ordine items preservato tramite `itemOrder` array
4. **Deferred Deletion**: Cancellazioni differite fino a sync manuale
5. **Sync Ottimizzato**: Solo file modificati vengono salvati (95% riduzione dati)
6. **UI Pulita**: Log di debug disabilitati in produzione
7. **Codice Documentato**: Funzioni legacy marcate con commenti LEGACY

### 📊 Performance Attuale

| Operazione | Dati Trasferiti | Tempo (4G) |
|------------|-----------------|------------|
| Modifica 1 campo header | ~5KB | ~0.1s |
| Modifica 1 immagine item | ~200KB | ~0.4s |
| Cancella 1 item | ~1KB (solo index) | <0.1s |
| Cancella 1 fornitore | ~10KB | ~0.2s |

### 🔧 Funzionalità Chiave

- ✅ Sincronizzazione manuale con indicatore stato
- ✅ Offline-first con localStorage
- ✅ Dirty tracking granulare (header/item/delete separati)
- ✅ Ordine items preservato
- ✅ Export Excel con immagini embedded
- ✅ PWA con Service Worker
- ✅ Multi-utente senza conflitti
- ✅ Mobile-ready e responsive

### 📝 Codice Legacy (Mantenuto per Riferimento)

Funzioni non più usate ma mantenute:
- `saveSuppliers()` - Usa `saveSupplierHeader/Item` invece
- `loadSuppliersNew()` - Usa `loadSuppliersGranular` invece
- `loadSingleSupplier()` - Usa `loadSupplierComplete` invece
- `migrateToGranularStructure()` - Migrazione già completata
- `handleResetAll()` - Commentato, disponibile per emergenze

Tutte marcate con commenti `// LEGACY:` nel codice.

---

**Ultima Sessione (01/10/2025)**:
- Implementato deferred deletion con tracking separato
- Risolto bug dirty tracking su cancellazioni
- Rimosso pulsante Reset dall'UI (commentato)
- Ridotti log verbosi in produzione (flag DEBUG)
- Documentate funzioni legacy
- Sistema stabile e pronto per produzione
