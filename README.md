# TheIntroDB – Plasmo Extension

Browser extension (Chrome/Firefox) to skip intros, recaps, and credits using [TheIntroDB](https://theintrodb.org) and [Plasmo](https://docs.plasmo.com).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment (optional)**

   Copy `.env.example` to `.env` and set:

   - `PLASMO_PUBLIC_TMDB_TOKEN` – TMDB read token (for title → TMDB ID lookup)
   - `PLASMO_PUBLIC_INTRODB_API` – IntroDB API base URL (default: `https://api.theintrodb.org/v1`)

   Only `PLASMO_PUBLIC_*` variables are injected into the extension.

## Commands

- **Development:** `npm run dev` – watch and load unpacked in browser
- **Build:** `npm run build` – output in `build/chrome-mv3-dev` (or `-prod` for production)
- **Package:** `npm run package` – create zip for store submission

## Load in browser

1. Run `npm run dev` or `npm run build`.
2. Open `chrome://extensions` (or Firefox add-ons).
3. Enable “Developer mode” and “Load unpacked”.
4. Select the `build/chrome-mv3-dev` folder (or the path shown by `npm run dev`).
