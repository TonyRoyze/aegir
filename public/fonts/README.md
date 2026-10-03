# PDF fonts

Noto Sans (regular and bold), Noto Sans Sinhala, and Noto Sans Tamil are
bundled locally for PDF generation, so downloads do not depend on a font CDN.
These font files come from https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf
and are distributed under the SIL Open Font License in OFL.txt.

PDF generation checks every grapheme against the available character sets and
reports unsupported scripts instead of silently substituting missing glyphs.
Latin text remains selectable. Sinhala and Tamil runs are rendered at 4x resolution
with the browser’s shaping engine to preserve mark positioning and conjuncts;
those runs are images in the PDF. Add another licensed font and register it in
lib/pdf/layout.ts when supporting another script.
