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
  initRail(reducedMotion);

  if (reducedMotion || !supportsWebGL()) {
    // statischer Pfad: nichts verstecken, nichts animieren — Inhalt steht ja im HTML
    return;
  }

  initOverlays();
  void init3D(journey);
}

/* ---------------- Sprungleiste: aktive Station + sanfte Sprünge ---------------- */

/** Lenis-Instanz, sobald die 3D-Initialisierung sie erzeugt hat */
let lenisRef: { scrollTo: (target: HTMLElement, opts?: object) => void } | null = null;

function initRail(reducedMotion: boolean) {
  const items = [...document.querySelectorAll<HTMLAnchorElement>('[data-rail]')];
  if (items.length === 0) return;

  // Klick: ohne Scrollen zur Station springen (smooth, außer bei reduced motion)
  for (const item of items) {
    item.addEventListener('click', (e) => {
      const target = document.getElementById(item.dataset.rail ?? '');
      if (!target) return;
      e.preventDefault();
      // Ziel: Sektionsmitte im Viewport — dort steht das Panel, dort verweilt die Kamera
      const y = target.offsetTop + target.offsetHeight / 2 - innerHeight / 2;
      if (lenisRef && !reducedMotion) {
        lenisRef.scrollTo(target, { offset: target.offsetHeight / 2 - innerHeight / 2, duration: 1.8 });
      } else {
        scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' });
      }
      history.replaceState(null, '', `#${item.dataset.rail}`);
    });
  }

  // Aktive Station: Sektion, deren Mitte im mittleren Viewport-Band liegt
  const byId = new Map(items.map((i) => [i.dataset.rail ?? '', i]));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const i of items) delete i.dataset.active;
        byId.get(entry.target.id)!.dataset.active = '';
      }
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  for (const id of byId.keys()) {
    const sec = document.getElementById(id);
    if (sec) observer.observe(sec);
  }
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

/* ---------------- Hover-Callout: Name mit Leitlinie ---------------- */

function setupHoverCallout(
  scene: { pick: (x: number, y: number) => void; clearHover: () => void; getHover: () => { name: string; type: string; x: number; y: number; radiusPx: number } | null },
  journey: HTMLElement
) {
  const callout = document.getElementById('planet-callout');
  const nameEl = callout?.querySelector<HTMLElement>('[data-callout-name]');
  const typeEl = callout?.querySelector<HTMLElement>('[data-callout-type]');
  if (!callout || !nameEl || !typeEl) return;

  const fineHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  let px = 0;
  let py = 0;
  let needPick = false;

  // ---- Maus/Stift: Hover ----
  if (fineHover) {
    addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') return;
        px = e.clientX;
        py = e.clientY;
        needPick = true;
      },
      { passive: true }
    );
    addEventListener('pointerleave', () => scene.clearHover());
  }

  // ---- Touch: Antippen zeigt den Namen (blendet nach einigen Sekunden aus) ----
  let downX = 0;
  let downY = 0;
  let downT = 0;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      downX = e.clientX;
      downY = e.clientY;
      downT = e.timeStamp;
    },
    { passive: true }
  );
  addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType !== 'touch') return;
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      // echter Tap (kein Scrollen)? -> picken
      if (moved < 14 && e.timeStamp - downT < 450) {
        scene.pick(e.clientX, e.clientY);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => scene.clearHover(), 3200);
      }
    },
    { passive: true }
  );

  gsap.ticker.add(() => {
    if (needPick) {
      scene.pick(px, py);
      needPick = false;
    }
    const h = scene.getHover();
    if (h) {
      // Box nach unten klappen, wenn oben kein Platz ist (Handy, Objekt oben)
      const below = h.y - h.radiusPx * 0.6 - 120 < 8;
      callout.classList.toggle('is-below', below);
      callout.classList.add('is-on');
      callout.style.left = `${h.x}px`;
      callout.style.top = `${below ? h.y + h.radiusPx * 0.6 : h.y - h.radiusPx * 0.6}px`;
      if (nameEl.textContent !== h.name) nameEl.textContent = h.name;
      if (typeEl.textContent !== h.type) typeEl.textContent = h.type;
      if (fineHover) journey.style.cursor = 'crosshair';
    } else {
      callout.classList.remove('is-on');
      if (fineHover) journey.style.cursor = '';
    }
  });
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
  lenisRef = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const scene = new SolarScene(canvas, tier);
  const timeline = buildTimeline(scene, journey);

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__solar = scene;
  }

  addEventListener('resize', () => scene.resize(), { passive: true });

  /* Render-Loop über den GSAP-Ticker (pausiert automatisch bei verstecktem Tab) */
  gsap.ticker.add(() => scene.update());

  /* Hover-Callout: Name von Planet/Mond in einer HUD-Box mit Leitlinie */
  setupHoverCallout(scene, journey);

  /* Dev-Verifikation: ?pose=mars (Disc) oder ?fly=mars&s=0.5 (Tiefflug) */
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(location.search);
    const pose = params.get('pose');
    const fly = params.get('fly');
    const which = pose || fly;
    if (which) {
      timeline.scrollTrigger?.disable();
      timeline.pause();
      stage.setAttribute('data-3d-ready', '');
      void scene.queue.load(which);
      const sVal = parseFloat(params.get('s') ?? '0.5');
      const calloutId = params.get('callout');
      const sc = scene as unknown as {
        debugFrame: (n: string) => void;
        debugHover: (id: string) => void;
      };
      const paint = () => {
        if (fly === 'belt' || fly === 'comet') sc.debugFrame(fly);
        else if (fly) scene.debugPass(fly, sVal);
        else scene.debugPose(pose!);
        if (calloutId) sc.debugHover(calloutId);
        requestAnimationFrame(paint);
      };
      requestAnimationFrame(paint);
      return;
    }
  }

  /* Canvas erst überblenden, wenn die erste Planeten-Textur da ist —
     bis dahin trägt das CSS-Sonnenglühen. „Nichts von Ladezeiten merken." */
  try {
    await scene.queue.load('merkur');
  } catch {
    /* Textur fehlgeschlagen? Tint-Farben reichen auch. */
  }
  requestAnimationFrame(() => stage.setAttribute('data-3d-ready', ''));

  /* Deep-Link: /sonnensystem/#saturn öffnet direkt beim Planeten.
     Erst nach dem Reveal, damit die Sektions-Offsets final vermessen sind. */
  const hashId = location.hash.slice(1);
  const target = hashId ? document.getElementById(hashId) : null;
  if (target) {
    requestAnimationFrame(() =>
      lenis.scrollTo(target, {
        offset: target.offsetHeight / 2 - innerHeight / 2,
        immediate: true,
      })
    );
  }
}
