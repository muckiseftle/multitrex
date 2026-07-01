# Dein Baukasten — Inhalte & Statistik selbst verwalten

Zwei Bausteine, beide „klicki-bunti", beide ohne dass deine Seite langsamer
oder unsicherer wird:

1. **Redaktionsoberfläche** (Sveltia CMS) unter `…/admin/` — Fotos & Texte per
   Klick bearbeiten.
2. **Besucher-Statistik** (Cloudflare Web Analytics) — cookielos, kein Banner.

So läuft der Alltag: Du bearbeitest etwas in der Oberfläche → es wird
automatisch in GitHub gespeichert → die Seite baut sich selbst neu → nach ~2
Minuten ist es live. Kein Server, keine Datenbank, keine Wartung.

---

## Teil 1 — Redaktionsoberfläche (einmalige Einrichtung)

Die Oberfläche liegt bereits im Projekt (`public/admin/`). Sie muss sich nur
einmalig sicher an deinem GitHub anmelden dürfen. Dafür gibt es einen
kostenlosen Anmelde-Helfer (ein „Cloudflare Worker").

**Schritt A — GitHub-OAuth-App anlegen**
1. GitHub → oben rechts dein Profil → **Settings** → ganz unten
   **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Ausfüllen:
   - *Application name:* `Multitrex Admin`
   - *Homepage URL:* `https://astrofotografie-allgaeu.de`
   - *Authorization callback URL:* (die Adresse des Anmelde-Helfers aus
     Schritt B, endet auf `/callback` — erst B machen, dann hier eintragen)
3. **Client ID** und einen **Client Secret** erzeugen und notieren.

**Schritt B — Anmelde-Helfer bereitstellen**
Folge der offiziellen, stets aktuellen Anleitung von Sveltia CMS:
<https://github.com/sveltia/sveltia-cms#github-backend> → Abschnitt zur
Authentifizierung. Empfohlen wird der fertige **`sveltia-cms-auth`**-Worker bei
Cloudflare (kostenlos, ~5 Minuten). Dort trägst du die Client ID/Secret aus
Schritt A ein und bekommst eine Worker-Adresse wie
`https://sveltia-cms-auth.DEINNAME.workers.dev`.

**Schritt C — Adresse eintragen**
In `public/admin/config.yml` die Zeile mit `base_url` aktivieren (das `#`
entfernen) und deine Worker-Adresse eintragen:
```yaml
backend:
  name: github
  repo: muckiseftle/multitrex
  branch: main
  base_url: https://sveltia-cms-auth.DEINNAME.workers.dev
```
Committen → fertig. Ab jetzt: **`https://astrofotografie-allgaeu.de/admin/`**
öffnen, mit GitHub anmelden, loslegen.

> Zu kompliziert? Es geht auch **ganz ohne Einrichtung** mit der gehosteten
> App **pagescms.org** (mit GitHub einloggen, Repo freigeben, fertig). Sag mir
> Bescheid, dann stelle ich die Konfiguration darauf um.

### So fügst du ein neues Foto hinzu (der Alltag)
1. `…/admin/` öffnen, anmelden.
2. Links **„Astrofotos"** → **„New Astrofoto"**.
3. Bild hochladen, Titel/Beschreibung/Kategorie/Objektdaten ausfüllen.
4. Oben **„Publish"** klicken. Nach ~2 Minuten ist das Foto live —
   inklusive eigener Detailseite, Galerie-Eintrag und SEO-Daten.

---

## Teil 2 — Besucher-Statistik (Cloudflare Web Analytics)

Cookielos, kein Cookie-Banner nötig, kostenlos.

1. **dash.cloudflare.com** → **Web Analytics** → **Add a site** →
   `astrofotografie-allgaeu.de`.
2. Cloudflare zeigt dir ein Snippet mit einem **Token** (lange Zeichenkette).
   Nur den Token kopieren.
3. In **`src/site.config.ts`** den Token zwischen die Anführungszeichen setzen:
   ```ts
   cloudflareAnalyticsToken: 'dein-token-hier',
   ```
4. Committen. Ab jetzt siehst du im Cloudflare-Dashboard Besucher, Seitenaufrufe,
   Länder, Verweise usw. Leer lassen = Statistik aus, es wird nichts geladen.

### Wichtig: Datenschutzerklärung ergänzen
Sobald Analytics aktiv ist, gehört ein kurzer Hinweis in die
Datenschutzerklärung (`src/pages/datenschutz.astro`). Fertiger Textbaustein:

> **Web-Analyse (Cloudflare Web Analytics).** Zur Reichweitenmessung nutzen wir
> Cloudflare Web Analytics (Cloudflare, Inc.). Der Dienst arbeitet **ohne
> Cookies** und **ohne** dauerhafte Kennungen; es werden keine
> personenbezogenen Profile gebildet und Besucher nicht über Seiten hinweg
> verfolgt. Erhoben werden aggregierte Kennzahlen wie Seitenaufrufe, Herkunft
> und ungefähre Region. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
> (berechtigtes Interesse an einer datensparsamen Reichweitenmessung).
> Weitere Infos: https://www.cloudflare.com/web-analytics/

Sag Bescheid, dann füge ich diesen Absatz direkt in die Datenschutzseite ein,
sobald du Analytics aktivierst.

---

## Was NICHT nötig ist
- Kein WordPress, kein Server, keine Datenbank, keine monatlichen Hosting-Kosten.
- Kein Cookie-Banner (solange du bei cookielosen Diensten bleibst).
- Kein manuelles Deployen — jeder Speichervorgang baut die Seite automatisch neu.
