# Bundled fonts

Font files go here, self-hosted (never loaded from a remote Google Fonts CDN).

Needed for Phase 6 (theming):
- EB Garamond (traditional serif)
- Source Serif 4 (contemporary serif)
- Atkinson Hyperlegible (accessible sans-serif)

All three are open-licensed and can be downloaded from Google Fonts' GitHub
mirrors or fonts.google.com and dropped in here as .woff2 files, then wired
up with @font-face rules in tokens.css. Left empty intentionally in Phase 1
— the app falls back to system fonts until then.
