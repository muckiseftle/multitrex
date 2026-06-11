import planetsJson from '../content/planets/planets.json';

export type PlanetVisual = {
  id: string;
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
  return {
    id,
    tint: data.tint,
    scale,
    x: (i % 2 === 0 ? 1 : -1) * SIDE_OFFSET,
    z: -(i + 1) * STATION_GAP,
    index: i,
    // Gasriesen brauchen Abstand (Saturn extra wegen Ring)
    viewDist: VIEW_DISTANCE + Math.max(0, scale - 1.8) * (id === 'saturn' ? 3.4 : 2.4),
  };
});

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
