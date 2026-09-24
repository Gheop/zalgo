# zalgo

**→ [zalgo.gheop.com](https://zalgo.gheop.com)**

Type some text, watch it rot, copy it in one click. Combining diacritics pile up above, below and through every letter until they spill onto the neighbouring lines.

[![Screenshot of zalgo.gheop.com](docs/screenshot.webp)](https://zalgo.gheop.com)

Everything runs in your browser: no text is ever sent to the server.

The interface speaks English, French, Spanish, German, Italian, Portuguese and Dutch. It follows your browser language, falls back to English, and can be switched from the footer or with `?lang=xx` in the URL (for example [`?lang=fr`](https://zalgo.gheop.com/?lang=fr)).

## Usage

- Type your text, set the corruption level (0 to 100) and pick the zones: above, through, below.
- Click the result or the "copy" button (shortcut: Ctrl+Enter, ⌘+Enter on Mac).
- "reroll" (Alt+R) draws new marks. Typing one more letter never reshuffles the ones already corrupted.
- "purify" cleans pasted zalgo text. A lone mark is kept only when it forms a Latin-1 accented letter (é, ç, ñ, ü…). Limit: a "û" produced by zalgo is identical to a typed "û" and stays.

The command line version does the same with the same mark lists:

```sh
./zalgo.py -i 3 "he comes"
echo "extraordinary" | ./zalgo.py -i 1
```

## Host your own copy

The page is static, with no build step: any file server works.

```sh
cd web && python3 -m http.server 8000
```

To serve it like production, with compression, long-lived font caching and the content security policy from `web/nginx.conf`:

```sh
podman run --rm -p 8080:8080 \
  -v "$PWD/web:/usr/share/nginx/html:ro" \
  -v "$PWD/web/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  docker.io/nginxinc/nginx-unprivileged:1.29-alpine
```

`docker` works in place of `podman`. TLS and HSTS belong to whatever proxy sits in front.

## Layout

- `web/`: the page. `zalgo.js` holds the pure logic (corruption, purification), `i18n.js` the translations and language choice, `app.js` the interface, `nginx.conf` the server config.
- `web/fonts/`: Cormorant Garamond italic for the title, and a subset of Noto Serif (Latin + marks U+0300 to U+036F) for the result. Without it, fallback system fonts draw the marks as square blocks.
- `zalgo.py`: the command line version.
- `tests/`: unit tests (JS and Python) and an end-to-end test.
- `bench/`: performance bench and optimisation log (see `PERF.md`, in French).

## Adding a language

Add an entry to `LANGS` and `STRINGS` in `web/i18n.js`, with the same keys as English. `npm test` fails if a key is missing or has the wrong shape. Languages whose accents live outside Latin-1 (Polish, Czech…) would also need `purify` to keep those letters.

## Tests

```sh
npm test                 # JS (node:test) + Python (unittest) unit tests, no dependencies
python3 tests/e2e.py web # end to end: real nginx (podman) + headless Chrome
```

The end-to-end test needs `podman`, Google Chrome and `pip install playwright`. CI (`.github/workflows/test.yml`) runs both.

## License

Code under the MIT license (see `LICENSE`). The fonts in `web/fonts/` (Cormorant Garamond, Noto Serif) remain under the SIL Open Font License 1.1.

## Changelog

### v1.2.0 — Seven languages (2026-09-24)

- Interface in English, French, Spanish, German, Italian, Portuguese and Dutch
- Language follows the browser, falls back to English, can be switched from the footer or with `?lang=`; the choice is remembered
- README and command line help in English

### v1.1.0 — Visible ambience, lighter page (2026-09-24)

- The red glow and the giant echo of your text finally show up: a misplaced background had been hiding them since v1.0.0
- The page uses much less CPU when idle: ambient effects follow the title clock (8 frames per second instead of 60) and the title halo is no longer repainted on every roll
- Test suite (JS and Python unit tests, end to end) and GitHub Actions CI

### v1.0.1 — Stricter purification (2026-09-24)

- "purify" now removes lone marks that don't form a common accented letter (Ċ, r̃, ṅ go away, é and ç stay)
- The "purify" button lights up as soon as there is anything left to clean, even a single mark

### v1.0.0 — zalgo.gheop.com goes live (2026-09-24)

- Web page to corrupt text and copy it in one click
- Intensity and zones (above, through, below), reroll, purification
