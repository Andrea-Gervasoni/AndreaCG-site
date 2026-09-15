# Andrea Gervasoni — portfolio
# Online Site: https://andrea-gervasoni.github.io/AndreaCG-site/Portfolio.html


Bilingual static website (IT/EN), with no build step or framework: HTML, CSS, and native JavaScript modules.

Inspired by the art direction of Lando Norris's website, reinterpreted through an academic lens: an opening with a low-poly 3D Andrea that follows the cursor, a frame that closes and a signature that writes itself, a project library with 3D objects, the journey represented as the flight of a paper airplane, a fan-style carousel of San Diego photos, education represented as a stack of books that grows with scrolling, and a footer featuring a waving avatar.

## Structure

```text
index.html          content and structure (default Italian text, data-i18n keys)
css/style.css       design system, sections, liquid glass, title effects, responsive
js/main.js          entry point: language, Lenis, single render loop, initialization
js/data.js          all IT/EN text, links, photos (single source of truth for content)
js/i18n.js          language switching (stored), ?lang=it|en forces the language
js/field.js         background: contour lines + colored region following the cursor (WebGL)
js/avatar.js        procedural 3D Andrea (Three.js): sculpted head, ribbon hair, wave
js/brand.js         balanced-width name lockup and self-writing signature
js/scroll.js        scroll direction: hero closing, light/dark theme, topbar, parallax
js/flight.js        Experience section: paper airplane, route, illuminating waypoints, cards
js/carousel.js      San Diego section: fan-style carousel (drag, arrows, keyboard, autoplay)
js/education.js     Education section: realistic book stack (curved spines, TKS notebook with logo, Cambridge certificate)
js/objects.js       project 3D objects (scissor-masked grid + detail card)
js/titles.js        title entrances: particles, scoreboard, stamp, wave, chalk, orbit, morph
js/menu.js          fullscreen menu
js/glass.js         liquid glass: cursor-following reflection, SVG refraction where supported
js/dialog.js        project detail card
vendor/             three.module.min.js (r170), gsap + ScrollTrigger (3.12.5), lenis (1.1.18)
assets/             optimized photos (jpg + webp, two sizes), SVG signature, favicon, portrait, TKS logo (The Knowledge Society trademark, used to indicate program participation)
tests/              integrity checks (node --test) and deterministic screenshots (shot.mjs)
```

## Preview

Serve the website over HTTP (ES modules and WebGL do not work from `file://`):

```sh
node tests/serve.mjs 4180        # or: python3 -m http.server 4180 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4180/`. The `.claude/launch.json` file starts the same server.

## Verification

```sh
node --test tests/site.test.mjs       # integrity: IT/EN keys, anchors, assets, syntax
node tests/shot.mjs --url http://127.0.0.1:4180/ --w 1440 --h 900 --at 0,700,1400 --out /tmp/shots --gpu true
```

`shot.mjs` uses the local Chrome browser through the DevTools Protocol: it navigates the page to precise scroll positions and saves PNG screenshots.

Options:

```text
--mobile true --w 390 --h 844 --dpr 2
--lang en
--reduced true
--pre "<js>"
```

`--mobile` enables a mobile viewport, `--lang` forces the language, `--reduced` emulates `prefers-reduced-motion`, and `--pre` executes JavaScript before taking the screenshot.

## Updating Content

All text content lives in `js/data.js` (IT and EN use the same keys; this is verified by the test suite).

San Diego photos are stored in `assets/photos/`, with their captions defined in `PHOTOS`.

To add a new experience: add another `.xcard` to the HTML, add another waypoint to `STOPS` inside `js/flight.js`, and add the corresponding `eN.*` keys to `data.js`.

To add a new qualification: add another `.edu-item`, add another volume in `js/education.js`, and add the corresponding `edN.*` keys.

## Notes

* **Palette:** paper `#f3f1ea`, ink `#161923`, accent `#ff6a2b`.
* **Fonts:** Mona Sans + Instrument Serif (Google Fonts).
* **`prefers-reduced-motion`:** no marquee, titles without animation, scrolling without smoothing; 3D remains enabled because it is user-driven.
* **Runtime dependencies:** no external dependencies at runtime other than fonts; all libraries are bundled locally in `vendor/`.
