import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./auth";
import { processImage } from "./images";
import { adminRepo, categoryRepo, cityRepo, imageRepo, managerRepo, projectRepo, serviceRepo, settingsRepo } from "./storage";
import type { SiteContent } from "@shared/schema";

/**
 * Idempotent seed — runs at boot and only fills empty tables.
 * Admin credentials come from ADMIN_EMAIL / ADMIN_PASSWORD (never shipped to the browser).
 */
const SEED_DIR = process.env.SEED_ASSETS_DIR || path.resolve(process.cwd(), "assets-src");

export const defaultContent: SiteContent = {
  brandName: "Oak & Line",
  heroEyebrow: "Residential Interiors · Modular Furniture",
  heroHeadline: "Homes shaped with quiet precision.",
  heroSubheadline:
    "Oak & Line designs and builds bespoke residential interiors — kitchens, wardrobes and complete homes — crafted around the way you live.",
  heroImagePath: "./images/hero",
  aboutHeading: "A studio for people who notice the details.",
  aboutBody:
    "Oak & Line is a residential interior and modular furniture studio. We plan, design and deliver complete homes and individual rooms with one team accountable from first sketch to final handover. Our work is calm, material-led and made to last — warm woods, honest finishes and joinery that fits to the millimetre.",
  aboutPillars: [
    { title: "Design philosophy", body: "Restraint over trend. We design around light, proportion and how a family actually uses each room." },
    { title: "Quality focus", body: "Factory-finished modular units, premium hardware and in-house supervision on every site." },
    { title: "Client-first process", body: "One point of contact, clear drawings and transparent quotations before work begins." },
    { title: "Personal spaces", body: "No catalogue homes. Every layout, finish and handle is chosen for you." },
  ],
  owners: [
    {
      name: "Aarav Mehta",
      role: "Founder & Creative Director",
      bio: "Aarav leads design at Oak & Line. He shapes every layout personally, translating how a family lives into plans that feel effortless.",
      focus: ["Residential design", "Spatial planning", "Client direction"],
      imagePath: "./images/owner-aarav",
    },
    {
      name: "Riya Mehta",
      role: "Co-Founder & Client Relations",
      bio: "Riya guides each client from first conversation to handover, keeping timelines, decisions and site teams in step.",
      focus: ["Client experience", "Project coordination", "Consultation journey"],
      imagePath: "./images/owner-riya",
    },
  ],
  ctaHeadline: "Let's Create a Space That Feels Like Yours.",
  ctaBody: "Share a few details about your home and we'll set up a consultation — online or at your site.",
  defaultWhatsapp: "919800000000",
  phone: "+91 98000 00000",
  email: "studio@oakandline.in",
  studioAddress: "Studio address to be confirmed",
  instagram: "https://instagram.com/oakandline",
  stats: [
    { value: "120+", label: "Homes delivered" },
    { value: "10 yr", label: "Modular warranty" },
    { value: "45 days", label: "Typical modular delivery" },
  ],
};

const SERVICES = [
  { name: "Modular Kitchens", tagline: "Built around how you cook.", description: "Ergonomic layouts, factory-finished cabinetry, quartz and stone counters, and hardware that glides for years.", imagePath: "./images/svc-kitchen" },
  { name: "Wardrobes", tagline: "Storage that disappears into the architecture.", description: "Floor-to-ceiling wardrobes and walk-in dressing rooms with considered internals, lighting and finishes.", imagePath: "./images/svc-wardrobe" },
  { name: "Living Room Furniture", tagline: "Where the home gathers.", description: "Media walls, consoles, bookshelves and bespoke pieces composed around light and conversation.", imagePath: "./images/svc-living" },
  { name: "Bedroom Interiors", tagline: "Quiet rooms for real rest.", description: "Headboard walls, beds, side tables, vanities and soft lighting designed as one calm composition.", imagePath: "./images/svc-bedroom" },
  { name: "Complete Home Interiors", tagline: "One team, from plan to handover.", description: "End-to-end design and execution for apartments, villas and bungalows — civil, electrical, furniture and styling.", imagePath: "./images/svc-fullhome" },
];

const CATEGORIES = ["Kitchen", "Bedroom", "Living Room", "Wardrobe", "Full Home"];

type SeedProject = {
  name: string; location: string; category: string; summary: string; description: string;
  areaSqft?: number; year?: number; featured?: boolean; images: { file: string; alt: string }[];
};

const PROJECTS: SeedProject[] = [
  {
    name: "Monsoon House", location: "Ahmedabad", category: "Full Home",
    summary: "Warm walnut + ivory contemporary residence",
    description: "A four-bedroom family residence planned around a double-height window that frames the monsoon. Walnut joinery runs through every room as a single thread, softened by ivory lime plaster, linen and brushed brass. The kitchen, dining and living spaces open into one another so the family stays together without feeling crowded.",
    areaSqft: 3200, year: 2025, featured: true,
    images: [
      { file: "monsoon-1", alt: "Double-height living room with walnut joinery and ivory sofa" },
      { file: "monsoon-2", alt: "Dining area with round walnut table and brass chandelier" },
      { file: "monsoon-3", alt: "Master bedroom with walnut bed and soft ivory walls" },
    ],
  },
  {
    name: "Ember Kitchen", location: "Surat", category: "Kitchen",
    summary: "Matte black and smoked oak modular kitchen",
    description: "A dramatic, hardworking kitchen for a family that cooks every day. Matte black lower units ground the room while smoked-oak talls hide the appliances. Brass profile handles, deep organised drawers and an ivory backsplash keep the palette disciplined.",
    areaSqft: 240, year: 2025, featured: true,
    images: [
      { file: "ember-1", alt: "Matte black and smoked oak modular kitchen with brass handles" },
      { file: "ember-3", alt: "Kitchen island with brass pendant lights and stools" },
      { file: "ember-2", alt: "Detail of black drawers with brass handles and oak internals" },
    ],
  },
  {
    name: "Linen Suite", location: "Gandhinagar", category: "Bedroom",
    summary: "A soft ivory and taupe master bedroom",
    description: "A master suite designed for rest — fluted wardrobes, an upholstered bench and warm cove lighting create a room that feels quiet even at midday. A walnut vanity corner adds a moment of warmth.",
    areaSqft: 420, year: 2024, featured: true,
    images: [
      { file: "linen-1", alt: "Ivory bedroom with fluted wardrobe and cove lighting" },
      { file: "linen-3", alt: "Fluted ivory wardrobe beside a reading chair" },
      { file: "linen-2", alt: "Walnut vanity with round brass mirror" },
    ],
  },
  {
    name: "Atelier Wardrobe", location: "Vadodara", category: "Wardrobe",
    summary: "Walk-in dressing room in walnut and glass",
    description: "A walk-in dressing room with walnut and fluted-glass wardrobes, a central island of drawers and brass rails. Integrated lighting turns on as each shutter opens.",
    areaSqft: 180, year: 2024,
    images: [
      { file: "atelier-1", alt: "Walk-in wardrobe with walnut and glass shutters and central island" },
      { file: "atelier-2", alt: "Open walnut wardrobe with folded linen and brass rail" },
    ],
  },
  {
    name: "Courtyard Residence", location: "Ahmedabad", category: "Living Room",
    summary: "Living spaces arranged around an inner courtyard",
    description: "A living room opening onto an inner courtyard, with a jharokha-inspired timber screen filtering the afternoon light. Lime plaster walls, terrazzo floors and a walnut foyer cabinet tie old Gujarati references to a modern home.",
    areaSqft: 2600, year: 2023, featured: true,
    images: [
      { file: "courtyard-1", alt: "Living room facing a courtyard with wooden jharokha screen" },
      { file: "courtyard-2", alt: "Foyer with walnut shoe cabinet and brass mirror" },
    ],
  },
];

async function seedImage(projectId: number, file: string, alt: string) {
  const src = ["png", "jpg", "jpeg", "webp"].map((e) => path.join(SEED_DIR, `${file}.${e}`)).find((p) => fs.existsSync(p));
  if (!src) return;
  const out = await processImage(fs.readFileSync(src));
  await imageRepo.add(projectId, { ...out, alt });
}

export async function seed() {
  const [existingContent, adminCount, services, categories, cities] = await Promise.all([
    settingsRepo.getContent(),
    adminRepo.count(),
    serviceRepo.list(false),
    categoryRepo.list(),
    cityRepo.list(false),
  ]);
  const fresh = !existingContent;

  if (adminCount === 0) {
    const email = process.env.ADMIN_EMAIL || "admin@oakandline.in";
    const password = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "OakLine@2026");
    if (!password) throw new Error("ADMIN_PASSWORD must be set for the first production boot");
    await adminRepo.create({ email, name: "Studio Admin", passwordHash: hashPassword(password), role: "owner" });
    console.log(`[seed] created admin ${email}`);
  }

  if (!existingContent) await settingsRepo.setContent(defaultContent);

  if (services.length === 0) {
    await Promise.all(
      SERVICES.map((service, sortOrder) => serviceRepo.create({ ...service, visible: true, sortOrder })),
    );
  }

  if (categories.length === 0) {
    await Promise.all(CATEGORIES.map((category, sortOrder) => categoryRepo.create(category, sortOrder)));
  }

  if (cities.length === 0) {
    const [amd, srt] = await Promise.all([
      managerRepo.create({ name: "Ahmedabad Studio Desk", title: "City Manager", phone: "+91 98000 00001", whatsapp: "919800000001", email: "ahmedabad@oakandline.in", active: true }),
      managerRepo.create({ name: "Surat Manager", title: "City Manager", phone: "+91 98000 00002", whatsapp: "919800000002", email: "surat@oakandline.in", active: true }),
    ]);
    const cityRows: { name: string; managerId: number | null }[] = [
      { name: "Ahmedabad", managerId: amd.id },
      { name: "Gandhinagar", managerId: amd.id },
      { name: "Surat", managerId: srt.id },
      { name: "Vadodara", managerId: null },
    ];
    await Promise.all(
      cityRows.map((city, sortOrder) =>
        cityRepo.create({ name: city.name, state: "Gujarat", enabled: true, sortOrder, managerId: city.managerId, routingWhatsapp: "", routingEmail: "", routingNotes: "" }),
      ),
    );
  }

  if (fresh && process.env.SEED_DEMO_PROJECTS !== "false" && (await projectRepo.list({ publishedOnly: false })).length === 0) {
    const cats = new Map((await categoryRepo.list()).map((category) => [category.name, category.id]));
    for (let i = 0; i < PROJECTS.length; i++) {
      const p = PROJECTS[i];
      const row = await projectRepo.create({
        name: p.name, location: p.location, categoryId: cats.get(p.category)!, summary: p.summary,
        description: p.description, areaSqft: p.areaSqft ?? null, year: p.year ?? null,
        featured: !!p.featured, published: true, sortOrder: i,
      });
      for (const img of p.images) await seedImage(row.id, img.file, img.alt);
    }
    console.log("[seed] projects + images created");
  }
}
