# Promo-Video — astrofotografie-allgaeu.de

Anleitung für ein kurzes Vorstell-Video der Website. Drei Bausteine:
**(1)** echte Aufnahmen der Seite auf mehreren Geräten, **(2)** ein KI-Intro
(Higgsfield) als Stimmungs-B-Roll, **(3)** Drehbuch/Schnittplan.

> **Wichtig:** Higgsfield & Co. *erfinden* Bilder aus Text — sie zeigen **nicht**
> deine echte Seite. Deshalb: echte Seite per Skript aufnehmen (Baustein 1),
> Higgsfield nur fürs atmosphärische Intro/Beiwerk (Baustein 2).

---

## 1) Echte Geräte-Aufnahmen (Skript)

```bash
npm i -D playwright
npx playwright install chromium
npm run capture                      # nimmt die Live-Domain auf
# oder lokal:  npm run capture -- http://localhost:4321
```

Ergebnis in `./capture/`:
- `desktop/`, `tablet/`, `mobile/` — je ein **Video (.webm)** und **Screenshot (.png)**
  pro Seite (Startseite, Portfolio, Detailseite, Sonnensystem, Über mich).
- Diese Clips sind das Kernmaterial fürs Schnittprogramm.

Tipp: Die Mobil-/Tablet-Clips wirken am besten in einem **Geräte-Rahmen**
(Mockup). Kostenlose Tools dafür: *screely.com*, *mockuphone.com* oder die
Geräte-Frames in CapCut / DaVinci Resolve.

---

## 2) Higgsfield-Prompt (KI-Intro / B-Roll)

Higgsfield erzeugt ~5-Sekunden-Clips. Pro gewünschtem Shot einen Prompt
einzeln generieren. Stil-Anker durchgehend gleich halten:

**Globaler Stil (an jeden Prompt anhängen):**
> *cinematic, photorealistic, deep blue night palette, soft starlight, gentle
> film grain, anamorphic, shallow depth of field, slow graceful camera move,
> 24fps, ultra-detailed, no text, no logos*

**Shot A — Eröffnung (Sternenhimmel):**
> A vast, crystal-clear night sky over the rolling hills of the Allgäu in
> southern Germany, the Milky Way arcing overhead, thousands of stars, distant
> alpine silhouette on the horizon, slow upward tilt revealing the galactic
> core. *(+ globaler Stil)*

**Shot B — Teleskop:**
> A Newtonian reflector telescope on an equatorial mount silhouetted against the
> starry sky, faint red astronomer's light glowing, breath fog in cold air, slow
> dolly-in toward the eyepiece. *(+ globaler Stil)*

**Shot C — Übergang ins „Digitale":**
> Macro shot of a glowing screen reflecting a spiral galaxy, soft bokeh of stars
> behind, a hand subtly adjusting focus, cool cyan accent light. *(+ globaler Stil)*

**Format:** 16:9 fürs Web/YouTube — zusätzlich 9:16 generieren, falls du
Instagram-Reels/TikTok bespielst.

---

## 3) Drehbuch / Schnittplan (~25 Sekunden)

| Zeit | Bild | Text-Einblendung | Ton |
|------|------|------------------|-----|
| 0–4 s | **Shot A** (KI: Sternenhimmel Allgäu) | — | Musik setzt ruhig ein |
| 4–7 s | **Shot B** (KI: Teleskop) | „Astrofotografie aus dem Allgäu" | leiser Wind |
| 7–12 s | **Desktop-Clip Startseite** (Scroll) | — | Beat baut sich auf |
| 12–16 s | **Mobile-Clip Portfolio** im Handy-Rahmen | „Galaxien · Nebel · Mond & Planeten" | — |
| 16–20 s | **Detailseite + Lightbox-Zoom** (Desktop) | „Jedes Bild — Licht aus Millionen Jahren" | Höhepunkt |
| 20–23 s | **Sonnensystem-3D** (Scroll, Desktop) | — | — |
| 23–25 s | Schwarz/Sternenfeld, Logo + Domain | „astrofotografie-allgaeu.de" | Ausklang |

**Stil-Hinweise:**
- **Übergänge:** weiche Cross-Dissolves oder ein „Light-Leak"/Star-Glow-Wischer —
  passt zur ruhigen „Stille Observation"-Ästhetik der Seite.
- **Musik:** ambient/cinematic, ruhig, ohne Gesang. Quellen z. B. *Artlist*,
  *Epidemic Sound* oder die lizenzfreie YouTube-Audio-Bibliothek.
- **Schrift der Einblendungen:** möglichst die Seiten-Schrift *Space Grotesk*
  (Titel) bzw. *JetBrains Mono* (Labels), Farbe Cyan `#6fe3ff` auf dunklem Grund.
- **Tempo:** lange, ruhige Shots — kein hektischer Schnitt. Die Bilder wirken lassen.

**Software zum Zusammenschneiden:** CapCut (einfach, Geräte-Mockups eingebaut),
DaVinci Resolve (kostenlos, professioneller) oder Premiere.
