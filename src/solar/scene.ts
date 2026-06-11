import * as THREE from 'three';
import {
  PLANET_VISUALS,
  SUN_POS,
  SUN_RADIUS,
  type DeviceTier,
} from './config';
import { TextureQueue } from './loader';

/* ------------------------------------------------------------------ */
/* Sonnen-Shader: FBM-Granulation + Fresnel-Rim — kein Postprocessing  */
/* ------------------------------------------------------------------ */

const SUN_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPos;

  // kompaktes 3D-Value-Noise
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // langsam wandernde Granulation
    float g = fbm(vPos * 0.55 + vec3(uTime * 0.04, 0.0, uTime * 0.03));
    float g2 = fbm(vPos * 1.8 - vec3(0.0, uTime * 0.06, 0.0));

    vec3 deep = vec3(0.98, 0.45, 0.08);   // tiefes Orange
    vec3 hot  = vec3(1.0, 0.86, 0.55);    // helles Gelb
    vec3 core = vec3(1.0, 0.98, 0.9);     // Weißglut
    vec3 col = mix(deep, hot, smoothstep(0.25, 0.75, g));
    col = mix(col, core, smoothstep(0.55, 0.95, g2 * g));

    // Fresnel-Rim: Rand glüht weicher aus
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
    col += vec3(1.0, 0.6, 0.25) * fresnel * 0.9;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** radialer Glow als Canvas-Textur (Sprite) — ersetzt Bloom */
function makeGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 200, 120, 0.85)');
  grad.addColorStop(0.25, 'rgba(255, 150, 60, 0.4)');
  grad.addColorStop(0.6, 'rgba(255, 110, 40, 0.12)');
  grad.addColorStop(1, 'rgba(255, 100, 30, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */

export class SolarScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly planets = new Map<string, THREE.Mesh>();
  readonly queue: TextureQueue;

  /** Punkt, auf den die Kamera schaut — wird von der Timeline getweent */
  readonly lookTarget = new THREE.Vector3(0, 0, -40);

  private sunMaterial: THREE.ShaderMaterial;
  private starMaterial?: THREE.ShaderMaterial;
  private sunLight: THREE.PointLight;
  private clouds?: THREE.Mesh;
  private clock = new THREE.Clock();
  private tier: DeviceTier;

  constructor(canvas: HTMLCanvasElement, tier: DeviceTier) {
    this.tier = tier;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier === 'high',
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x05070f, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, tier === 'high' ? 2 : 1.5));
    this.renderer.setSize(innerWidth, innerHeight);

    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
    this.camera.position.set(0, 0, 10);

    /* Licht: Sonne als Punktlicht ohne Falloff — Intensität regelt die Timeline */
    this.sunLight = new THREE.PointLight(0xfff2dd, 3.2, 0, 0);
    this.sunLight.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z);
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.AmbientLight(0x223355, 0.35));

    this.sunMaterial = this.buildSun();
    this.buildStars();
    this.queue = this.buildPlanets(tier);
  }

  /* ---------------- Aufbau ---------------- */

  private buildSun(): THREE.ShaderMaterial {
    const seg = this.tier === 'high' ? 96 : 48;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SUN_VERTEX,
      fragmentShader: SUN_FRAGMENT,
      uniforms: { uTime: { value: 0 } },
    });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, seg, seg / 2), mat);
    sun.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z);
    this.scene.add(sun);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    glow.scale.setScalar(SUN_RADIUS * 5.2);
    glow.position.copy(sun.position);
    this.scene.add(glow);
    return mat;
  }

  private buildStars() {
    const count = this.tier === 'high' ? 4000 : 1800;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Sterne auf einer großen Kugelschale rund um die Reisestrecke
      const r = 220 + Math.random() * 160;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) - 180; // entlang der Strecke verschoben
      phases[i] = Math.random();
      sizes[i] = 0.8 + Math.random() * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    // Funkeln im Vertex-Shader: jeder Stern pulsiert mit eigener Phase/Frequenz
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(-mv.z, 0.001);
          // Größe clampen: sehr nahe Sterne würden sonst zu Riesen-Punkten
          // explodieren und die GPU mit Overdraw lahmlegen
          gl_PointSize = clamp(aSize * uPixelRatio * (160.0 / dist), 0.0, 7.0 * uPixelRatio);
          float tw = sin(uTime * (0.5 + aPhase * 1.7) + aPhase * 6.2831);
          vAlpha = (0.35 + 0.65 * (0.5 + 0.5 * tw))
            // nahe Sterne sanft ausblenden statt als Scheiben vorbeifliegen
            * smoothstep(20.0, 60.0, dist);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float m = smoothstep(0.5, 0.12, d);
          gl_FragColor = vec4(vec3(0.91, 0.93, 0.97), vAlpha * m);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.scene.add(new THREE.Points(geo, this.starMaterial));
  }

  private buildPlanets(tier: DeviceTier): TextureQueue {
    const seg = tier === 'high' ? 96 : 48;
    // EINE Geometrie für alle Planeten — nur Material/Scale variiert
    const sphere = new THREE.SphereGeometry(1, seg, seg / 2);

    const queue = new TextureQueue(tier, (id, tex) => this.applyTexture(id, tex));

    for (const v of PLANET_VISUALS) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(v.tint),
        roughness: 0.95,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.position.set(v.x, 0, v.z);
      mesh.scale.setScalar(v.scale);
      mesh.visible = false; // Sichtbarkeit verwaltet die Timeline (max. 2 gleichzeitig)
      // Achsneigung für natürlicheren Look
      mesh.rotation.z = THREE.MathUtils.degToRad(v.id === 'uranus' ? 82 : 12);
      this.scene.add(mesh);
      this.planets.set(v.id, mesh);

      if (v.id === 'saturn') this.addSaturnRing(mesh, v.scale, queue);
      if (v.id === 'erde' && tier === 'high') this.addEarthExtras(mesh, queue);
    }

    queue.enqueue(PLANET_VISUALS.map((v) => v.id));
    return queue;
  }

  private addSaturnRing(planet: THREE.Mesh, scale: number, queue: TextureQueue) {
    const geo = new THREE.RingGeometry(1.35, 2.35, 96, 1);
    // UVs radial mappen, damit die Ring-Textur (Streifen) richtig liegt
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      uv.setXY(i, (v3.length() - 1.35) / (2.35 - 1.35), 0.5);
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcbb98e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2.25;
    planet.add(ring); // erbt Position/Scale/Sichtbarkeit des Planeten

    void queue.load('saturn-ring').then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });
  }

  private addEarthExtras(planet: THREE.Mesh, queue: TextureQueue) {
    // Wolkenschicht: zweite, leicht größere Kugel — nur auf starken Geräten
    const mat = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      roughness: 1,
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.02, 64, 32), mat);
    planet.add(clouds);
    this.clouds = clouds;

    void queue.load('erde-wolken').then((tex) => {
      mat.alphaMap = tex;
      mat.color.set(0xffffff);
      mat.opacity = 0.75;
      mat.needsUpdate = true;
    });
    // Nachtseite als dezente Emissive-Map
    void queue.load('erde-nacht').then((tex) => {
      const m = planet.material as THREE.MeshStandardMaterial;
      m.emissiveMap = tex;
      m.emissive = new THREE.Color(0xffdd99);
      m.emissiveIntensity = 0.35;
      m.needsUpdate = true;
    });
  }

  private applyTexture(id: string, tex: THREE.Texture) {
    const mesh = this.planets.get(id);
    if (!mesh) return; // Ring/Wolken werden separat verdrahtet
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.map = tex;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
  }

  /* ---------------- Laufzeit ---------------- */

  /** Sonnenlicht dimmen, je weiter draußen die Kamera ist (0..1 Reisefortschritt) */
  setLightFalloff(progress: number) {
    this.sunLight.intensity = 3.2 - progress * 2.1;
  }

  update() {
    const t = this.clock.getElapsedTime();
    this.sunMaterial.uniforms.uTime.value = t;
    if (this.starMaterial) this.starMaterial.uniforms.uTime.value = t;

    // langsame Eigenrotation aller sichtbaren Planeten
    for (const mesh of this.planets.values()) {
      if (mesh.visible) mesh.rotation.y = t * 0.05;
    }
    if (this.clouds && this.clouds.parent?.visible) {
      this.clouds.rotation.y = t * 0.02; // Wolken driften relativ zur Erde
    }

    this.camera.lookAt(this.lookTarget);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  dispose() {
    this.renderer.dispose();
  }
}
