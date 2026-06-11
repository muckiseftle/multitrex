import * as THREE from 'three';
import type { DeviceTier } from './config';

/**
 * Prioritäts-Lade-Queue für Planeten-Texturen.
 *
 * Lädt sequenziell in Reise-Reihenfolge, damit die Bandbreite immer dem
 * nächsten sichtbaren Planeten gehört. `boost(id)` zieht eine Textur vor
 * (wird beim Scrollen aufgerufen: aktueller Planet + 2 muss fertig sein).
 */
export class TextureQueue {
  private loader = new THREE.TextureLoader();
  private queue: string[] = [];
  private loaded = new Map<string, THREE.Texture>();
  private pending = new Map<string, Promise<THREE.Texture>>();
  private onReady: (id: string, tex: THREE.Texture) => void;
  private base: string;
  private running = false;

  constructor(tier: DeviceTier, onReady: (id: string, tex: THREE.Texture) => void) {
    this.base = `/textures/${tier === 'high' ? '2k' : '1k'}/`;
    this.onReady = onReady;
  }

  enqueue(ids: string[]) {
    this.queue.push(...ids.filter((id) => !this.queue.includes(id)));
    void this.run();
  }

  /** Textur ans Queue-Ende? Nein — an die Spitze. */
  boost(id: string) {
    if (this.loaded.has(id) || this.pending.has(id)) return;
    const i = this.queue.indexOf(id);
    if (i > 0) {
      this.queue.splice(i, 1);
      this.queue.unshift(id);
    }
  }

  get(id: string): THREE.Texture | undefined {
    return this.loaded.get(id);
  }

  /** Promise auf eine bestimmte Textur (für „Canvas erst zeigen, wenn …") */
  load(id: string): Promise<THREE.Texture> {
    const hit = this.loaded.get(id);
    if (hit) return Promise.resolve(hit);
    let p = this.pending.get(id);
    if (!p) {
      p = this.loader.loadAsync(`${this.base}${id}.webp`).then((tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        this.loaded.set(id, tex);
        this.pending.delete(id);
        this.onReady(id, tex);
        return tex;
      });
      this.pending.set(id, p);
    }
    return p;
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const id = this.queue.shift()!;
      if (this.loaded.has(id)) continue;
      try {
        await this.load(id);
      } catch {
        // Netzfehler: Planet bleibt bei seiner Tint-Farbe — kein Hard-Fail
      }
    }
    this.running = false;
  }
}
