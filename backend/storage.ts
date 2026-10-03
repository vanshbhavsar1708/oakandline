import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  admins,
  categories,
  cities,
  cityManagers,
  enquiries,
  projectImages,
  projects,
  services,
  siteSettings,
  type Admin,
  type Category,
  type City,
  type CityInput,
  type CityManager,
  type CityWithManager,
  type Enquiry,
  type ManagerInput,
  type Project,
  type ProjectImage,
  type ProjectInput,
  type ProjectWithImages,
  type Service,
  type ServiceInput,
  type SiteContent,
} from "@shared/schema";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 80);
}

function uniqueSlug(table: typeof projects | typeof services | typeof cities | typeof categories, base: string, ignoreId?: number) {
  let slug = slugify(base) || "item";
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = db.select({ id: table.id }).from(table).where(eq(table.slug, slug)).get();
    if (!existing || existing.id === ignoreId) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

/* -------------------------------- Admins ------------------------------- */
export const adminRepo = {
  byEmail: (email: string): Admin | undefined =>
    db.select().from(admins).where(eq(admins.email, email.toLowerCase())).get(),
  byId: (id: number): Admin | undefined => db.select().from(admins).where(eq(admins.id, id)).get(),
  count: () => db.select({ c: sql<number>`count(*)` }).from(admins).get()?.c ?? 0,
  create: (a: { email: string; name: string; passwordHash: string; role?: string }) =>
    db.insert(admins).values({ ...a, email: a.email.toLowerCase() }).returning().get(),
};

/* ------------------------------ Categories ----------------------------- */
export const categoryRepo = {
  list: (): (Category & { projectCount: number })[] => {
    const rows = db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)).all();
    const counts = db
      .select({ id: projects.categoryId, c: sql<number>`count(*)` })
      .from(projects)
      .groupBy(projects.categoryId)
      .all();
    const map = new Map(counts.map((r) => [r.id, r.c]));
    return rows.map((r) => ({ ...r, projectCount: map.get(r.id) ?? 0 }));
  },
  create: (name: string, sortOrder = 0) =>
    db.insert(categories).values({ name, slug: uniqueSlug(categories, name), sortOrder }).returning().get(),
  update: (id: number, name: string, sortOrder = 0) =>
    db
      .update(categories)
      .set({ name, sortOrder, slug: uniqueSlug(categories, name, id) })
      .where(eq(categories.id, id))
      .returning()
      .get(),
  remove: (id: number) => db.delete(categories).where(eq(categories.id, id)).run().changes > 0,
};

/* ------------------------------- Projects ------------------------------ */
function attach(rows: Project[]): ProjectWithImages[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const imgs = db
    .select()
    .from(projectImages)
    .where(inArray(projectImages.projectId, ids))
    .orderBy(desc(projectImages.isCover), asc(projectImages.sortOrder), asc(projectImages.id))
    .all();
  const cats = db.select().from(categories).all();
  const catMap = new Map(cats.map((c) => [c.id, c]));
  return rows.map((p) => ({
    ...p,
    category: p.categoryId ? catMap.get(p.categoryId) ?? null : null,
    images: imgs.filter((i) => i.projectId === p.id),
  }));
}

export const projectRepo = {
  list: (opts: { publishedOnly: boolean; categorySlug?: string; featured?: boolean }): ProjectWithImages[] => {
    const conds = [];
    if (opts.publishedOnly) conds.push(eq(projects.published, true));
    if (opts.featured) conds.push(eq(projects.featured, true));
    if (opts.categorySlug && opts.categorySlug !== "all") {
      const cat = db.select().from(categories).where(eq(categories.slug, opts.categorySlug)).get();
      if (!cat) return [];
      conds.push(eq(projects.categoryId, cat.id));
    }
    const rows = db
      .select()
      .from(projects)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(projects.sortOrder), desc(projects.id))
      .all();
    return attach(rows);
  },
  bySlug: (slug: string, publishedOnly: boolean): ProjectWithImages | undefined => {
    const row = db.select().from(projects).where(eq(projects.slug, slug)).get();
    if (!row || (publishedOnly && !row.published)) return undefined;
    return attach([row])[0];
  },
  byId: (id: number): ProjectWithImages | undefined => {
    const row = db.select().from(projects).where(eq(projects.id, id)).get();
    return row ? attach([row])[0] : undefined;
  },
  create: (input: ProjectInput) =>
    db
      .insert(projects)
      .values({ ...input, areaSqft: input.areaSqft ?? null, year: input.year ?? null, slug: uniqueSlug(projects, input.name) })
      .returning()
      .get(),
  update: (id: number, input: Partial<ProjectInput>) => {
    const patch: Partial<Project> = { ...input } as Partial<Project>;
    if (input.name) patch.slug = uniqueSlug(projects, input.name, id);
    return db.update(projects).set(patch).where(eq(projects.id, id)).returning().get();
  },
  remove: (id: number): ProjectImage[] => {
    const imgs = db.select().from(projectImages).where(eq(projectImages.projectId, id)).all();
    db.delete(projects).where(eq(projects.id, id)).run();
    return imgs;
  },
  stats: () => {
    const total = db.select({ c: sql<number>`count(*)` }).from(projects).get()?.c ?? 0;
    const published = db.select({ c: sql<number>`count(*)` }).from(projects).where(eq(projects.published, true)).get()?.c ?? 0;
    const images = db.select({ c: sql<number>`count(*)` }).from(projectImages).get()?.c ?? 0;
    return { total, published, images };
  },
};

export const imageRepo = {
  add: (projectId: number, img: { basePath: string; width: number; height: number; alt: string }) => {
    const max = db
      .select({ m: sql<number>`coalesce(max(sort_order), -1)` })
      .from(projectImages)
      .where(eq(projectImages.projectId, projectId))
      .get()?.m ?? -1;
    const hasCover = db
      .select({ id: projectImages.id })
      .from(projectImages)
      .where(and(eq(projectImages.projectId, projectId), eq(projectImages.isCover, true)))
      .get();
    return db
      .insert(projectImages)
      .values({ projectId, ...img, sortOrder: max + 1, isCover: !hasCover })
      .returning()
      .get();
  },
  byId: (id: number) => db.select().from(projectImages).where(eq(projectImages.id, id)).get(),
  update: (id: number, patch: { alt?: string; sortOrder?: number; isCover?: boolean }) => {
    const img = imageRepo.byId(id);
    if (!img) return undefined;
    if (patch.isCover) {
      db.update(projectImages).set({ isCover: false }).where(eq(projectImages.projectId, img.projectId)).run();
    }
    return db.update(projectImages).set(patch).where(eq(projectImages.id, id)).returning().get();
  },
  reorder: (projectId: number, orderedIds: number[]) => {
    orderedIds.forEach((imgId, idx) => {
      db.update(projectImages)
        .set({ sortOrder: idx })
        .where(and(eq(projectImages.id, imgId), eq(projectImages.projectId, projectId)))
        .run();
    });
  },
  remove: (id: number) => {
    const img = imageRepo.byId(id);
    if (!img) return undefined;
    db.delete(projectImages).where(eq(projectImages.id, id)).run();
    if (img.isCover) {
      const next = db
        .select()
        .from(projectImages)
        .where(eq(projectImages.projectId, img.projectId))
        .orderBy(asc(projectImages.sortOrder))
        .get();
      if (next) db.update(projectImages).set({ isCover: true }).where(eq(projectImages.id, next.id)).run();
    }
    return img;
  },
};

/* ------------------------------- Services ------------------------------ */
export const serviceRepo = {
  list: (visibleOnly: boolean): Service[] =>
    db
      .select()
      .from(services)
      .where(visibleOnly ? eq(services.visible, true) : undefined)
      .orderBy(asc(services.sortOrder), asc(services.id))
      .all(),
  byId: (id: number) => db.select().from(services).where(eq(services.id, id)).get(),
  create: (input: ServiceInput) =>
    db.insert(services).values({ ...input, slug: uniqueSlug(services, input.name) }).returning().get(),
  update: (id: number, input: Partial<ServiceInput>) => {
    const patch: Partial<Service> = { ...input };
    if (input.name) patch.slug = uniqueSlug(services, input.name, id);
    return db.update(services).set(patch).where(eq(services.id, id)).returning().get();
  },
  remove: (id: number) => db.delete(services).where(eq(services.id, id)).run().changes > 0,
};

/* ---------------------------- Cities / routing -------------------------- */
export const managerRepo = {
  list: (): CityManager[] => db.select().from(cityManagers).orderBy(asc(cityManagers.name)).all(),
  byId: (id: number) => db.select().from(cityManagers).where(eq(cityManagers.id, id)).get(),
  create: (input: ManagerInput) => db.insert(cityManagers).values(input).returning().get(),
  update: (id: number, input: Partial<ManagerInput>) =>
    db.update(cityManagers).set(input).where(eq(cityManagers.id, id)).returning().get(),
  remove: (id: number) => db.delete(cityManagers).where(eq(cityManagers.id, id)).run().changes > 0,
};

export const cityRepo = {
  list: (enabledOnly: boolean): CityWithManager[] => {
    const rows = db
      .select()
      .from(cities)
      .where(enabledOnly ? eq(cities.enabled, true) : undefined)
      .orderBy(asc(cities.sortOrder), asc(cities.name))
      .all();
    const mgrs = new Map(managerRepo.list().map((m) => [m.id, m]));
    return rows.map((c) => ({ ...c, manager: c.managerId ? mgrs.get(c.managerId) ?? null : null }));
  },
  byId: (id: number): City | undefined => db.select().from(cities).where(eq(cities.id, id)).get(),
  create: (input: CityInput) =>
    db
      .insert(cities)
      .values({ ...input, managerId: input.managerId ?? null, slug: uniqueSlug(cities, input.name) })
      .returning()
      .get(),
  update: (id: number, input: Partial<CityInput>) => {
    const patch: Partial<City> = { ...input } as Partial<City>;
    if (input.name) patch.slug = uniqueSlug(cities, input.name, id);
    if ("managerId" in input) patch.managerId = input.managerId ?? null;
    return db.update(cities).set(patch).where(eq(cities.id, id)).returning().get();
  },
  remove: (id: number) => db.delete(cities).where(eq(cities.id, id)).run().changes > 0,
};

/* ------------------------------- Enquiries ----------------------------- */
export const enquiryRepo = {
  create: (row: Omit<Enquiry, "id">) => db.insert(enquiries).values(row).returning().get(),
  list: (status?: string): Enquiry[] =>
    db
      .select()
      .from(enquiries)
      .where(status && status !== "all" ? eq(enquiries.status, status) : undefined)
      .orderBy(desc(enquiries.id))
      .all(),
  setStatus: (id: number, status: string) =>
    db.update(enquiries).set({ status }).where(eq(enquiries.id, id)).returning().get(),
  remove: (id: number) => db.delete(enquiries).where(eq(enquiries.id, id)).run().changes > 0,
  countNew: () => db.select({ c: sql<number>`count(*)` }).from(enquiries).where(eq(enquiries.status, "new")).get()?.c ?? 0,
  count: () => db.select({ c: sql<number>`count(*)` }).from(enquiries).get()?.c ?? 0,
};

/* ------------------------------ Site settings -------------------------- */
const CONTENT_KEY = "site_content";
export const settingsRepo = {
  getContent: (): SiteContent | undefined => {
    const row = db.select().from(siteSettings).where(eq(siteSettings.key, CONTENT_KEY)).get();
    return row ? (JSON.parse(row.value) as SiteContent) : undefined;
  },
  setContent: (content: SiteContent) => {
    const value = JSON.stringify(content);
    db.insert(siteSettings)
      .values({ key: CONTENT_KEY, value })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value } })
      .run();
    return content;
  },
};
