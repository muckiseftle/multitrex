/**
 * Tests der Orientierungs-/Projektions-Schicht des AR-Scanners.
 * Deckt genau die Fehlerklassen ab, die „Marker passen nicht" verursachen:
 * iOS-Kompass-Regime (180°-Flip), Quaternion-Konvention, Projektion,
 * Portrait-FOV mit Cover-Beschnitt.
 */
import { describe, it, expect } from 'vitest';
import {
  eulerToMatrix,
  iosAlphaFromCompass,
  quatToMatrix,
  matrixToQuat,
  createSmoother,
  worldToDevice,
  lookDirection,
  projectToScreen,
  effectiveFovXDeg,
} from './orientation';

const DEG = Math.PI / 180;

describe('eulerToMatrix (W3C ZXY)', () => {
  it('flach, Oberkante nach Norden = Identität (Gerät = Welt)', () => {
    const R = eulerToMatrix(0, 0, 0);
    const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    R.forEach((v, i) => expect(v).toBeCloseTo(I[i], 10));
  });

  it('α=90° (flach, Oberkante nach Westen): Geräte-Y → −Ost', () => {
    const R = eulerToMatrix(90, 0, 0);
    // Spalte 1 = Bild der Geräte-Y-Achse in Weltkoordinaten (E, N, U)
    expect(R[1]).toBeCloseTo(-1, 10); // Ost-Komponente
    expect(R[4]).toBeCloseTo(0, 10);
    expect(R[7]).toBeCloseTo(0, 10);
  });

  it('aufrecht (β=90°), Kamera nach Süden: α=180 → Blickrichtung Süd, Höhe 0', () => {
    const R = eulerToMatrix(180, 90, 0);
    const look = lookDirection(R);
    expect(look.azDeg).toBeCloseTo(180, 6);
    expect(look.altDeg).toBeCloseTo(0, 6);
  });

  it('flach auf dem Rücken (β=180°): Kamera zeigt zum Zenit', () => {
    const R = eulerToMatrix(0, 180, 0);
    expect(lookDirection(R).altDeg).toBeCloseTo(90, 6);
  });
});

describe('iosAlphaFromCompass — Regime-Korrektur (der 180°-Bugfix)', () => {
  it('flacher als senkrecht (β=45°): α = 360 − Heading', () => {
    const r = iosAlphaFromCompass(90, 45, false);
    expect(r.alphaDeg).toBeCloseTo(270);
    expect(r.flipped).toBe(false);
  });

  it('über den Horizont gekippt (β=135°): α = 180 − Heading (vorher falsch!)', () => {
    const r = iosAlphaFromCompass(90, 135, false);
    expect(r.alphaDeg).toBeCloseTo(90);
    expect(r.flipped).toBe(true);
  });

  it('Hysterese: nahe der Senkrechten bleibt das letzte Regime erhalten', () => {
    // β=92° liegt in der Hysterese-Zone (cos β ≈ −0.035)
    expect(iosAlphaFromCompass(90, 92, false).flipped).toBe(false);
    expect(iosAlphaFromCompass(90, 92, true).flipped).toBe(true);
    // deutlich jenseits: Umschalten
    expect(iosAlphaFromCompass(90, 110, false).flipped).toBe(true);
    expect(iosAlphaFromCompass(90, 60, true).flipped).toBe(false);
  });

  it('Konsistenz: rekonstruiertes α reproduziert die wahre Orientierung', () => {
    // Wahre Lage: α=140°, β=120° (Kamera über Horizont), γ=0.
    // Heading der Geräte-Oberkante daraus ableiten und rückrechnen.
    const alphaTrue = 140, beta = 120;
    const R = eulerToMatrix(alphaTrue, beta, 0);
    const topE = R[1], topN = R[4]; // Weltrichtung der Geräte-Y-Achse
    const heading = ((Math.atan2(topE, topN) / DEG) + 360) % 360;
    const r = iosAlphaFromCompass(heading, beta, false);
    expect(r.alphaDeg).toBeCloseTo(alphaTrue, 6);
  });
});

describe('quatToMatrix — AbsoluteOrientationSensor-Konvention', () => {
  it('Identitäts-Quaternion = Identitätsmatrix', () => {
    const R = quatToMatrix([0, 0, 0, 1]);
    const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    R.forEach((v, i) => expect(v).toBeCloseTo(I[i], 10));
  });

  it('90° um Z (Oberkante nach Westen) entspricht eulerToMatrix(90,0,0)', () => {
    const s = Math.SQRT1_2;
    const R = quatToMatrix([0, 0, s, s]);
    const E = eulerToMatrix(90, 0, 0);
    R.forEach((v, i) => expect(v).toBeCloseTo(E[i], 10));
  });

  it('Roundtrip matrixToQuat ∘ quatToMatrix ist stabil', () => {
    const R = eulerToMatrix(211, 118, -37);
    const R2 = quatToMatrix(matrixToQuat(R));
    R.forEach((v, i) => expect(v).toBeCloseTo(R2[i], 8));
  });
});

describe('worldToDevice + projectToScreen', () => {
  const W = 390, H = 844;

  it('Objekt exakt in Kamerarichtung landet in der Bildmitte', () => {
    const R = eulerToMatrix(180, 90, 0); // Kamera nach Süden, Horizont
    const d = worldToDevice(R, 180, 0);
    const p = projectToScreen(d, W, H, 45, 0);
    expect(p.depth).toBeCloseTo(1, 6);
    expect(p.x).toBeCloseTo(W / 2, 4);
    expect(p.y).toBeCloseTo(H / 2, 4);
  });

  it('höheres Objekt erscheint im Bild weiter oben', () => {
    const R = eulerToMatrix(180, 90, 0);
    const p = projectToScreen(worldToDevice(R, 180, 10), W, H, 45, 0);
    expect(p.y).toBeLessThan(H / 2);
  });

  it('Objekt östlich der Blickrichtung erscheint links (Kamera nach Süden)', () => {
    // Blick nach Süden: Osten liegt links im Bild
    const R = eulerToMatrix(180, 90, 0);
    const p = projectToScreen(worldToDevice(R, 170, 0), W, H, 45, 0);
    expect(p.x).toBeLessThan(W / 2);
  });

  it('Objekt hinter der Kamera hat depth < 0', () => {
    const R = eulerToMatrix(180, 90, 0);
    const p = projectToScreen(worldToDevice(R, 0, 0), W, H, 45, 0);
    expect(p.depth).toBeLessThan(0);
  });

  it('Sichtfeld-Rand: Objekt bei halbem FOV-Winkel liegt exakt am Bildrand', () => {
    const R = eulerToMatrix(180, 90, 0);
    const fov = 45;
    // Blick nach Süden: Az 180+22.5 = westlich der Blickrichtung = rechter Bildrand
    const p = projectToScreen(worldToDevice(R, 180 + fov / 2, 0), W, H, fov, 0);
    expect(p.x).toBeCloseTo(W, 4);
  });
});

describe('effectiveFovXDeg — Cover-Beschnitt', () => {
  it('Landscape-Ansicht + Landscape-Video: nahezu volles FOV', () => {
    expect(effectiveFovXDeg(844, 390, 1280, 720, 64)).toBeGreaterThan(60);
  });

  it('Portrait: deutlich schmaler als die alten 62° (der B4-Fix)', () => {
    const fov = effectiveFovXDeg(390, 844, 720, 1280, 64);
    expect(fov).toBeGreaterThan(25);
    expect(fov).toBeLessThan(45);
  });

  it('ohne Videodaten: plausibler Fallback', () => {
    expect(effectiveFovXDeg(390, 844, 0, 0)).toBe(46);
    expect(effectiveFovXDeg(844, 390, 0, 0)).toBe(62);
  });
});

describe('createSmoother', () => {
  it('erste Messung wird direkt übernommen', () => {
    const sm = createSmoother();
    const R = eulerToMatrix(123, 45, -10);
    const out = sm.step(R);
    R.forEach((v, i) => expect(v).toBeCloseTo(out[i], 10));
  });

  it('Einzel-Ausreißer bewegt die Ausrichtung kaum (Slew-Limit)', () => {
    const sm = createSmoother(0.16, 0.07);
    sm.step(eulerToMatrix(0, 90, 0));
    const out = sm.step(eulerToMatrix(160, 90, 0)); // 160°-Sprung
    const look = lookDirection(out);
    // Ausgang war Az 0° — max. ~4° Bewegung pro Frame statt 160°
    const moved = Math.min(look.azDeg, 360 - look.azDeg);
    expect(moved).toBeLessThan(6);
  });

  it('echter Schwenk kommt in endlicher Zeit an', () => {
    const sm = createSmoother(0.16, 0.07);
    sm.step(eulerToMatrix(0, 90, 0));
    let out = eulerToMatrix(0, 90, 0);
    for (let i = 0; i < 40; i++) out = sm.step(eulerToMatrix(60, 90, 0));
    const look = lookDirection(out);
    expect(Math.abs(look.azDeg - lookDirection(eulerToMatrix(60, 90, 0)).azDeg)).toBeLessThan(2);
  });
});
