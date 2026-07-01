/**
 * Astronomische Berechnungen — rein clientseitig, ohne API/Tracking.
 *
 * Genauigkeit: „Amateur-Niveau" (wenige Grad). Reicht, um die Mondphase und
 * die grobe Sichtbarkeit der Planeten (Abend-/Morgenhimmel) korrekt zu zeigen.
 * Basis: Keplersche Bahnelemente (Standish/JPL, gültig ~1800–2050) und
 * Meeus' Niedrigpräzisions-Formeln für Sonne und Mond.
 */

const DEG = Math.PI / 180;
const norm360 = (d: number) => ((d % 360) + 360) % 360;
const norm180 = (d: number) => {
  const x = norm360(d);
  return x > 180 ? x - 360 : x;
};

/** Julianisches Datum */
export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}
/** Tage seit J2000.0 */
function daysSinceJ2000(date: Date): number {
  return julianDay(date) - 2451545.0;
}

/* ------------------------------------------------------------------ */
/* Mond                                                                */
/* ------------------------------------------------------------------ */

/** Geozentrische Ekliptik-Länge der Sonne (Grad) */
function sunLongitude(d: number): number {
  const M = norm360(357.5291 + 0.98560028 * d);
  const L0 = norm360(280.459 + 0.98564736 * d);
  const C = 1.9148 * Math.sin(M * DEG) + 0.02 * Math.sin(2 * M * DEG);
  return norm360(L0 + C);
}

/** Geozentrische Ekliptik-Länge des Mondes (Grad, Niedrigpräzision) */
function moonLongitude(d: number): number {
  const L = 218.316 + 13.176396 * d; // mittlere Länge
  const M = (134.963 + 13.064993 * d) * DEG; // mittlere Anomalie
  const F = (93.272 + 13.22935 * d) * DEG; // Argument der Breite
  const D = (297.8502 + 12.19074912 * d) * DEG; // mittlere Elongation
  const lon =
    L +
    6.289 * Math.sin(M) +
    1.274 * Math.sin(2 * D - M) +
    0.658 * Math.sin(2 * D) +
    0.214 * Math.sin(2 * M) -
    0.186 * Math.sin((357.529 + 0.98560028 * d) * DEG) -
    0.114 * Math.sin(2 * F);
  return norm360(lon);
}

const SYNODIC = 29.530588853;

export type MoonInfo = {
  phaseAngle: number; // 0=Neumond, 90=erstes Viertel, 180=Vollmond, 270=letztes Viertel
  illum: number; // beleuchteter Anteil 0..1
  ageDays: number; // Alter seit Neumond
  waxing: boolean; // zunehmend?
  name: string;
  nextNewMoon: Date;
  nextFullMoon: Date;
};

export function moonInfo(date: Date): MoonInfo {
  const d = daysSinceJ2000(date);
  const elong = norm360(moonLongitude(d) - sunLongitude(d));
  const illum = (1 - Math.cos(elong * DEG)) / 2;
  const ageDays = (elong / 360) * SYNODIC;
  const waxing = elong < 180;

  let name = 'Neumond';
  if (elong < 5 || elong > 355) name = 'Neumond';
  else if (elong < 85) name = 'Zunehmende Sichel';
  else if (elong < 95) name = 'Erstes Viertel';
  else if (elong < 175) name = 'Zunehmender Mond';
  else if (elong < 185) name = 'Vollmond';
  else if (elong < 265) name = 'Abnehmender Mond';
  else if (elong < 275) name = 'Letztes Viertel';
  else name = 'Abnehmende Sichel';

  const msPerDeg = (SYNODIC * 86400000) / 360;
  const nextNewMoon = new Date(date.getTime() + norm360(360 - elong) * msPerDeg);
  const nextFullMoon = new Date(date.getTime() + norm360(180 - elong) * msPerDeg);

  return { phaseAngle: elong, illum, ageDays, waxing, name, nextNewMoon, nextFullMoon };
}

/* ------------------------------------------------------------------ */
/* Planeten (Keplersche Bahnelemente)                                  */
/* ------------------------------------------------------------------ */

// [a(AE), e, i, L, ϖ (Länge d. Perihels), Ω] und deren Änderung / Jahrhundert
type El = [number, number, number, number, number, number];
type Planet = { id: string; name: string; el: El; rate: El };

const PLANETS: Planet[] = [
  {
    id: 'merkur',
    name: 'Merkur',
    el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  },
  {
    id: 'venus',
    name: 'Venus',
    el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  },
  {
    id: 'erde',
    name: 'Erde',
    el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  },
  {
    id: 'mars',
    name: 'Mars',
    el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  },
  {
    id: 'saturn',
    name: 'Saturn',
    el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  },
];

/** Heliozentrische Ekliptik-Koordinaten (AE) eines Planeten */
function helioXYZ(p: Planet, T: number): [number, number, number] {
  const a = p.el[0] + p.rate[0] * T;
  const e = p.el[1] + p.rate[1] * T;
  const i = (p.el[2] + p.rate[2] * T) * DEG;
  const L = p.el[3] + p.rate[3] * T;
  const wbar = p.el[4] + p.rate[4] * T;
  const O = (p.el[5] + p.rate[5] * T) * DEG;
  const w = (wbar - (p.el[5] + p.rate[5] * T)) * DEG; // Argument des Perihels
  let M = norm180(L - wbar) * DEG;

  // Kepler-Gleichung lösen
  let E = M;
  for (let k = 0; k < 8; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // in Ekliptik-Koordinaten drehen (Argument Perihel, Inklination, Knoten)
  const cw = Math.cos(w),
    sw = Math.sin(w);
  const cO = Math.cos(O),
    sO = Math.sin(O);
  const ci = Math.cos(i),
    si = Math.sin(i);
  const x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  const y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  const z = sw * si * xp + cw * si * yp;
  return [x, y, z];
}

export type PlanetVis = {
  id: string;
  name: string;
  /** 'ganze-nacht' | 'abend' | 'morgen' | 'nah-sonne' */
  state: 'ganze-nacht' | 'abend' | 'morgen' | 'nah-sonne';
  elongation: number; // Grad, signiert (+ = östlich der Sonne)
};

const STATE_LABEL: Record<PlanetVis['state'], string> = {
  'ganze-nacht': 'Die ganze Nacht',
  abend: 'Abendhimmel',
  morgen: 'Morgenhimmel',
  'nah-sonne': 'Zu nah an der Sonne',
};
export function stateLabel(s: PlanetVis['state']): string {
  return STATE_LABEL[s];
}

/** Sichtbarkeit der mit bloßem Auge sichtbaren Planeten heute Nacht */
export function planetVisibility(date: Date): PlanetVis[] {
  const T = daysSinceJ2000(date) / 36525;
  const earth = PLANETS.find((p) => p.id === 'erde')!;
  const [ex, ey] = helioXYZ(earth, T);
  const sunLon = norm360(Math.atan2(-ey, -ex) / DEG); // geozentrische Sonnenlänge

  const out: PlanetVis[] = [];
  for (const p of PLANETS) {
    if (p.id === 'erde') continue;
    const [x, y] = helioXYZ(p, T);
    const gx = x - ex;
    const gy = y - ey;
    const lon = norm360(Math.atan2(gy, gx) / DEG);
    const elong = norm180(lon - sunLon); // + = östlich (Abendhimmel), − = westlich (Morgen)
    const abs = Math.abs(elong);

    let state: PlanetVis['state'];
    if (abs < 15) state = 'nah-sonne';
    else if (abs > 150) state = 'ganze-nacht';
    else if (elong > 0) state = 'abend';
    else state = 'morgen';

    out.push({ id: p.id, name: p.name, state, elongation: elong });
  }
  return out;
}
