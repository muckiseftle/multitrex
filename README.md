# Multitrex — Astrofotografie im Allgäu

Website von Merlin Gail: Astrofotografie aus dem Allgäu, mit einer
scroll-gesteuerten 3D-Reise durch unser Sonnensystem.

**Live (GitHub Pages):** https://muckiseftle.github.io/multitrex/
**Ziel-Domain:** https://astrofotografie-allgaeu.de (siehe [DEPLOYMENT.md](DEPLOYMENT.md))

## Tech-Stack

- [Astro 5](https://astro.build) — statische Site, Content Collections, Bildoptimierung
- [Three.js](https://threejs.org) — 3D-Sonnensystem (Shader-Sonne, texturierte Planeten)
- [GSAP ScrollTrigger](https://gsap.com) + [Lenis](https://lenis.darkroom.engineering) — Scroll-Journey
- Planeten-Texturen: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0)

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:4321 (—host: im LAN erreichbar)
npm run build      # statischer Build nach dist/
```

Der Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) baut
bei jedem Push auf `main` und veröffentlicht automatisch auf GitHub Pages
(Unterpfad `/multitrex` via `GITHUB_PAGES=true`).

## Neues Astrofoto veröffentlichen

1. Bild nach `src/assets/photos/` legen
2. Markdown-Datei in `src/content/portfolio/` anlegen (bestehende als Vorlage)
3. Committen und pushen — fertig
