# Andrea Gervasoni — portfolio

Sito statico bilingue (IT/EN), senza build step né framework: HTML, CSS e moduli JavaScript nativi.
Ispirato alla regia del sito di Lando Norris, riletto in chiave accademica: apertura con un
Andrea 3D low-poly che segue il cursore, quadro che si chiude e firma che si scrive, libreria dei
progetti con oggetti 3D, il percorso come volo di un aeroplanino di carta, carosello a ventaglio
delle foto di San Diego, la formazione come pila di libri che cresce con lo scroll, footer con
l'avatar che saluta.

## Struttura

```
index.html          contenuto e struttura (testo italiano di default, chiavi data-i18n)
css/style.css       design system, sezioni, vetro liquido, effetti dei titoli, responsive
js/main.js          punto d'ingresso: lingua, Lenis, ciclo di rendering unico, avvio
js/data.js          tutti i testi IT/EN, link, foto (unica fonte di verità dei contenuti)
js/i18n.js          cambio lingua (memorizzato), ?lang=it|en forza la lingua
js/field.js         sfondo: linee di livello + regione colorata che segue il cursore (WebGL)
js/avatar.js        Andrea 3D procedurale (Three.js): testa scolpita, capelli a nastri, saluto
js/brand.js         lockup del nome a larghezza bilanciata e firma che si scrive
js/scroll.js        regia dello scroll: chiusura della hero, tema chiaro/scuro, topbar, parallasse
js/flight.js        sezione Esperienze: aeroplanino di carta, rotta, tappe che si accendono, schede
js/carousel.js      sezione San Diego: carosello a ventaglio (drag, frecce, tastiera, autoplay)
js/education.js     sezione Formazione: pila di libri veri (dorso curvo, quaderno TKS con logo, certificato Cambridge)
js/objects.js       oggetti 3D dei progetti (griglia con scissor + scheda di dettaglio)
js/titles.js        ingressi dei titoli: particelle, tabellone, timbro, onda, gesso, orbita, morph
js/menu.js          menu a schermo intero
js/glass.js         vetro liquido: riflesso che segue il cursore, rifrazione SVG dove supportata
js/dialog.js        scheda di dettaglio di un progetto
vendor/             three.module.min.js (r170), gsap + ScrollTrigger (3.12.5), lenis (1.1.18)
assets/             foto ottimizzate (jpg + webp, due misure), firma SVG, favicon, ritratto, logo TKS (marchio di The Knowledge Society, usato per indicare la partecipazione al programma)
tests/              controlli di integrità (node --test) e screenshot deterministici (shot.mjs)
```

## Anteprima

Servire in HTTP (i moduli ES e WebGL non funzionano da `file://`):

```sh
node tests/serve.mjs 4180        # oppure: python3 -m http.server 4180 --bind 127.0.0.1
```

Poi aprire `http://127.0.0.1:4180/`. Il file `.claude/launch.json` avvia lo stesso server.

## Verifica

```sh
node --test tests/site.test.mjs       # integrità: chiavi IT/EN, ancore, asset, sintassi
node tests/shot.mjs --url http://127.0.0.1:4180/ --w 1440 --h 900 --at 0,700,1400 --out /tmp/shots --gpu true
```

`shot.mjs` usa il Chrome locale via DevTools Protocol: porta la pagina a posizioni di scroll
precise e salva PNG. Opzioni: `--mobile true --w 390 --h 844 --dpr 2`, `--lang en`,
`--reduced true` (prefers-reduced-motion), `--pre "<js>"` per interagire prima dello scatto.

## Aggiornare i contenuti

Tutti i testi stanno in `js/data.js` (IT ed EN hanno le stesse chiavi; il test lo verifica).
Le foto di San Diego sono in `assets/photos/` e l'elenco con le didascalie in `PHOTOS`.
Per aggiungere un'esperienza: una scheda `.xcard` in più nell'HTML, una tappa in più in `STOPS`
dentro `js/flight.js`, le relative chiavi `eN.*` in `data.js`. Per un nuovo titolo di studio: una
voce `.edu-item` in più, un volume in più in `js/education.js`, le chiavi `edN.*`.

## Note

- Palette: carta `#f3f1ea`, inchiostro `#161923`, accento `#ff6a2b`. Font: Mona Sans + Instrument Serif (Google Fonts).
- `prefers-reduced-motion`: niente marquee, titoli senza animazione, scroll senza smoothing; il 3D resta (è guidato dall'utente).
- Nessuna dipendenza esterna a runtime oltre ai font; le librerie sono in `vendor/`.
