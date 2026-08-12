# GlobeTrotter — Site (download page + web app)

One static site, two ways in: a landing/download page, and the actual
web app bundled right underneath it. Plain HTML/CSS/JS throughout, no
build step.

## Folder structure

```
globetrotter-site/
├── index.html              landing / download page
├── css/styles.css
├── js/main.js               device detection, copy-link, scroll reveal
├── assets/favicon.svg
├── downloads/
│   ├── PUT_APK_HERE.txt     instructions
│   └── globetrotter.apk     ← you add this (Android build)
├── app/                      the web app itself
│   ├── index.html
│   ├── css/styles.css
│   ├── js/api.js             talks to the API Gateway (Phase 2 backend)
│   ├── js/app.js             router + every screen (explore, destination
│   │                         detail + map/route, recommendations,
│   │                         itineraries, profile/system status)
│   └── assets/favicon.svg
└── README.md
```

The landing page's "Open web app" button and "copy link" both point at
`./app/index.html` — so clicking it on the download page takes you
straight into a working app on the same site, not a placeholder.

## Before you deploy

1. **Point the web app at your backend.** Open `app/index.html` and
   edit this one line near the top of `<body>`:
   ```html
   <script>window.GLOBETROTTER_API_BASE_URL = 'http://127.0.0.1:5004';</script>
   ```
   Change it to wherever your API Gateway (from `backend-phase2/`) is
   actually reachable — e.g. `https://api.yourdomain.com` if you
   deploy the gateway publicly.

2. **Add the APK.** Build it from the Flutter project and drop it in
   `downloads/globetrotter.apk`:
   ```bash
   flutter build apk --release
   cp build/app/outputs/flutter-apk/app-release.apk downloads/globetrotter.apk
   ```

3. **Update the file size / version text** in `index.html`'s mobile
   card once you know your real APK size and version.

## Running it locally

```bash
cd globetrotter-site
python3 -m http.server 8000
# landing page:  http://localhost:8000
# web app:       http://localhost:8000/app/
```

Make sure the backend is running too (see `backend-phase2/README.md`
in the main project), with the gateway reachable at whatever URL
`app/index.html`'s `GLOBETROTTER_API_BASE_URL` points to.

## What the web app can do

Built against the same API Gateway as the Flutter app — same
accounts, same data:

- Register / log in
- Explore destinations, search + filter by category
- Destination detail: description, tags, an OpenStreetMap map with
  the actual route from your location (via OSRM, browser
  geolocation), and reviews (read + post)
- Personalized recommendations
- Itineraries: list your own and ones shared with you, create new
  ones, share by email, delete
- Profile page with a live system-status panel — pings the gateway's
  `/health` and shows each microservice's status

## Notes

- The map/route on the destination page uses Leaflet (loaded from a
  CDN) and OSRM's free routing API — both require the browser to
  reach the public internet. If either is unreachable, the app
  degrades gracefully (shows "Map unavailable right now" instead of
  breaking the page).
- Deploy this whole folder to any static host — same VPS as the
  backend, GitHub Pages, Netlify, etc. If serving from the same
  Flask setup as your backend, just serve this folder's contents as
  static files.
