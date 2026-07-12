# To-do — astrofotografie-allgaeu.de

## SEO / Inhalt (zurückgestellt, Stand 06/2026)

Technisches SEO ist erledigt (Sitemap, robots.txt, Open Graph, Canonicals,
strukturierte Daten/Schema.org, keyword-optimierte Titel). Was noch fehlt, ist
**Inhalt** — der größte Ranking-Faktor, den nur der Betreiber liefern kann:

- [ ] **Google Search Console** einrichten, Domain verifizieren, Sitemap
      `https://astrofotografie-allgaeu.de/sitemap-index.xml` einreichen.
- [ ] **Google Unternehmensprofil** „Astrofotograf, Allgäu" anlegen (lokale Treffer).
- [ ] **Pro Foto echten Erfahrungstext** in der jeweiligen `.md`-Datei ergänzen
      (Ort, Datum, Equipment, Belichtungszeit, kurze Anekdote).
- [ ] **2–3 ausführliche Erfahrungs-/Technik-Artikel** schreiben, z. B.
      „Den Orionnebel über dem Allgäu fotografieren — Ausrüstung & Einstellungen".
      → Dafür ggf. einen Blog-/„Aus der Nacht"-Bereich anlegen (siehe unten).
- [ ] **Backlinks** sammeln: lokale Sternwarte, VHS, Astro-Foren, regionale Presse.
- [ ] „Über mich"-Text persönlich machen (seit wann? wie zum Hobby gekommen?
      genaue Teleskop-Daten) — Platzhalter in `src/pages/ueber-mich.astro`.

## AR-Himmelsscanner: Feld-Test nach dem Genauigkeits-Update

Die Rechenschicht ist gegen JPL Horizons verifiziert (npm test). Was nur am
echten Gerät prüfbar ist — am besten tagsüber mit der Sonne als Maßstab:

- [ ] **iPhone**: Scanner öffnen, Kamera zur Sonne heben → Sonnen-Marker muss
      auf/nahe der echten Sonne sitzen (vorher: bis 180° daneben, Fix B1).
- [ ] **Android**: dito; falls konstant einige Grad daneben → einmal
      „◎ An Sonne/Mond ausrichten" tippen (Kompass-Kalibrierfehler).
- [ ] **Rand-Genauigkeit**: Sonne an den Bildrand schwenken — Marker soll auf
      der Sonne bleiben (FOV-Fix B4; vorher wanderte er zum Rand hin weg).
- [ ] **Debug bei Problemen**: 5× auf die Kompass-Pille (oben links) tippen →
      Anzeige von Quelle/Blickrichtung/Missweisung/FOV. Werte notieren.
- [ ] Nachts: Mond & sichtbare Planeten gegenprüfen.

## Design / UX (in Diskussion)

Ideen zur Verbesserung des Website-Erlebnisses — Priorisierung offen:

- [ ] Bild-Lightbox (Vollbild + Zoom) für Aufnahmen.
- [ ] Portfolio nach Kategorie gruppieren/filtern (Galaxien · Nebel · Mond & Planeten).
- [ ] Aufnahme-Daten je Bild übersichtlicher (Gesamtbelichtung, Einzelbilder, Filter).
- [ ] Mögliche neue Seite(n): „Drucke/Prints", „Technik & Equipment", „Aktuelles/Blog".
