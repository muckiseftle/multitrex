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

    // Mobile (Bottom-Sheet-Panels): Planet erscheint groß im oberen Drittel.
    // Distanz aus dem HORIZONTALEN Sichtfeld berechnen — im Portrait-Viewport
    // ist das der begrenzende Faktor, sonst wirken die Planeten winzig.
    const mobile = innerWidth < 700;
    const aspect = innerWidth / innerHeight;
    const halfTanH = Math.tan((25 * Math.PI) / 180) * aspect; // halber horizontaler FOV
    // Saturn: Ring (2,35 × Radius) darf seitlich anschneiden — bewusst cinematisch
    const effRadius = v.id === 'saturn' ? (v.scale * 2.35) / 2.2 : v.scale;
    const mobileDist = Math.max(7.5, effRadius / (0.7 * halfTanH));

    // Mobil rückt die Kamera seitlich fast bis zum Planeten (x=±7), sonst
    // vergrößert die Schräg-Distanz den Abstand und der Planet schrumpft wieder
    const camX = mobile ? v.x * 0.75 : v.x * 0.3;
    const sideGap = mobile ? v.x * 0.25 : 0;
    const camZ =
      v.z +
      (mobile
        ? Math.sqrt(Math.max(mobileDist * mobileDist - sideGap * sideGap, 30))
        : v.viewDist);
    // Blick proportional unter den Planeten -> er sitzt auf jedem Gerät gleich hoch
    const lookY = mobile ? -0.17 * mobileDist : 0;

    // Anflug — Kamera startet leicht oberhalb und sinkt auf Planetenhöhe:
    // wirkt wie ein Heranschweben aus dem Orbit
    const approachY = mobile ? 0 : v.scale * 0.5;
    tl.to(cam, { x: camX, y: approachY, z: camZ, duration: arrive - prevDepart }, prevDepart);
    tl.to(look, { x: mobile ? v.x * 0.9 : v.x, y: lookY, z: v.z, duration: arrive - prevDepart }, prevDepart);

    // Verweilen: echter Vorbeiflug — Kamera gleitet seitlich UND über den
    // Planeten hinweg, kommt dabei näher heran (Krater am Terminator).
    const drift = mobile ? 1.2 : v.scale * 0.9 + 1.6;
    const closer = mobile ? 1 : v.viewDist * 0.16; // spürbar näher rankommen
    tl.to(
      cam,
      {
        x: camX + (v.x > 0 ? -drift : drift),
        y: mobile ? 0 : -v.scale * 0.35,
        z: camZ - closer,
        duration: depart - arrive,
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
