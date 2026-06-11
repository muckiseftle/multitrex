import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { detectTier } from './config';

gsap.registerPlugin(ScrollTrigger);

/**
 * Einstiegspunkt der Sonnensystem-Seite.
 *
 * Dreistufig:
 *  1. reduced-motion / kein WebGL  -> statischer Pfad (CSS-Glow bleibt, Inhalte sichtbar)
 *  2. sonst                        -> Overlay-Animationen (Reveals, Count-ups)
 *  3. zusätzlich                   -> 3D-Szene + Lenis, lazy nachgeladen
 */
export function initJourney() {
  const journey = document.querySelector<HTMLElement>('[data-journey]');
  if (!journey) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !supportsWebGL()) {
    // statischer Pfad: nichts verstecken, nichts animieren — Inhalt steht ja im HTML
    return;
  }

  initOverlays();
  void init3D(journey);
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/* ---------------- HTML-Overlays: Reveals + Zahlen-Count-ups ---------------- */

function initOverlays() {
  // Panels schweben ein
  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    gsap.from(el, {
      autoAlpha: 0,
      y: 48,
      duration: 0.9,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 78%' },
    });
  }

  // Zahlen zählen hoch (de-DE-Formatierung, Suffix bleibt erhalten)
  const fmt = new Intl.NumberFormat('de-DE');
  for (const dd of document.querySelectorAll<HTMLElement>('[data-count]')) {
    const target = Number(dd.dataset.count);
    if (!Number.isFinite(target)) continue;
    const suffix = (dd.textContent ?? '').replace(fmt.format(target), '');
    const state = { val: 0 };
    gsap.to(state, {
      val: target,
      duration: 1.4,
      ease: 'power2.out',
      scrollTrigger: { trigger: dd, start: 'top 85%' },
      onUpdate() {
        dd.textContent = fmt.format(Math.round(state.val)) + suffix;
      },
    });
  }
}

/* ---------------- 3D-Szene: lazy, blockiert nie das LCP ---------------- */

async function init3D(journey: HTMLElement) {
  const canvas = document.getElementById('solar-canvas') as HTMLCanvasElement | null;
  const stage = canvas?.parentElement;
  if (!canvas || !stage) return;

  const tier = detectTier();

  // Three.js + Szene als eigener Chunk — lädt parallel zum Lesen des Heros
  const [{ SolarScene }, { buildTimeline }, { default: Lenis }] = await Promise.all([
    import('./scene'),
    import('./timeline'),
    import('lenis'),
  ]);

  /* Lenis <-> ScrollTrigger Standard-Verdrahtung */
  const lenis = new Lenis({ lerp: 0.12 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const scene = new SolarScene(canvas, tier);
  buildTimeline(scene, journey);

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__solar = scene;
  }

  addEventListener('resize', () => scene.resize(), { passive: true });

  /* Render-Loop über den GSAP-Ticker (pausiert automatisch bei verstecktem Tab) */
  gsap.ticker.add(() => scene.update());

  /* Canvas erst überblenden, wenn die erste Planeten-Textur da ist —
     bis dahin trägt das CSS-Sonnenglühen. „Nichts von Ladezeiten merken." */
  try {
    await scene.queue.load('merkur');
  } catch {
    /* Textur fehlgeschlagen? Tint-Farben reichen auch. */
  }
  requestAnimationFrame(() => stage.setAttribute('data-3d-ready', ''));
}
