Brand wordmark font
===================

The BlindHunter logo ("BLINDHUNTER") is rendered in the "Shlop" display font,
loaded via @font-face in apps/web/src/styles/global.css (family "Shlop", used
through the --font-logo token in tokens.css).

Shlop.otf is committed here so the branded logo renders on every clone. If the
file is missing, the logo falls back to IBM Plex Sans (still with the red "B"/"H").

Note: Shlop is a Typodermic font distributed under a desktop EULA. Confirm its
license permits redistribution before publishing this repository publicly; if
not, replace Shlop.otf with an open-licensed (e.g. OFL) display font and update
the font-family name in global.css / tokens.css.
