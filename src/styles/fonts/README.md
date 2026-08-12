# Bundled fonts

Self-hosted, per the spec — never loaded from a remote Google Fonts CDN.

All three families come from Google Fonts' own repository (google/fonts on
GitHub), licensed under the SIL Open Font License 1.1 (see the OFL-*.txt
files alongside each family here). Converted from the upstream .ttf files
to .woff2 for size (fonttools, ~60% smaller than the raw TTFs).

- **EB Garamond** — variable font, weight axis only. Regular + Italic files.
- **Source Serif 4** — variable font, weight + optical-size axes. Regular + Italic files.
- **Atkinson Hyperlegible** — static weights (Braille Institute doesn't ship
  a variable version): Regular, Bold, Italic, BoldItalic.

Wired up via @font-face rules in `src/styles/tokens.css`.
