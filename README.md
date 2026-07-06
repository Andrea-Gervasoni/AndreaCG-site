# Andrea Celeste Gervasoni — Portfolio

Sito portfolio personale: liquid glass in stile Apple, sfondo "campo di seta" animato, bilingue IT/EN, pannello di amministrazione nascosto.

## Struttura

```
├── index.html          # redirect → Portfolio.html (per GitHub Pages)
├── Portfolio.html      # il sito
├── content.js          # TUTTI i contenuti (testi, colori, sezioni)
├── admin/
│   └── index.html      # pannello di amministrazione
└── assets/
    └── andrea.png      # foto ritratto
```

## Pubblicare su GitHub Pages

1. Crea un repository su GitHub (es. `portfolio`)
2. Carica **tutti** i file di questa cartella (trascinali su GitHub → *Add file → Upload files*)
3. Vai su **Settings → Pages**
4. In *Source* scegli **Deploy from a branch**, branch `main`, cartella `/ (root)` → **Save**
5. Dopo ~1 minuto il sito è online su `https://TUOUSERNAME.github.io/portfolio/`

## Pannello Admin

Non c'è nessun bottone: si raggiunge **solo digitando l'indirizzo**.

- Online: `https://TUOUSERNAME.github.io/portfolio/admin/`
- Oppure aggiungi `#admin` all'URL del sito → redirect automatico
- Codice di accesso predefinito: **`ACG2026`** (cambialo in *Impostazioni*)

### Cosa puoi modificare
- **Tema & colori** — oro/accento, colori del testo
- **Hero** — le tre righe del nome, sottotitolo
- **Chi sono** — tutti i paragrafi e la citazione
- **Statistiche** — numeri e etichette dei contatori (aggiungi/rimuovi)
- **Esperienze / Educazione** — box della timeline (aggiungi/rimuovi)
- **Certificazioni / Lingue** — card complete (aggiungi/rimuovi, bandiere, barre)
- **Titoli, navigazione, progetti, footer** — ogni testo del sito, in italiano e inglese
- **Corsivo / grassetto / oro**: seleziona il testo in un campo e usa la barra **I / B / A**

### Come funziona il salvataggio (importante)

| Azione | Effetto |
|---|---|
| **Salva** | Le modifiche si applicano subito, ma **solo nel tuo browser** (localStorage) |
| **Esporta content.js** | Scarica il file con le modifiche. **Sostituisci `content.js` nel repository e fai commit** → le modifiche diventano permanenti per tutti i visitatori |
| **Ripristina originale** | Cancella le modifiche locali e torna al contenuto di `content.js` |

> Il flusso consigliato: modifichi → Salva → controlli con "Anteprima sito" → Esporta → commit su GitHub.

### Nota sulla sicurezza
Il codice di accesso è una protezione *cosmetica* lato client (il sito è statico, senza server). Chiunque apra il pannello può solo modificare la **propria** copia locale del sito: per cambiare il sito pubblico serve comunque l'accesso al repository GitHub. Non inserire mai dati sensibili.

## Easter egg
Premi **G** sul sito per una citazione filosofica casuale. 

---
Fatto con cura — Bergamo · MMXXVI
