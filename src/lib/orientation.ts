/**
 * Orientierungs- und Projektions-Mathematik für den AR-Himmelsscanner.
 *
 * Reine Funktionen, getrennt vom DOM — dadurch per Vitest testbar
 * (siehe orientation.test.ts). Konventionen:
 * - Weltkoordinaten: X = Ost, Y = Nord, Z = oben (ENU).
 * - Gerätekoordinaten (W3C): X = rechts, Y = oben (Displayoberkante),
 *   Z = aus dem Display heraus; Rückkamera blickt entlang −Z.
 * - Mat3: 3×3 zeilenweise als Array[9], bildet Gerät→Welt ab.
 */

const DEG = Math.PI / 180;
const norm360 = (d: number) => ((d % 360) + 360) % 360;

export type Mat3 = number[];
export type Quat = [number, number, number, number]; // [x, y, z, w]

/**
 * W3C-Eulerwinkel (ZXY, intrinsisch) -> Rotationsmatrix Gerät→Welt.
 * Entspricht der Matrix aus der DeviceOrientation-Spezifikation.
 */
export function eulerToMatrix(alphaDeg: number, betaDeg: number, gammaDeg: number): Mat3 {
  const a = alphaDeg * DEG;
  const b = betaDeg * DEG;
  const g = gammaDeg * DEG;
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);
  return [
    cA * cG - sA * sB * sG, -cB * sA, cA * sG + cG * sA * sB,
    cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB,
    -cB * sG, sB, cB * cG,
  ];
}

/**
 * iOS: alpha aus webkitCompassHeading rekonstruieren — REGIME-ABHÄNGIG.
 *
 * Der Kompasswert h ist das Heading der Projektion der Geräte-Oberkante
 * (Y-Achse) auf die Horizontebene. Deren Weltrichtung ist
 * (−sinα·cosβ, cosα·cosβ, sinβ): für cosβ > 0 gilt α = 360−h, für
 * cosβ < 0 (Kamera über den Horizont gekippt — der Normalfall beim
 * Himmels-Scannen!) gilt α = 180−h. Die alte Formel „immer 360−h" war
 * deshalb beim Zeigen in den Himmel um bis zu 180° falsch.
 *
 * Um β = 90° (cosβ ≈ 0) ist h nicht definiert und springt — eine Hysterese
 * (±10°) hält das zuletzt gültige Regime, bis das Gerät klar gekippt ist.
 */
export function iosAlphaFromCompass(
  compassHeadingDeg: number,
  betaDeg: number,
  prevFlipped: boolean
): { alphaDeg: number; flipped: boolean } {
  const cB = Math.cos(betaDeg * DEG);
  const HYST = 0.17; // ≈ cos(80°): erst >10° jenseits der Senkrechten umschalten
  let flipped = prevFlipped;
  if (cB > HYST) flipped = false;
  else if (cB < -HYST) flipped = true;
  const alphaDeg = norm360((flipped ? 180 : 360) - compassHeadingDeg);
  return { alphaDeg, flipped };
}

/**
 * Sensor-Quaternion (AbsoluteOrientationSensor, Gerät→Welt) -> Mat3.
 * Verifiziert: identische Konvention wie eulerToMatrix (siehe Tests).
 */
export function quatToMatrix(q: Quat): Mat3 {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}

/** Mat3 -> Quaternion (für die Slerp-Glättung) */
export function matrixToQuat(R: Mat3): Quat {
  const m00 = R[0], m01 = R[1], m02 = R[2];
  const m10 = R[3], m11 = R[4], m12 = R[5];
  const m20 = R[6], m21 = R[7], m22 = R[8];
  const tr = m00 + m11 + m22;
  let w: number, x: number, y: number, z: number, S: number;
  if (tr > 0) {
    S = Math.sqrt(tr + 1) * 2; w = 0.25 * S;
    x = (m21 - m12) / S; y = (m02 - m20) / S; z = (m10 - m01) / S;
  } else if (m00 > m11 && m00 > m22) {
    S = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / S;
    x = 0.25 * S; y = (m01 + m10) / S; z = (m02 + m20) / S;
  } else if (m11 > m22) {
    S = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / S;
    x = (m01 + m10) / S; y = 0.25 * S; z = (m12 + m21) / S;
  } else {
    S = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / S;
    x = (m02 + m20) / S; y = (m12 + m21) / S; z = 0.25 * S;
  }
  return [x, y, z, w];
}

/**
 * Weiche Ausrichtung: Quaternion-Slerp mit Slew-Rate-Begrenzung.
 * Ruhig beim Stillhalten, flüssig beim Schwenken; Ausreißer werden
 * herausgemittelt statt verfolgt. Zustand über createSmoother kapseln.
 */
export function createSmoother(follow = 0.16, maxSlewRad = 0.07) {
  let smoothQ: Quat | null = null;
  return {
    reset() {
      smoothQ = null;
    },
    step(R: Mat3): Mat3 {
      const q = matrixToQuat(R);
      if (!smoothQ) {
        smoothQ = q;
        return R;
      }
      let dot = q[0] * smoothQ[0] + q[1] * smoothQ[1] + q[2] * smoothQ[2] + q[3] * smoothQ[3];
      if (dot < 0) {
        for (let i = 0; i < 4; i++) q[i] = -q[i];
        dot = -dot;
      }
      dot = Math.min(1, Math.max(-1, dot));
      const delta = 2 * Math.acos(Math.min(1, dot));
      let step = follow * delta;
      if (step > maxSlewRad) step = maxSlewRad;
      const t = delta > 1e-6 ? step / delta : 0;
      let a: number, b: number;
      if (dot > 0.9995) {
        a = 1 - t; b = t;
      } else {
        const th = Math.acos(dot), s = Math.sin(th);
        a = Math.sin((1 - t) * th) / s;
        b = Math.sin(t * th) / s;
      }
      const o: Quat = [
        smoothQ[0] * a + q[0] * b, smoothQ[1] * a + q[1] * b,
        smoothQ[2] * a + q[2] * b, smoothQ[3] * a + q[3] * b,
      ];
      const n = Math.hypot(o[0], o[1], o[2], o[3]) || 1;
      smoothQ = [o[0] / n, o[1] / n, o[2] / n, o[3] / n];
      return quatToMatrix(smoothQ);
    },
  };
}

/** Weltrichtung (Az von Nord über Ost, Höhe) -> Einheitsvektor in Gerätekoordinaten */
export function worldToDevice(R: Mat3, azDeg: number, altDeg: number): [number, number, number] {
  const a = azDeg * DEG;
  const el = altDeg * DEG;
  const E = Math.sin(a) * Math.cos(el);
  const N = Math.cos(a) * Math.cos(el);
  const U = Math.sin(el);
  // Gerät→Welt transponiert anwenden = Welt→Gerät
  return [
    E * R[0] + N * R[3] + U * R[6],
    E * R[1] + N * R[4] + U * R[7],
    E * R[2] + N * R[5] + U * R[8],
  ];
}

/** Blickrichtung der Rückkamera (−Z des Geräts) als Az/Höhe in Grad */
export function lookDirection(R: Mat3): { azDeg: number; altDeg: number } {
  // Kameraachse in Weltkoordinaten = −(Spalte 2 von R)
  const e = -R[2], n = -R[5], u = -R[8];
  return {
    azDeg: norm360(Math.atan2(e, n) / DEG),
    altDeg: Math.asin(Math.max(-1, Math.min(1, u))) / DEG,
  };
}

export type Projection = {
  /** Bildkoordinaten (nur gültig wenn depth > 0) */
  x: number;
  y: number;
  /** Tiefe entlang der Kameraachse; <= 0: hinter der Kamera */
  depth: number;
  /** Richtungsvektor in Bildschirm-Ebene (für Randpfeile) */
  rx: number;
  ry: number;
};

/**
 * Gerätevektor -> Bildschirmkoordinaten (Lochkamera-Projektion).
 * screenAngleDeg = screen.orientation.angle gleicht die Rotation des
 * CSS-Koordinatensystems gegenüber dem Gerät aus.
 */
export function projectToScreen(
  d: [number, number, number],
  viewW: number,
  viewH: number,
  fovXDeg: number,
  screenAngleDeg: number
): Projection {
  const ang = screenAngleDeg * DEG;
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const rx = d[0] * cs + d[1] * sn;
  const ry = -d[0] * sn + d[1] * cs;
  const depth = -d[2];
  const focal = viewW / 2 / Math.tan((fovXDeg / 2) * DEG);
  return {
    x: viewW / 2 + (depth > 1e-9 ? (focal * rx) / depth : 0),
    y: viewH / 2 - (depth > 1e-9 ? (focal * ry) / depth : 0),
    depth,
    rx,
    ry,
  };
}

/**
 * Effektives horizontales Sichtfeld des SICHTBAREN Bildausschnitts.
 *
 * Das Video läuft mit object-fit: cover — im Portrait wird das Kamerabild
 * stark beschnitten. Ein fest angenommenes 62°-FOV war deshalb im Portrait
 * um den Faktor ~1,5–1,8 zu groß, und Marker saßen neben den Objekten.
 * Hier: FOV der nativen Bildbreite aus dem Seitenverhältnis ableiten
 * (Lochkamera: tan ∝ Bildgröße), dann um den Cover-Beschnitt korrigieren.
 *
 * @param nativeLongSideFovDeg FOV über die LANGE Seite des Sensors (~64°)
 */
export function effectiveFovXDeg(
  viewW: number,
  viewH: number,
  videoW: number,
  videoH: number,
  nativeLongSideFovDeg = 64
): number {
  if (!videoW || !videoH || !viewW || !viewH) return viewW < viewH ? 46 : 62; // Fallback
  const long = Math.max(videoW, videoH);
  const tanHalfWidth = Math.tan((nativeLongSideFovDeg / 2) * DEG) * (videoW / long);
  const scale = Math.max(viewW / videoW, viewH / videoH);
  const visibleFrac = Math.min(1, viewW / (videoW * scale));
  return (2 * Math.atan(tanHalfWidth * visibleFrac)) / DEG;
}

/** Winkel auf (−180, 180] normalisieren — für Offsets/Differenzen */
export function norm180(d: number): number {
  const x = norm360(d);
  return x > 180 ? x - 360 : x;
}
