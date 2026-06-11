# Go-Live-Anleitung: astrofotografie-allgaeu.de

Die neue Website ist eine statische Astro-Site — sie braucht kein WordPress,
keine Datenbank und kein Hosting-Paket. Empfohlen: **Cloudflare Pages**
(kostenlos, unbegrenzter Traffic, automatisches SSL — das löst auch das
aktuell abgelaufene Zertifikat).

## Schritt 1: Code zu GitHub

1. Auf https://github.com kostenloses Konto anlegen (falls nicht vorhanden)
2. Neues **privates** Repository erstellen, z. B. `astrofotografie-allgaeu`
3. Im Projektordner:
   ```
   git remote add origin https://github.com/DEIN-NAME/astrofotografie-allgaeu.git
   git push -u origin main
   ```

## Schritt 2: Cloudflare Pages verbinden

1. Auf https://dash.cloudflare.com kostenloses Konto anlegen
2. **Workers & Pages → Create → Pages → Connect to Git** → GitHub-Repo wählen
3. Build-Einstellungen:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy klicken → nach ~2 Minuten läuft die Seite unter
   `https://PROJEKTNAME.pages.dev` — mit gültigem SSL.
   Ab jetzt deployt jeder `git push` automatisch.

## Schritt 3: Web3Forms-Schlüssel (Kontaktformular)

1. Auf https://web3forms.com mit **info@multitrex.de** einen (kostenlosen)
   Access Key erstellen
2. In `src/pages/kontakt.astro` den Platzhalter `HIER-ACCESS-KEY-EINTRAGEN`
   durch den Key ersetzen, committen, pushen
3. Testnachricht über das Formular schicken und Empfang prüfen

## Schritt 4: Domain umstellen

**Vorher beim aktuellen Hoster (Strato) klären:** Zugang zur DNS-Verwaltung
der Domain. **WICHTIG:** Vor jeder Änderung die bestehenden **MX-Records
notieren** (E-Mail info@multitrex.de muss weiterlaufen!).

Empfohlener Weg — Nameserver zu Cloudflare:
1. In Cloudflare: **Add a domain** → `astrofotografie-allgaeu.de` →
   Cloudflare scannt die bestehenden DNS-Einträge (MX-Records kontrollieren!)
2. Bei Strato die **Nameserver** auf die zwei von Cloudflare genannten umstellen
3. In Cloudflare Pages: **Custom domains** → `astrofotografie-allgaeu.de`
   und `www.astrofotografie-allgaeu.de` hinzufügen
4. Nach DNS-Umstellung (bis 24 h): Seite, SSL-Schloss und **E-Mail-Empfang** testen

Die Weiterleitungen alter WordPress-URLs (`/mond/`, `/leo-triplet-galax/` …)
sind bereits in `public/_redirects` hinterlegt und greifen automatisch.

## Schritt 5: Nacharbeiten

- [ ] Google Search Console: neue Property anlegen, Sitemap
      `https://astrofotografie-allgaeu.de/sitemap-index.xml` einreichen
- [ ] WordPress-Hosting noch 2–4 Wochen als Backup behalten, dann prüfen/kündigen
      (vorher in WordPress: Werkzeuge → Daten exportieren als letzte Sicherung)
- [ ] „Über mich"-Text persönlich machen (Datei `src/pages/ueber-mich.astro` —
      Fragen: Seit wann? Wie zum Hobby gekommen? Genaue Teleskop-Daten?)
- [ ] Datenschutz/Impressum einmal gegenlesen (lassen) — die Texte sind an
      das neue Setup (Cloudflare, Web3Forms, kein Tracking) angepasst

## Inhalte pflegen

Neues Astrofoto veröffentlichen:
1. Bild nach `src/assets/photos/mein-bild.jpg` legen
2. Neue Datei `src/content/portfolio/mein-bild.md` anlegen (eine bestehende
   als Vorlage kopieren, Titel/Daten/Beschreibung anpassen)
3. `git add . && git commit -m "Neues Foto" && git push` — fertig
