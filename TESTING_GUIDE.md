# 🧪 GUIDA TESTING - Storage Granulare

## ⏰ Prima di Iniziare

**URL Produzione**: https://manuelcalanca-scout.github.io/Campionari/

**Prerequisiti**:
- Aspetta 2-3 minuti dopo ogni push per il deploy GitHub Actions
- Fai sempre **Hard Refresh** (Ctrl+Shift+R) dopo il deploy
- Tieni aperta la Console Browser (F12 → Console tab)

---

## 📋 CHECKLIST TEST POST-FIX

### ✅ TEST 1: Verifica Caricamento Granulare

**Obiettivo**: Verificare che l'app carichi i fornitori con architettura granulare

**Passi**:
1. Apri l'app
2. Fai login con Google
3. Apri Console Browser (F12)
4. Cerca nei log:
   ```
   📚 Loading suppliers with GRANULAR architecture...
   📋 Index contains 2 suppliers
   📄 Loading Bridge Power (granular)...
   ✓ Loaded Bridge Power (X items)
   📄 Loading TEST 1 (granular)...
   ✓ Loaded TEST 1 (X items)
   ✅ Loaded 2 suppliers successfully (GRANULAR)
   📥 Loaded from cloud using GRANULAR architecture
   ```

**ATTESO**:
- ✅ Fornitori caricati correttamente
- ✅ Log mostra "GRANULAR architecture"
- ✅ Nessun errore "Supplier file not found"

**SE FALLISCE**:
- Verifica flag: `localStorage.getItem('use-granular-storage')`
- Se `null` o `"false"`, esegui:
  ```javascript
  syncService.enableGranularStorage()
  location.reload()
  ```

---

### ✅ TEST 2: Modifica Solo Header

**Obiettivo**: Verificare sync granulare per modifiche header

**Passi**:
1. Clicca su un fornitore per aprirlo
2. Modifica il **nome fornitore** (es. "Bridge Power Test")
3. Clicca "Salva su Drive"
4. Controlla log:
   ```
   💾 saveLocally called with: { changedSupplierId: '...', changedItemId: undefined, useGranular: true }
   🏷️ Marking header as dirty: ...
   💾 Saving to cloud with GRANULAR architecture...
   🔍 Dirty headers: ['764cee0e...']
   🔍 Dirty items: []
   💾 Saving header for Bridge Power Test...
   📋 Granular index updated
   ✅ Synced from local to cloud (GRANULAR)
   ```

**ATTESO**:
- ✅ Solo "Dirty headers" popolato, "Dirty items" vuoto
- ✅ Log dice "Saving header for..."
- ✅ NO "Saving item..." nel log
- ✅ Sync completato velocemente

**Verifica su Drive**:
- Apri Google Drive → Team Drive "Campionari"
- File `supplier-{id}-header.json` ha timestamp aggiornato
- File `supplier-{id}-item-*.json` NON hanno timestamp aggiornato

---

### ✅ TEST 3: Modifica Solo Item (CRITICO)

**Obiettivo**: Verificare sync granulare per modifiche item

**Passi**:
1. Apri un fornitore
2. Modifica **UN SOLO item** (es. cambia "Item Code" o aggiungi foto)
3. Clicca "Salva su Drive"
4. Controlla log:
   ```
   💾 saveLocally called with: { changedSupplierId: '...', changedItemId: '...', useGranular: true }
   🏷️ Marking item as dirty: { supplierId: '...', itemId: '...' }
   💾 Saving to cloud with GRANULAR architecture...
   🔍 Dirty headers: []
   🔍 Dirty items: [{ supplierId: '...', itemIds: ['abc123'] }]
   💾 Saving item BP-001 for Bridge Power...
   📋 Granular index updated
   ✅ Synced from local to cloud (GRANULAR)
   ```

**ATTESO**:
- ✅ "Dirty headers" vuoto, "Dirty items" popolato
- ✅ Log dice "Saving item {itemCode} for {supplier}"
- ✅ NO "Saving header..." nel log
- ✅ Solo 1 itemId in dirtyItems (non tutti gli items)

**Verifica su Drive**:
- Solo `supplier-{id}-item-{itemId}.json` dell'item modificato ha timestamp nuovo
- Altri items dello stesso fornitore NON aggiornati
- Header NON aggiornato

---

### ✅ TEST 4: Aggiungi Foto a Item

**Obiettivo**: Testare caso d'uso principale (aggiunta foto)

**Passi**:
1. Apri un fornitore con item che ha già immagini
2. Aggiungi UNA foto nuova a un item esistente
3. Clicca "Salva su Drive"
4. Misura tempo di sync (guarda "Salvando..." → "Salva su Drive")

**ATTESO**:
- ✅ Sync completa in < 2 secondi (vs 8s pre-migrazione)
- ✅ Log mostra solo quel item salvato
- ✅ File dimensione ~200-500KB (non 4MB)

**Performance Comparison**:
| Metrica | Pre-Migrazione | Post-Migrazione | Miglioramento |
|---------|----------------|-----------------|---------------|
| Tempo sync | ~8s | ~0.5s | **16x** |
| File size | 4MB | 200KB | **95%** |

---

### ✅ TEST 5: Aggiungi Nuovo Item

**Obiettivo**: Verificare creazione nuovo item

**Passi**:
1. Apri un fornitore
2. Clicca "+ Aggiungi Articolo"
3. Compila campi e aggiungi foto
4. Clicca "Salva su Drive"

**ATTESO**:
- ✅ Nuovo file `supplier-{id}-item-{newItemId}.json` creato su Drive
- ✅ Index aggiornato con nuovo item
- ✅ Log mostra creazione nuovo item

---

### ✅ TEST 6: Elimina Item

**Obiettivo**: Verificare cancellazione item

**Passi**:
1. Apri un fornitore
2. Elimina un item (🗑️)
3. Conferma eliminazione
4. Clicca "Salva su Drive"

**ATTESO**:
- ✅ File `supplier-{id}-item-{deletedItemId}.json` cancellato da Drive
- ✅ Index aggiornato (item rimosso)
- ⚠️ **NOTA**: Al momento la cancellazione file potrebbe non essere implementata - verifica manualmente su Drive

---

### ✅ TEST 7: Modifica Multipla (Stress Test)

**Obiettivo**: Testare modifiche a più items

**Passi**:
1. Modifica nome fornitore
2. Modifica 2-3 items diversi
3. Clicca "Salva su Drive"

**ATTESO**:
- ✅ Dirty headers contiene supplier ID
- ✅ Dirty items contiene tutti gli items modificati
- ✅ Sync salva header + N items
- ✅ Log chiaro su cosa viene salvato

---

### ✅ TEST 8: Ricarica Pagina

**Obiettivo**: Verificare persistenza dati

**Passi**:
1. Fai alcune modifiche
2. Salva su Drive
3. Ricarica pagina (F5)
4. Verifica che le modifiche siano ancora presenti

**ATTESO**:
- ✅ Dati caricati correttamente da architettura granulare
- ✅ Tutte le modifiche presenti
- ✅ Nessun errore in console

---

### ✅ TEST 9: Export Excel

**Obiettivo**: Verificare che export funzioni con architettura granulare

**Passi**:
1. Apri un fornitore
2. Clicca "Export Excel"
3. Verifica file scaricato

**ATTESO**:
- ✅ Excel generato correttamente
- ✅ Tutti i dati presenti (header + items + immagini)

---

### ✅ TEST 10: Aggiungi Nuovo Fornitore

**Obiettivo**: Testare creazione fornitore da zero

**Passi**:
1. Clicca "+ Aggiungi Fornitore"
2. Compila dati e aggiungi items
3. Salva su Drive

**ATTESO**:
- ✅ Nuovi file creati: header + N items
- ✅ Index aggiornato
- ✅ Fornitore visibile nella lista

---

## 🚨 TROUBLESHOOTING

### ❌ App Non Carica Fornitori

**Sintomi**:
```
Supplier file supplier-{id}.json not found
⚠️ Could not load supplier ...
✅ Loaded 0 suppliers successfully
```

**Fix**:
```javascript
// In console browser
localStorage.getItem('use-granular-storage')  // Deve essere "true"

// Se false o null:
syncService.enableGranularStorage()
location.reload()
```

---

### ❌ Modifiche Non Si Salvano

**Verifica**:
1. Console ha errori?
2. Dirty tracking funziona?
   ```javascript
   // In console, dopo una modifica:
   syncService.dirtyHeaders  // Se modifichi header
   syncService.dirtyItems    // Se modifichi item
   ```

---

### ❌ File Non Su Drive

**Verifica**:
1. Autenticazione Google attiva?
2. Permessi Team Drive corretti?
3. Network tab mostra richieste a Drive API?

---

### ❌ Sync Lento

**Verifica**:
1. Log mostra "GRANULAR" o "LEGACY"?
2. Se LEGACY, abilita granular:
   ```javascript
   syncService.enableGranularStorage()
   ```
3. Riprova migrazione se necessario

---

## 📊 LOG DA OSSERVARE

### ✅ Log Corretti (Granular Mode)

**Caricamento**:
```
📚 Loading suppliers with GRANULAR architecture...
📋 Index contains 2 suppliers
📄 Loading Bridge Power (granular)...
✓ Loaded Bridge Power (5 items)
✅ Loaded 2 suppliers successfully (GRANULAR)
📥 Loaded from cloud using GRANULAR architecture
```

**Sync Header**:
```
💾 saveLocally called with: { changedSupplierId: '...', changedItemId: undefined, useGranular: true }
🏷️ Marking header as dirty: ...
💾 Saving to cloud with GRANULAR architecture...
🔍 Dirty headers: ['...']
🔍 Dirty items: []
💾 Saving header for Bridge Power...
✅ Synced from local to cloud (GRANULAR)
```

**Sync Item**:
```
💾 saveLocally called with: { changedSupplierId: '...', changedItemId: '...', useGranular: true }
🏷️ Marking item as dirty: { supplierId: '...', itemId: '...' }
💾 Saving to cloud with GRANULAR architecture...
🔍 Dirty headers: []
🔍 Dirty items: [{ supplierId: '...', itemIds: ['...'] }]
💾 Saving item BP-001 for Bridge Power...
✅ Synced from local to cloud (GRANULAR)
```

---

### ❌ Log Errati (Problemi)

**Carica Legacy invece di Granular**:
```
📚 Loading ALL suppliers (full load - use only for migration)...
Supplier file supplier-{id}.json not found
```
**→ FIX**: Abilita granular storage

**Salva Tutto invece di Solo Modificato**:
```
💾 Saving to cloud with JSON-per-supplier architecture...
⏭️ Skipping ...
```
**→ FIX**: Verifica flag granular attivo

---

## 🎯 CRITERI DI SUCCESSO

L'implementazione è corretta se:

- ✅ App carica fornitori con log "GRANULAR architecture"
- ✅ Modifica header salva solo header (log conferma)
- ✅ Modifica item salva solo quell'item (log conferma)
- ✅ Timestamp Drive aggiornati solo per file modificati
- ✅ Sync 10-20x più veloce rispetto a pre-migrazione
- ✅ Nessun errore in console
- ✅ Tutti i fornitori e items visibili e modificabili
- ✅ Export Excel funzionante

---

## 📁 FILE DA VERIFICARE SU DRIVE

Dopo migrazione completa, su Google Drive Team "Campionari" dovresti vedere:

```
suppliers-index.json                                    (350B - aggiornato ad ogni sync)

supplier-764cee0e-ffe5-4ac8-831b-e6fa15d5fabe-header.json    (~5KB)
supplier-764cee0e-ffe5-4ac8-831b-e6fa15d5fabe-item-{id1}.json (~200KB)
supplier-764cee0e-ffe5-4ac8-831b-e6fa15d5fabe-item-{id2}.json (~150KB)
...

supplier-658bca5c-3c8d-4776-b47b-3db2c3f46d31-header.json    (~5KB)
supplier-658bca5c-3c8d-4776-b47b-3db2c3f46d31-item-{id1}.json (~800KB)
...
```

**NON** devono esserci:
- ❌ `supplier-{id}.json` (vecchi file monolitici - devono essere cancellati)

---

## 🔄 ROLLBACK (Se Necessario)

Se qualcosa va storto e vuoi tornare al sistema legacy:

```javascript
// In console browser
syncService.disableGranularStorage()
location.reload()
```

**NOTA**: I file granulari rimangono su Drive come backup. Per ripristino completo, puoi ricaricare i vecchi file monolitici dalla cartella "Situazione drive".

---

**Ultima modifica**: 30 Settembre 2025
**Autore**: Claude Code
**Versione app**: v1.1.0 (Granular Storage)