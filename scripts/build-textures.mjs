/**
 * Textur-Pipeline: migration/textures/*.jpg -> public/textures/{4k,2k,1k}/*.webp
 *
 * Nimmt je Planet die beste verfügbare Quelle (8k > 4k > 2k).
 * Quelle: Solar System Scope (CC BY 4.0) — Attribution im Impressum.
 * Aufruf: node scripts/build-textures.mjs
 */
import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'migration/textures';
const OUT = 'public/textures';

// Zielname -> Quelldateien in Präferenz-Reihenfolge (beste zuerst)
const MAP = {
  merkur: ['8k_mercury.jpg', 'mercury.jpg'],
  venus: ['4k_venus_atmosphere.jpg', 'venus_atmosphere.jpg'],
  erde: ['8k_earth_daymap.jpg', 'earth_daymap.jpg'],
  'erde-nacht': ['8k_earth_nightmap.jpg', 'earth_nightmap.jpg'],
  'erde-wolken': ['8k_earth_clouds.jpg', 'earth_clouds.jpg'],
  mars: ['8k_mars.jpg', 'mars.jpg'],
  jupiter: ['8k_jupiter.jpg', 'jupiter.jpg'],
  saturn: ['8k_saturn.jpg', 'saturn.jpg'],
  'saturn-ring': ['saturn_ring_alpha.png'],
  uranus: ['uranus.jpg'],
  neptun: ['neptune.jpg'],
  // Erdmond — dient zugleich als Bump-Quelle (Krater-Relief)
  mond: ['8k_moon.jpg', '2k_moon.jpg'],
};

const SIZES = [
  { dir: '4k', width: 4096 },
  { dir: '2k', width: 2048 },
  { dir: '1k', width: 1024 },
];

async function firstExisting(candidates) {
  for (const c of candidates) {
    const p = path.join(SRC, c);
    try {
      await access(p);
      return p;
    } catch {
      /* nächste Quelle probieren */
    }
  }
  throw new Error(`Keine Quelle gefunden für: ${candidates.join(', ')}`);
}

for (const { dir } of SIZES) {
  await mkdir(path.join(OUT, dir), { recursive: true });
}

const totals = { '4k': 0, '2k': 0, '1k': 0 };

for (const [name, candidates] of Object.entries(MAP)) {
  const src = await firstExisting(candidates);
  for (const { dir, width } of SIZES) {
    const out = path.join(OUT, dir, `${name}.webp`);
    const info = await sharp(src)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toFile(out);
    totals[dir] += info.size;
    console.log(`${out}  ${(info.size / 1024).toFixed(0)} kB  (Quelle: ${path.basename(src)})`);
  }
}

for (const [dir, bytes] of Object.entries(totals)) {
  console.log(`Gesamt ${dir}: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}
