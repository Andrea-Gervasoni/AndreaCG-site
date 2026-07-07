# Andrea Celeste Gervasoni — Portfolio

Bilingual (IT/EN) personal portfolio. Static site, no build step, no backend.

## Stack

- HTML5 / CSS3 / vanilla JavaScript (ES6+)
- Canvas 2D for the animated background (silk-field shader)
- Google Fonts: Fraunces, Geist, JetBrains Mono
- No frameworks, no bundler, no dependencies

## Structure

```
├── index.html          # Redirects to Portfolio.html (GitHub Pages entry point)
├── Portfolio.html       # Main site — markup, styles, animation and content-rendering logic
├── content.js           # Content model — all copy, numbers, colors, and list data (single source of truth)
├── admin/
│   └── index.html        # Content editor (see below)
├── assets/
│   └── andrea.png        # Portrait
└── README.md
```

## Content model

`content.js` defines `window.ACG_DEFAULT`, a JSON-like object holding:

| Key | Description |
|---|---|
| `admin.pass` | Admin panel access code |
| `palette` | `gold`, `cream`, `creamDim` — CSS custom properties applied at runtime |
| `hero` | The three lines of the animated name |
| `stats` | Array of `{ n, l: {it, en} }` — counters in the About section |
| `experience`, `education` | Arrays of `{ date, title, sub, desc }`, each field `{it, en}` |
| `certifications` | Array of `{ level, done, title, desc, status, meta1, meta2 }` |
| `languages` | Array of `{ flag, name, lvl, pct }` |
| `texts` | Flat key/value dictionary per language — nav, section titles, footer, project panel copy |

At runtime, `Portfolio.html` loads `content.js`, merges any locally saved overrides from `localStorage` (`acg-content`) over the defaults, and renders all dynamic sections (`#expTimeline`, `#eduTimeline`, `#certGrid`, `#langGrid`, `#statsRow`) from the resulting object. Static copy is bound via `data-i18n` attributes resolved against `texts.it` / `texts.en`.

## Admin panel

Path: `/admin/` (also reachable via `#admin` on the main site, which redirects). Not linked from the UI.

- Client-side gate only (`sessionStorage` flag, plaintext code in `content.js`) — cosmetic, not a security boundary. The site is fully static; there is no server-side auth.
- Edits are applied to `localStorage` on **Save**, visible only in the editing browser.
- **Export content.js** downloads the updated file; committing it to the repository is what publishes changes to all visitors.
- **Reset** clears the local override and reverts to the committed `content.js`.

## Internationalization

Two locales: `it` (default), `en`. Language toggle persists to `localStorage` (`lang`). All bilingual fields follow the `{ it: '...', en: '...' }` shape; `acgL(obj)` resolves the active locale with `it` as fallback.

## Deployment (GitHub Pages)

1. Push repository contents to `main`.
2. Repository **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main`, folder `/ (root)`.
3. Site is served at `https://<user>.github.io/<repo>/`.

No build step required — files are served as-is.

## Browser support

- Backdrop-filter (liquid glass) requires a Chromium/Safari-class browser; degrades to a solid-blur fallback on older engines via `.no-refract`.
- Pointer-driven effects (card tilt, glass sheen) are disabled on touch devices (`hover: hover` / `pointer: fine` media query).

## License

Personal project. Content and portrait are property of Andrea Celeste Gervasoni.

