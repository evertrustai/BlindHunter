Brand wordmark font (user-supplied)
===================================

The BlindHunter logo ("BLINDHUNTER") is rendered in a custom display font loaded
via @font-face in apps/web/src/styles/global.css (family "Shlop", used through the
--font-logo token in tokens.css).

The font file itself is NOT committed to the repo (font licenses generally don't
permit redistribution). It is git-ignored. To enable the branded logo, drop a
licensed font file into THIS folder named one of:

    Shlop.woff2   (preferred)   Shlop.otf   Shlop.ttf

Until a file is present, the logo falls back to IBM Plex Sans (still with the red
"B" and "H"). To use a different typeface, drop your file here and update the
font-family name in global.css / tokens.css to match.
