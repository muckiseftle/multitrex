/**
 * Textur-Pipeline: migration/textures/*.jpg -> public/textures/{2k,1k}/*.webp
 *
 * Quelle: Solar System Scope (CC BY 4.0) — Attribution im Impressum.
 * Aufruf: node scripts/build-textures.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'migration/textures';
const OUT = 'public/textures';

// Zielname -> Quelldatei
const MAP = {
  merkur: 'mercury.jpg',
  venus: 'venus_atmosphere.jpg',
  erde: 'earth_daymap.jpg',
  'erde-nacht': 'earth_nightmap.jpg',
  'erde-wolken': 'earth_clouds.jpg',
  mars: 'mars.jpg',
  jupiter: 'jupiter.jpg',
  saturn: 'saturn.jpg',
  'saturn-ring': 'saturn_ring_alpha.png',
  uranus: 'uranus.jpg',
  neptun: 'neptune.jpg',
};

const SIZES = [
  { dir: '2k', width: 2048 },
  { dir: '1k', width: 1024 },
];

for (const { dir } of SIZES) {
  await mkdir(path.join(OUT, dir), { recursive: true });
}

let total2k = 0;
let total1k = 0;

for (const [name, srcFile] of Object.entries(MAP)) {
  for (const { dir, width } of SIZES) {
    const out = path.join(OUT, dir, `${name}.webp`);
    const info = await sharp(path.join(SRC, srcFile))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 })
      .toFile(out);
    if (dir === '2k') total2k += info.size;
    else total1k += info.size;
    console.log(`${out}  ${(info.size / 1024).toFixed(0)} kB`);
  }
}

console.log(`\nGesamt 2k: ${(total2k / 1024 / 1024).toFixed(2)} MB`);
console.log(`Gesamt 1k: ${(total1k / 1024 / 1024).toFixed(2)} MB`);
