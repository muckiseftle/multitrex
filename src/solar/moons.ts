import { PLANET_VISUALS } from './config';

/**
 * Monde der Planeten. Bewusst kuratiert — die markanten/sichtbaren, nicht
 * jeder Gesteinsbrocken (Saturn hat 146 Monde, das würde das Bild zumüllen).
 *
 * Maße relativ zum Planeten:
 *  - radius  = Bruchteil des Planeten-Radius (mit Mindestgröße, damit auch
 *              Winzlinge wie Phobos sichtbar bleiben)
 *  - orbit   = Bahnradius in Planeten-Radien (Abstand Zentrum → Mond)
 *  - incl    = Bahnneigung in Grad
 *  - phase   = Startwinkel 0..1 (damit Monde nicht in Reihe stehen)
 *  - speed   = Umlaufgeschwindigkeit (relativ; innere schneller)
 */
export type MoonDef = {
  id: string;
  parent: string;
  name: string;
  radiusFrac: number;
  orbit: number;
  incl: number;
  phase: number;
  speed: number;
  tint: string;
  /** eigene Textur (nur der Erdmond hat eine) */
  texture?: string;
};

export const MOON_DEFS: MoonDef[] = [
  // Erde — der Mond (mit echter Textur + Krater-Relief)
  { id: 'mond', parent: 'erde', name: 'Mond', radiusFrac: 0.27, orbit: 2.6, incl: 18, phase: 0.15, speed: 0.5, tint: '#b8b3a8', texture: 'mond' },

  // Mars — Phobos & Deimos (winzige Felsbrocken)
  { id: 'phobos', parent: 'mars', name: 'Phobos', radiusFrac: 0.09, orbit: 1.9, incl: 12, phase: 0.0, speed: 1.4, tint: '#8a7d70' },
  { id: 'deimos', parent: 'mars', name: 'Deimos', radiusFrac: 0.07, orbit: 2.7, incl: 22, phase: 0.55, speed: 0.85, tint: '#9c8f80' },

  // Jupiter — die vier Galileischen Monde
  { id: 'io', parent: 'jupiter', name: 'Io', radiusFrac: 0.11, orbit: 1.75, incl: 3, phase: 0.1, speed: 1.5, tint: '#e4d27a' },
  { id: 'europa', parent: 'jupiter', name: 'Europa', radiusFrac: 0.10, orbit: 2.2, incl: 6, phase: 0.45, speed: 1.1, tint: '#d8c9a8' },
  { id: 'ganymed', parent: 'jupiter', name: 'Ganymed', radiusFrac: 0.14, orbit: 2.75, incl: 9, phase: 0.75, speed: 0.85, tint: '#9c8d78' },
  { id: 'kallisto', parent: 'jupiter', name: 'Kallisto', radiusFrac: 0.13, orbit: 3.3, incl: 13, phase: 0.3, speed: 0.6, tint: '#6b5f52' },

  // Saturn — Monde außerhalb des Rings (Ring reicht bis 2,35 R)
  { id: 'titan', parent: 'saturn', name: 'Titan', radiusFrac: 0.14, orbit: 3.0, incl: 5, phase: 0.2, speed: 0.9, tint: '#e0a95c' },
  { id: 'rhea', parent: 'saturn', name: 'Rhea', radiusFrac: 0.08, orbit: 3.6, incl: 11, phase: 0.65, speed: 0.65, tint: '#c9c3b6' },
  { id: 'enceladus', parent: 'saturn', name: 'Enceladus', radiusFrac: 0.06, orbit: 2.7, incl: 16, phase: 0.9, speed: 1.2, tint: '#f2f4f7' },

  // Uranus — Titania & Oberon
  { id: 'titania', parent: 'uranus', name: 'Titania', radiusFrac: 0.11, orbit: 2.4, incl: 8, phase: 0.25, speed: 0.9, tint: '#a9b6b8' },
  { id: 'oberon', parent: 'uranus', name: 'Oberon', radiusFrac: 0.10, orbit: 3.0, incl: 14, phase: 0.7, speed: 0.65, tint: '#8fa0a2' },

  // Neptun — Triton (läuft rückwärts, daher speed negativ)
  { id: 'triton', parent: 'neptun', name: 'Triton', radiusFrac: 0.13, orbit: 2.5, incl: 20, phase: 0.4, speed: -0.85, tint: '#c9b6c0' },
];

/** Untergrenze für den Mond-Radius in Szenen-Einheiten (Sichtbarkeit) */
export const MOON_MIN_RADIUS = 0.09;

export function moonsForParent(parentId: string): MoonDef[] {
  return MOON_DEFS.filter((m) => m.parent === parentId);
}

/** Planeten-Scale zu einer parent-id nachschlagen */
export function parentScale(parentId: string): number {
  return PLANET_VISUALS.find((p) => p.id === parentId)?.scale ?? 1;
}
