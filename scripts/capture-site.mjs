/**
 * Site-Aufnahme für ein Promo-Video.
 *
 * Ruft die Live-Seite (oder eine beliebige URL) in mehreren Geräte-Größen auf,
 * scrollt sanft durch und zeichnet pro Seite + Gerät ein VIDEO sowie einen
 * vollständigen SCREENSHOT auf. Die echten Aufnahmen deiner echten Seite —
 * Grundlage fürs Schnittprogramm (siehe docs/promo-video.md).
 *
 * NUTZUNG (lokal, nicht in der CI/Sandbox — dort ist die Domain geblockt):
 *   npm i -D playwright
 *   npx playwright install chromium
 *   npm run capture                       # nimmt die Live-Domain
 *   npm run capture -- http://localhost:4321   # oder lokaler Dev-Server
 *
 * Ergebnis liegt in  ./capture/<gerät>/ …  (videos: *.webm, bilder: *.png)
 */
import { chromium, devices } from 'playwright';
import { mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

const SITE = (process.argv[2] || process.env.SITE_URL || 'https://astrofotografie-allgaeu.de').replace(/\/$/, '');
const OUT = 'capture';

// Geräte-Profile: Name -> Playwright-Konfiguration + Videogröße
const PROFILES = [
  { id: 'desktop', label: 'Desktop', config: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 }, video: { width: 1920, height: 1080 } },
  { id: 'tablet', label: 'Tablet', config: devices['iPad (gen 7) landscape'], video: { width: 1080, height: 810 } },
  { id: 'mobile', label: 'Handy', config: devices['iPhone 14 Pro'], video: { width: 393, height: 852 } },
];

// Seiten, die gezeigt werden sollen (Pfad -> Dateiname)
const ROUTES = [
  { path: '/', name: '1-startseite' },
  { path: '/portfolio/', name: '2-portfolio' },
  { path: '/portfolio/m42-orionnebel/', name: '3-detail-orionnebel' },
  { path: '/sonnensystem/', name: '4-sonnensystem' },
  { path: '/ueber-mich/', name: '5-ueber-mich' },
];

/** Sanftes Durchscrollen über die angegebene Dauer (ms). */
async function smoothScroll(page, durationMs = 6000) {
  await page.evaluate(async (duration) => {
    await new Promise((resolve) => {
      const maxY = document.body.scrollHeight - window.innerHeight;
      if (maxY <= 0) return resolve();
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / duration, 1);
        // ease-in-out für ruhige Kamerafahrt
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        window.scrollTo(0, eased * maxY);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, durationMs);
}

const browser = await chromium.launch();

for (const profile of PROFILES) {
  const dir = join(OUT, profile.id);
  await mkdir(dir, { recursive: true });
  console.log(`\n▶ ${profile.label}`);

  for (const route of ROUTES) {
    const context = await browser.newContext({
      ...profile.config,
      recordVideo: { dir, size: profile.video },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const url = `${SITE}${route.path}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1200); // Hero/Reveals einblenden lassen
      await page.screenshot({ path: join(dir, `${route.name}.png`), fullPage: true });
      await smoothScroll(page, route.path === '/sonnensystem/' ? 9000 : 6000);
      await page.waitForTimeout(600);
      console.log(`   ✓ ${route.path}`);
    } catch (err) {
      console.warn(`   ✗ ${route.path} — ${err.message}`);
    }
    const video = page.video();
    await context.close(); // erst beim Schließen wird das Video geschrieben
    if (video) {
      const saved = await video.path().catch(() => null);
      if (saved) await rename(saved, join(dir, `${route.name}.webm`)).catch(() => {});
    }
  }
}

await browser.close();
console.log(`\n✅ Fertig. Aufnahmen liegen in ./${OUT}/  (Drehbuch: docs/promo-video.md)`);
