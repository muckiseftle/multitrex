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
  // Distanz proportional zur Planetengröße -> jeder Planet füllt konstant
  // ~gleich viel Bild. Kleine Gesteinsplaneten kommen so nah genug heran,
  // dass Krater-Relief am Terminator sichtbar wird.
  const K = id === 'saturn' ? 5.4 : 4.4; // Saturn: extra Abstand für den Ring
  const viewDist = Math.max(5.5, scale * K);
  return {
    id,
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

/** Bewegungsstil je Planet — sorgt für Abwechslung statt Wiederholung */
const PASS_STYLE: Record<string, 'skim' | 'overTop' | 'sideClose' | 'sideWide' | 'headon'> = {
  merkur: 'skim', // tief über die Krater
  venus: 'sideClose', // dicht seitlich vorbei
  erde: 'overTop', // über den Planeten hinweg (Mond zieht mit)
  mars: 'skim', // tief über die Oberfläche
  jupiter: 'sideWide', // majestätisch seitlich vorbei
  saturn: 'overTop', // über die Ringe hinweg
  uranus: 'sideClose', // seitlich vorbei
  neptun: 'headon', // frontal in die Dunkelheit
};

const add = (p: Vec3, dx: number, dy: number, dz: number): Vec3 => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz });

/**
 * Ein-/Ausflug-Wegpunkte für den Durchflug an einem Planeten.
 * WICHTIG: entry hat +z, exit hat -z -> die Kamera fliegt IMMER vorwärts
 * durch die Szene (kein Zurückziehen). Der Planet zieht dabei je nach Stil
 * über, unter oder seitlich am Betrachter vorbei.
 */
export function passWaypoints(v: PlanetVisual, mobile: boolean): PassWaypoints {
  const R = v.scale;
  const P: Vec3 = { x: v.x, y: 0, z: v.z };
  const D = v.viewDist;
  // Panel-Seite: gerade Index -> Panel rechts -> Planet links (und umgekehrt)
  const planetSide = v.index % 2 === 0 ? -1 : 1; // -1 = links, +1 = rechts im Bild
  const camSide = -planetSide; // Kamera auf der Gegenseite

  // Blickziel: Planet auf die Panel-freie Seite versetzt (horizontaler Shift).
  // Die besonnte Seite der Planeten zeigt zum anfliegenden Betrachter (+z),
  // daher bleibt die Kamera auf der +z-Seite -> immer beleuchtet.
  const look = add(P, -planetSide * 0.9 * R, 0, 0);

  if (mobile) {
    // Bottom-Sheet: Planet mittig-oben. Sanfter Gleitflug an der Vorderseite.
    const d = D * 0.9;
    const lookM = add(P, 0, -R * 0.35, 0);
    return {
      entry: add(P, -R * 0.5, R * 0.4, d),
      exit: add(P, R * 0.5, R * 0.5, d * 0.72),
      entryLook: lookM,
      exitLook: lookM,
    };
  }

  const style = PASS_STYLE[v.id] ?? 'overTop';
  switch (style) {
    case 'skim': {
      // Dicht und tief an der besonnten Vorderseite entlang -> Krater groß.
      const d = D * 0.5;
      return {
        entry: add(P, -0.5 * R, R * 0.55, d + 0.12 * D),
        exit: add(P, 0.5 * R, R * 0.35, d - 0.12 * D),
        entryLook: look,
        exitLook: look,
      };
    }
    case 'sideClose': {
      // Planet zieht dicht seitlich vorbei (Kamera driftet vertikal)
      const d = D * 0.8;
      return {
        entry: add(P, camSide * 1.5 * R, R * 0.5, d + 0.12 * D),
        exit: add(P, camSide * 1.7 * R, -R * 0.4, d - 0.12 * D),
        entryLook: look,
        exitLook: look,
      };
    }
    case 'sideWide': {
      const d = D * 1.05;
      return {
        entry: add(P, camSide * 2.0 * R, R * 0.7, d + 0.1 * D),
        exit: add(P, camSide * 2.2 * R, -R * 0.2, d - 0.1 * D),
        entryLook: look,
        exitLook: look,
      };
    }
    case 'headon': {
      // Frontal heran, Planet wächst zur Mitte, dann seitlich vorbei
      return {
        entry: add(P, R * 0.2, R * 0.4, D * 1.15),
        exit: add(P, camSide * 1.3 * R, -R * 0.2, D * 0.4),
        entryLook: add(P, 0, 0, 0),
        exitLook: look,
      };
    }
    case 'overTop':
    default: {
      // Kamera hoch über der besonnten Vorderseite, Planet zieht unten durch
      const d = D * 0.85;
      return {
        entry: add(P, -0.5 * R, R * 1.25, d + 0.12 * D),
        exit: add(P, 0.5 * R, R * 0.95, d - 0.12 * D),
        entryLook: look,
        exitLook: look,
      };
    }
  }
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
