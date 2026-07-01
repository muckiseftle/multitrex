import planetsJson from '../content/planets/planets.json';

export type PlanetVisual = {
  id: string;
  name: string;
  tint: string;
  /** Skalierung in Szenen-Einheiten (perzeptuell gestaucht, nicht maßstabsgetreu) */
  scale: number;
  /** Position im Raum */
  x: number;
  z: number;
  /** Index auf der Reise (0 = Merkur) */
  index: number;
  /** Kamera-Abstand beim Verweilen — wächst mit der Planetengröße */
  viewDist: number;
};

/** Abstand zwischen zwei Planeten-Stationen in Szenen-Einheiten */
export const STATION_GAP = 42;
/** seitlicher Versatz — Panel sitzt auf der Gegenseite */
export const SIDE_OFFSET = 7;
/** Kamera-Abstand zum Planeten beim Verweilen */
export const VIEW_DISTANCE = 12.5;

export const SUN_POS = { x: 0, y: -13, z: -8 } as const;
export const SUN_RADIUS = 9;

export const JOURNEY_ORDER = [
  'merkur',
  'venus',
  'erde',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptun',
] as const;

/**
 * Reale Größenverhältnisse wären unspielbar (Jupiter = 29× Merkur),
 * deshalb perzeptuelle Stauchung über pow(r, 0.35).
 */
function visualScale(radiusEarths: number): number {
  return 1.8 * Math.pow(radiusEarths, 0.35);
}

export const PLANET_VISUALS: PlanetVisual[] = JOURNEY_ORDER.map((id, i) => {
  const data = planetsJson.find((p) => p.id === id);
  if (!data) throw new Error(`planets.json: ${id} fehlt`);
  const scale = visualScale(data.radiusEarths);
  // Distanz proportional zur Planetengröße -> jeder Planet füllt konstant
  // ~gleich viel Bild. Kleine Gesteinsplaneten kommen so nah genug heran,
  // dass Krater-Relief am Terminator sichtbar wird.
  const K = id === 'saturn' ? 5.4 : 4.4; // Saturn: extra Abstand für den Ring
  const viewDist = Math.max(5.5, scale * K);
  return {
    id,
    name: data.name,
    tint: data.tint,
    scale,
    x: (i % 2 === 0 ? 1 : -1) * SIDE_OFFSET,
    z: -(i + 1) * STATION_GAP,
    index: i,
    viewDist,
  };
});

/* ------------------------------------------------------------------ */
/* Durchflug-Choreografie: jeder Planet eine eigene Kamerabewegung       */
/* ------------------------------------------------------------------ */

export type Vec3 = { x: number; y: number; z: number };
export type PassWaypoints = {
  entry: Vec3;
  exit: Vec3;
  entryLook: Vec3;
  exitLook: Vec3;
  /** optionaler Scheitelpunkt über dem Pol — nötig für Über-den-Planeten-Flüge,
   *  damit die Kamera über die Kugel BOGT statt geradlinig hindurchzuschneiden */
  mid?: Vec3;
  midLook?: Vec3;
};

const add = (p: Vec3, dx: number, dy: number, dz: number): Vec3 => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz });

/**
 * Ein-/Ausflug-Wegpunkte für den ruhigen Vorbeiflug an einem Planeten.
 *
 * Leitprinzip: Der Planet schwebt als Objekt IM Weltall (Sterne ringsum),
 * er füllt NICHT das ganze Bild. Die Kamera bleibt weit weg und bewegt sich
 * nur sanft (leichter Parallax-Drift), damit das Scrollen nicht schwindelig
 * macht. Abwechslung entsteht durch die Position des Planeten im Bild
 * (mal höher/tiefer, mal links/rechts), nicht durch wilde Kamerafahrten.
 */
export function passWaypoints(v: PlanetVisual, mobile: boolean): PassWaypoints {
  const R = v.scale;
  const P: Vec3 = { x: v.x, y: 0, z: v.z };
  // Deutlich zurückversetzt -> Planet ~40 % Bildhöhe, viel Weltall drumherum
  const D = v.viewDist * (mobile ? 1.35 : 1.55);

  if (mobile) {
    // Bottom-Sheet-Panel sitzt UNTEN -> Planet klar in die obere Bildhälfte.
    // look unter den Planeten -> Planet erscheint oben (weg vom Panel).
    const lookM = add(P, 0, -R * 1.5, 0);
    return {
      entry: add(P, -R * 0.6, 0, D),
      exit: add(P, R * 0.6, 0, D * 0.9),
      entryLook: lookM,
      exitLook: lookM,
    };
  }

  // Panel-Seite folgt dem CSS (nth-of-type zählt die Sonnen-Sektion mit!):
  // v.index gerade  -> Panel LINKS  -> Planet RECHTS (+1)
  // v.index ungerade -> Panel RECHTS -> Planet LINKS  (-1)
  const planetSide = v.index % 2 === 0 ? 1 : -1;

  // Planet weit auf die Panel-freie Bildhälfte schieben: Blickziel auf die
  // Panel-Seite versetzt -> Planet erscheint auf der Gegenseite, ohne Überlapp.
  const look = add(P, -planetSide * 2.1 * R, 0, 0);
  const highCam = v.index % 2 === 0; // Abwechslung: mal leicht von oben, mal seitlich
  const camY = highCam ? R * 0.6 : -R * 0.1;
  const camX = planetSide * 0.3 * R;

  // Sanfter Parallax: Kamera driftet nur wenig, Planet „atmet" langsam vorbei
  const driftX = 1.0 * R;
  return {
    entry: add(P, camX - driftX, camY + R * 0.1, D),
    exit: add(P, camX + driftX, camY - R * 0.1, D * 0.92),
    entryLook: look,
    exitLook: look,
  };
}

export type DeviceTier = 'high' | 'low';
export type TextureSet = '4k' | '2k' | '1k';

/**
 * Heuristik für schwache Geräte — entscheidet DPR, Geometrie, Extras.
 * Bewusst NICHT über pointer:coarse: moderne iPhones/iPads sind GPU-stark
 * und sollen die volle Qualität bekommen.
 */
export function detectTier(): DeviceTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  const lowMem = (nav.deviceMemory ?? 8) <= 4;
  return lowCores || lowMem ? 'low' : 'high';
}

/** Texturauflösung passend zur tatsächlichen Render-Auflösung wählen */
export function pickTextureSet(tier: DeviceTier): TextureSet {
  const devicePx = Math.max(screen.width, screen.height) * Math.min(devicePixelRatio, 2);
  if (tier === 'high' && devicePx > 1800) return '4k';
  if (devicePx > 900) return '2k';
  return '1k';
}
