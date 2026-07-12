/**
 * Golden-Tests gegen JPL Horizons (autoritative Ephemeriden).
 *
 * Referenz: Horizons OBSERVER-Tabelle, QUANTITIES=4 (Azimut/Elevation),
 * APPARENT=AIRLESS (ohne Refraktion), topozentrisch für den Standort
 * Börwang (47.7° N, 10.3° O, 730 m). Abgerufen am 2026-07-12 über
 * https://ssd.jpl.nasa.gov/api/horizons.api
 *
 * Toleranzen: Sonne/Planeten 1.0° (Standish-Kepler-Elemente sind auf
 * Bogenminuten genau; topozentrische vs. geozentrische Differenz < 0.01°).
 * Mond 0.6° — Meeus-Niedrigpräzision (~0.3°) + topozentrische Parallaxe.
 */
import { describe, it, expect } from 'vitest';
import { horizontalPositions, moonInfo } from './sky';

const LAT = 47.7;
const LON = 10.3;

type Ref = Record<string, { az: number; alt: number }>;

// JPL-Horizons-Referenzwerte (topozentrisch, airless), Grad
const GOLDEN: Record<string, Ref> = {
  '2026-07-12T12:00:00Z': {
    sonne: { az: 198.559349, alt: 63.252874 },
    mond: { az: 250.333801, alt: 53.821007 },
    merkur: { az: 196.081632, alt: 58.525256 },
    venus: { az: 129.415904, alt: 43.630692 },
    mars: { az: 257.233985, alt: 40.772241 },
    jupiter: { az: 171.255772, alt: 62.081891 },
    saturn: { az: 284.558271, alt: -8.270408 },
  },
  '2026-01-15T22:00:00Z': {
    sonne: { az: 318.646651, alt: -57.909373 },
    mond: { az: 33.141089, alt: -68.226984 },
    merkur: { az: 322.157344, alt: -61.589698 },
    venus: { az: 314.313198, alt: -57.223714 },
    mars: { az: 319.848473, alt: -59.653747 },
    jupiter: { az: 148.828574, alt: 61.794249 },
    saturn: { az: 273.32962, alt: -7.271873 },
  },
  '2024-06-01T03:00:00Z': {
    sonne: { az: 50.225169, alt: -4.119278 },
    mond: { az: 118.321638, alt: 20.84502 },
    merkur: { az: 64.622786, alt: 1.39382 },
    venus: { az: 51.172473, alt: -3.878237 },
    mars: { az: 93.886924, alt: 14.640308 },
    jupiter: { az: 59.234927, alt: -0.493561 },
    saturn: { az: 130.110474, alt: 23.191335 },
  },
};

const TOL = { sonne: 1.0, mond: 0.6, default: 1.0 };

/** Winkelabstand zweier Azimute inkl. 360°-Umbruch */
const azDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Fehler am Himmel: Azimut-Differenz auf den Höhenkreis projiziert + Höhenfehler */
function skyError(gotAz: number, gotAlt: number, refAz: number, refAlt: number): number {
  const dAz = azDiff(gotAz, refAz) * Math.cos((refAlt * Math.PI) / 180);
  const dAlt = gotAlt - refAlt;
  return Math.hypot(dAz, dAlt);
}

describe('horizontalPositions gegen JPL Horizons', () => {
  for (const [iso, ref] of Object.entries(GOLDEN)) {
    describe(iso, () => {
      const bodies = horizontalPositions(new Date(iso), LAT, LON);
      for (const [id, want] of Object.entries(ref)) {
        it(`${id}: Az/Alt innerhalb Toleranz`, () => {
          const got = bodies.find((b) => b.id === id);
          expect(got, `Körper ${id} fehlt`).toBeDefined();
          const err = skyError(got!.az, got!.alt, want.az, want.alt);
          const tol = TOL[id as keyof typeof TOL] ?? TOL.default;
          expect(
            err,
            `${id}: got az=${got!.az.toFixed(2)} alt=${got!.alt.toFixed(2)}, ` +
              `ref az=${want.az.toFixed(2)} alt=${want.alt.toFixed(2)} → Fehler ${err.toFixed(2)}°`
          ).toBeLessThan(tol);
        });
      }
    });
  }
});

describe('Eigenschafts-Tests', () => {
  it('Sonne kulminiert im Süden (Az ≈ 180° am Höhen-Maximum)', () => {
    // Kulmination selbst suchen (wahrer Mittag inkl. Zeitgleichung), 10:30–12:30 UTC
    let best = { alt: -90, az: 0 };
    for (let m = 0; m <= 120; m += 2) {
      const t = new Date(Date.UTC(2026, 6, 12, 10, 30 + m));
      const sun = horizontalPositions(t, LAT, LON).find((b) => b.id === 'sonne')!;
      if (sun.alt > best.alt) best = sun;
    }
    expect(azDiff(best.az, 180)).toBeLessThan(1.5);
    expect(best.alt).toBeGreaterThan(60); // Hochsommer, ~65° max
  });

  it('Mondphase: illum ≈ 1 am nächsten Vollmond, ≈ 0 am nächsten Neumond', () => {
    const info = moonInfo(new Date('2026-07-12T12:00:00Z'));
    expect(moonInfo(info.nextFullMoon).illum).toBeGreaterThan(0.97);
    expect(moonInfo(info.nextNewMoon).illum).toBeLessThan(0.03);
  });

  it('Alle Körper liefern endliche Werte in gültigen Bereichen', () => {
    const bodies = horizontalPositions(new Date(), LAT, LON);
    expect(bodies).toHaveLength(7); // Sonne, Mond, 5 Planeten
    for (const b of bodies) {
      expect(Number.isFinite(b.az)).toBe(true);
      expect(Number.isFinite(b.alt)).toBe(true);
      expect(b.az).toBeGreaterThanOrEqual(0);
      expect(b.az).toBeLessThan(360);
      expect(Math.abs(b.alt)).toBeLessThanOrEqual(90);
    }
  });
});
