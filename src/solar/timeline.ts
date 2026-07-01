import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PLANET_VISUALS, STATION_GAP } from './config';
import type { SolarScene } from './scene';

gsap.registerPlugin(ScrollTrigger);

/**
 * Master-Timeline: EINE gescrubbte Kamerafahrt über die ganze Seite.
 *
 * Die Stationen werden aus den ECHTEN Sektions-Offsets gemessen (nicht aus
 * angenommenen vh-Höhen), damit die Kamera exakt dann beim Planeten ankommt,
 * wenn sein Panel im Viewport steht. Einheit der Timeline = Scroll-Pixel.
 */
export function buildTimeline(scene: SolarScene, journeyEl: HTMLElement) {
  const cam = scene.camera.position;
  const look = scene.lookTarget;
  const totalScroll = Math.max(1, journeyEl.offsetHeight - innerHeight);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: journeyEl,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8,
      onUpdate(self) {
        scene.setLightFalloff(self.progress);
      },
    },
  });

  let prevDepart = 0;

  for (const v of PLANET_VISUALS) {
    const sec = document.getElementById(v.id);
    if (!sec) continue;

    // Ankunft: kurz bevor das Panel die Viewportmitte erreicht.
    // Abreise: erst wenn die Sektion den Viewport fast verlassen hat —
    // solange das Panel lesbar ist, bleibt der Planet im Bild.
    const arrive = Math.min(
      totalScroll,
      Math.max(prevDepart + 1, sec.offsetTop + sec.offsetHeight / 2 - innerHeight * 0.55)
    );
    const depart = Math.min(
      totalScroll,
      Math.max(arrive + 1, sec.offsetTop + sec.offsetHeight - innerHeight * 0.45)
    );

    const mobile = innerWidth < 700;
    // Orbit-Pose (Höhe = viewDist) als Ziel des Anflugs — verbindet nahtlos
    // mit dem folgenden Tiefflug (dessen s=0 dieselbe Pose ist).
    const e0 = scene.flyCamLook(v.id, 0, mobile);

    // Anflug: aus der Ferne zur Orbit-Höhe über dem Planeten
    tl.to(cam, { x: e0.cam.x, y: e0.cam.y, z: e0.cam.z, duration: arrive - prevDepart }, prevDepart);
    tl.to(look, { x: e0.look.x, y: e0.look.y, z: e0.look.z, duration: arrive - prevDepart }, prevDepart);

    // Tiefflug: hinab zur Oberfläche, dicht darüber hinweg, wieder heraus.
    // Ein Proxy scrubbt s=0..1; die Pose kommt aus scene.flyCamLook().
    const fly = { s: 0 };
    tl.to(
      fly,
      {
        s: 1,
        duration: depart - arrive,
        onUpdate: () => {
          const r = scene.flyCamLook(v.id, fly.s, mobile);
          cam.copy(r.cam);
          look.copy(r.look);
        },
      },
      arrive
    );

    prevDepart = depart;
  }

  /* Outro: weiter in die Dunkelheit hinter Neptun */
  const last = PLANET_VISUALS[PLANET_VISUALS.length - 1]!;
  const rest = Math.max(1, totalScroll - prevDepart);
  tl.to(cam, { x: 0, y: 1.5, z: last.z - 26, duration: rest }, prevDepart);
  tl.to(look, { x: 0, y: 0, z: last.z - 120, duration: rest }, prevDepart);

  /* Sichtbarkeits-Management: nie mehr als ~2 Planeten gerendert */
  const cull = () => {
    for (const v of PLANET_VISUALS) {
      const mesh = scene.planets.get(v.id);
      if (mesh) mesh.visible = Math.abs(v.z - cam.z) < STATION_GAP * 1.6;
    }
  };
  gsap.ticker.add(cull);

  /* Vorausladen: beim Betreten einer Sektion Textur von Planet i+2 vorziehen */
  for (const v of PLANET_VISUALS) {
    const ahead = PLANET_VISUALS[v.index + 2];
    if (!ahead) continue;
    ScrollTrigger.create({
      trigger: `#${v.id}`,
      start: 'top bottom',
      once: true,
      onEnter: () => scene.queue.boost(ahead.id),
    });
  }

  /* Bei Resize stimmen die gemessenen Offsets nicht mehr -> neu aufbauen */
  let lastW = innerWidth;
  let lastH = innerHeight;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    // kleine Höhenänderungen (iOS-Adressleiste) ignorieren, alles andere: neu vermessen
    const significant =
      Math.abs(innerWidth - lastW) > 80 || Math.abs(innerHeight - lastH) > lastH * 0.25;
    if (!significant) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      lastW = innerWidth;
      lastH = innerHeight;
      gsap.ticker.remove(cull);
      removeEventListener('resize', onResize);
      tl.scrollTrigger?.kill();
      tl.kill();
      buildTimeline(scene, journeyEl);
    }, 250);
  };
  addEventListener('resize', onResize, { passive: true });

  return tl;
}
