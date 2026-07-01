import * as THREE from 'three';
import {
  PLANET_VISUALS,
  SUN_POS,
  SUN_RADIUS,
  pickTextureSet,
  passWaypoints,
  type DeviceTier,
} from './config';
import { MOON_DEFS, MOON_MIN_RADIUS, parentScale } from './moons';
import { TextureQueue } from './loader';

/** Gesteinskörper bekommen Bump-Relief aus ihrer Albedo-Textur (Krater) */
const BUMPY = new Set(['merkur', 'mars']);
const BUMP_SCALE: Record<string, number> = { merkur: 1.5, mars: 1.0, mond: 2.2 };

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

    // feine Oberflächen-Granulation für mehr Schärfe aus der Nähe
    float g3 = noise(vPos * 7.0 - vec3(0.0, uTime * 0.08, uTime * 0.05));
    col *= 0.92 + 0.16 * g3;

    // Fresnel-Rim: Rand glüht weicher aus
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
    col += vec3(1.0, 0.6, 0.25) * fresnel * 0.9;

    // feines Dithering gegen Banding in den weichen Verläufen
    float dn = hash(vec3(gl_FragCoord.xy, uTime)) - 0.5;
    col += dn * (1.5 / 255.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Radialer Glow als Canvas-Textur (Sprite) — ersetzt Bloom.
 * 1024px + viele Gradient-Stufen + Dither-Rauschen: das alte 256px-Sprite
 * wurde auf ~50 Welteinheiten hochskaliert und zeigte sichtbares Banding.
 */
function makeGlowTexture(): THREE.Texture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // dichte Stops entlang einer weichen Falloff-Kurve gegen Banding
  const stops: [number, number][] = [
    [0.0, 0.85],
    [0.1, 0.62],
    [0.2, 0.44],
    [0.3, 0.3],
    [0.4, 0.2],
    [0.5, 0.13],
    [0.6, 0.08],
    [0.7, 0.045],
    [0.8, 0.02],
    [0.9, 0.007],
    [1.0, 0.0],
  ];
  for (const [pos, a] of stops) {
    const warm = Math.min(1, pos * 1.6); // innen gelblich, außen orange
    grad.addColorStop(pos, `rgba(255, ${Math.round(200 - warm * 90)}, ${Math.round(120 - warm * 85)}, ${a})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // ±1,5/255 Rauschen auf den Alphakanal — bricht die letzten Banding-Ringe auf
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i]! > 0 && d[i]! < 250) d[i] = Math.max(0, Math.min(255, d[i]! + (Math.random() * 3 - 1.5)));
  }
  ctx.putImageData(img, 0, 0);

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

  /** Umlauf-Pivots je Mond (für Animation + Sichtbarkeit) */
  private moonOrbits: {
    pivot: THREE.Object3D;
    mesh: THREE.Mesh;
    parent: string;
    speed: number;
    spin: number;
    phase: number;
  }[] = [];

  constructor(canvas: HTMLCanvasElement, tier: DeviceTier) {
    this.tier = tier;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true, // MSAA ist auf modernen GPUs günstig — Kanten immer glatt
      powerPreference: 'high-performance',
      // nur im Dev: erlaubt Frame-Auslesen (toDataURL) für die Verifikation
      preserveDrawingBuffer: import.meta.env.DEV,
    });
    this.renderer.setClearColor(0x05070f, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, tier === 'high' ? 2 : 1.75));
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
    this.buildMoons(tier);
  }

  /* ---------------- Aufbau ---------------- */

  private buildSun(): THREE.ShaderMaterial {
    const seg = this.tier === 'high' ? 128 : 64;
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
    const seg = tier === 'high' ? 128 : 64;
    // EINE Geometrie für alle Planeten — nur Material/Scale variiert
    const sphere = new THREE.SphereGeometry(1, seg, seg / 2);

    const queue = new TextureQueue(
      pickTextureSet(tier),
      this.renderer.capabilities.getMaxAnisotropy(),
      (id, tex) => this.applyTexture(id, tex)
    );

    for (const v of PLANET_VISUALS) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(v.tint),
        roughness: 0.95,
        metalness: 0,
        dithering: true, // bricht Banding in den Licht-Verläufen auf der Kugel
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
    const geo = new THREE.RingGeometry(1.35, 2.35, 128, 1);
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
      dithering: true,
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
      dithering: true,
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.02, 96, 48), mat);
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
    if (!mesh) return; // Ring/Wolken/Monde werden separat verdrahtet
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.map = tex;
    mat.color.set(0xffffff);
    // Gesteinsplaneten: Albedo als Bump -> Krater fangen am Terminator Licht
    if (BUMPY.has(id)) {
      mat.bumpMap = tex;
      mat.bumpScale = BUMP_SCALE[id] ?? 1;
    }
    mat.needsUpdate = true;
  }

  /** Monde: umlaufende Trabanten je Planet (Sichtbarkeit folgt dem Planeten) */
  private buildMoons(tier: DeviceTier) {
    const seg = tier === 'high' ? 48 : 24;
    const geo = new THREE.SphereGeometry(1, seg, seg / 2);

    for (const def of MOON_DEFS) {
      const planet = this.planets.get(def.parent);
      if (!planet) continue;
      const pScale = parentScale(def.parent);
      const radius = Math.max(MOON_MIN_RADIUS, def.radiusFrac * pScale);
      const orbitDist = def.orbit * pScale;

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(def.tint),
        roughness: 0.92,
        metalness: 0,
        dithering: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(radius);
      mesh.position.set(orbitDist, 0, 0);
      mesh.rotation.z = THREE.MathUtils.degToRad(8);

      // Pivot am Planetenzentrum, um die Neigungsachse gekippt
      const pivot = new THREE.Object3D();
      pivot.position.copy(planet.position);
      pivot.rotation.x = THREE.MathUtils.degToRad(def.incl);
      pivot.rotation.y = def.phase * Math.PI * 2;
      pivot.visible = false;
      pivot.add(mesh);
      this.scene.add(pivot);

      this.moonOrbits.push({
        pivot,
        mesh,
        parent: def.parent,
        speed: def.speed,
        spin: 0.25 + Math.abs(def.speed) * 0.1,
        phase: def.phase * Math.PI * 2,
      });

      // nur der Erdmond hat eine echte Textur (+ Krater-Bump).
      // Verzögert laden, damit die 2 MB nicht mit dem ersten Bildaufbau
      // konkurrieren — bis dahin trägt die Tint-Farbe (Mond ist erst Stop 3).
      if (def.texture) {
        const tex = def.texture;
        setTimeout(() => {
          void this.queue.load(tex).then((t) => {
            mat.map = t;
            mat.color.set(0xffffff);
            mat.bumpMap = t;
            mat.bumpScale = BUMP_SCALE[tex] ?? 1.5;
            mat.needsUpdate = true;
          });
        }, 1200);
      }
    }
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

    // Monde umkreisen ihren Planeten (nur wenn dieser sichtbar ist)
    for (const o of this.moonOrbits) {
      const vis = this.planets.get(o.parent)?.visible ?? false;
      o.pivot.visible = vis;
      if (!vis) continue;
      o.pivot.rotation.y = o.phase + t * o.speed * 0.28;
      o.mesh.rotation.y = t * o.spin;
    }

    this.camera.lookAt(this.lookTarget);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  /** Nur Dev/Verifikation: Kamera direkt in die Vorbeiflug-Pose eines Planeten. */
  debugPose(id: string) {
    const v = PLANET_VISUALS.find((p) => p.id === id);
    if (!v) return;
    const mesh = this.planets.get(id);
    if (mesh) mesh.visible = true; // Cull-Ticker ist bei verstecktem Tab throttled
    this.camera.position.set(v.x * 0.3 + (v.x > 0 ? -2 : 2), -v.scale * 0.35, v.z + v.viewDist * 0.82);
    this.lookTarget.set(v.x, 0, v.z);
    this.setLightFalloff(v.index / 8);
    this.update();
    this.update(); // zweiter Pass: Monde-Sichtbarkeit folgt planet.visible
  }

  /** Nur Dev/Verifikation: Durchflug-Pose bei s∈[0,1] (Entry→Exit) setzen. */
  debugPass(id: string, s: number) {
    const v = PLANET_VISUALS.find((p) => p.id === id);
    if (!v) return;
    const mesh = this.planets.get(id);
    if (mesh) mesh.visible = true;
    const wp = passWaypoints(v, innerWidth < 700);
    const lerp = (a: { x: number; y: number; z: number }, b: typeof a, u: number) =>
      new THREE.Vector3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
    // Apex berücksichtigen: erste Hälfte entry->mid, zweite mid->exit
    if (wp.mid && wp.midLook) {
      if (s < 0.5) {
        this.camera.position.copy(lerp(wp.entry, wp.mid, s * 2));
        this.lookTarget.copy(lerp(wp.entryLook, wp.midLook, s * 2));
      } else {
        this.camera.position.copy(lerp(wp.mid, wp.exit, (s - 0.5) * 2));
        this.lookTarget.copy(lerp(wp.midLook, wp.exitLook, (s - 0.5) * 2));
      }
    } else {
      this.camera.position.copy(lerp(wp.entry, wp.exit, s));
      this.lookTarget.copy(lerp(wp.entryLook, wp.exitLook, s));
    }
    this.setLightFalloff(v.index / 8);
    this.update();
    this.update();
  }

  dispose() {
    this.renderer.dispose();
  }
}
