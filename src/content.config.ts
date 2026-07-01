import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * Portfolio: ein Astrofoto = eine Markdown-Datei in src/content/portfolio/.
 * Neues Bild hinzufügen: .md-Datei anlegen, Foto nach src/assets/photos/ legen.
 */
const portfolio = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/portfolio' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      image: image(),
      /** Reihenfolge in der Galerie (klein = zuerst) */
      order: z.number().default(99),
      /** Katalog-/Objektdaten fürs Daten-HUD */
      object: z.string().optional(), // z.B. "M 42"
      constellation: z.string().optional(), // Sternbild
      distance: z.string().optional(), // z.B. "1.344 Lj"
      objectType: z.string().optional(), // z.B. "Emissionsnebel"
      captureDate: z.string().optional(),
      /** Oberkategorie für Gruppierung/Filter im Portfolio */
      category: z
        .enum(['Galaxien', 'Nebel', 'Mond & Planeten', 'Sterne', 'Sonstiges'])
        .default('Sonstiges'),
      /** Aufnahme-Daten (optional, vom Betreiber zu pflegen) */
      integration: z.string().optional(), // Gesamtbelichtung, z.B. "4 h 20 min"
      frames: z.string().optional(), // Einzelbilder, z.B. "260 × 60 s"
      gear: z.string().optional(), // Setup, z.B. "Newton 200/1000 · EQ6 · D7500"
      featured: z.boolean().default(false),
    }),
});

/**
 * Planeten-Daten für die Sonnensystem-Journey.
 */
const planets = defineCollection({
  loader: file('./src/content/planets/planets.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    /** kurzer poetisch-technischer Untertitel */
    tagline: z.string(),
    diameterKm: z.number(),
    distanceSunMkm: z.number(), // Mio. km
    dayLength: z.string(),
    yearLength: z.string(),
    tempC: z.string(),
    moons: z.number(),
    funFact: z.string(),
    /** Radius relativ zur Erde für die 3D-Szene */
    radiusEarths: z.number(),
    /** Basis-Farbe für Fallback/Glow */
    tint: z.string(),
  }),
});

export const collections = { portfolio, planets };
