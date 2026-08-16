# Allcasto Downloader v7 Patch

Patched files:
- `server/index.js`
- `server/utils/normalizer.js` (new)
- `server/services/youtubeService.js`
- `server/services/tiktokService.js`
- `server/services/facebookService.js`
- `server/services/instagramService.js`
- `src/App.jsx`
- `vite.config.js`
- `README.md`
- `package.json`

## Core provider strategy

- YouTube: Vidssave -> Vidfly fallback
- TikTok: SSSTik -> TikDownloader fallback
- Facebook: metadownloader -> Gimita fallback
- Instagram: metadownloader -> Gimita fallback

The four core platforms now return a stable `medias[]` structure. Other existing
platforms retain legacy response compatibility.

## Local test

Terminal 1:
```bash
npm install
npm run server
```

Terminal 2:
```bash
npm run dev
```

Health:
`GET /api/health`

Third-party extraction sites can change without notice. The fallback layer is
intended to reduce downtime, not guarantee every URL forever.


## Allcasto branding & OIS typography
- Removed the `effectivegatecpm.com` popunder/advertising script from `index.html`.
- Renamed frontend, footer, backend engine logs, metadata, and documentation to **Allcasto Downloader**.
- Removed the legacy ZeroNaut donation link.
- Applied OIS typography: **Plus Jakarta Sans** for headings and **DM Sans** for body text, inputs, and buttons.
