import { getSupabase } from "./supabase";
import type {
  Admin,
  Category,
  City,
  CityInput,
  CityManager,
  CityWithManager,
  Enquiry,
  ManagerInput,
  Project,
  ProjectImage,
  ProjectInput,
  ProjectWithImages,
  Service,
  ServiceInput,
  SiteContent,
} from "@shared/schema";

type TableName = "admins" | "categories" | "cities" | "city_managers" | "enquiries" | "project_images" | "projects" | "services" | "site_settings";
type DbRow = Record<string, unknown>;

function camelKey(key: string) {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function fromDb<T>(row: DbRow): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelKey(key), value])) as T;
}

function toDb(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]),
  );
}

async function run<T>(query: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data as T;
}

async function rows<T>(table: TableName, query: (q: any) => any): Promise<T[]> {
  const data = await run<DbRow[]>(query(getSupabase().from(table).select("*")));
  return data.map((row) => fromDb<T>(row));
}

async function byId<T>(table: TableName, id: number): Promise<T | undefined> {
  const data = await run<DbRow | null>(getSupabase().from(table).select("*").eq("id", id).maybeSingle());
  return data ? fromDb<T>(data) : undefined;
}

async function insertOne<T>(table: TableName, value: Record<string, unknown>): Promise<T> {
  const data = await run<DbRow>(getSupabase().from(table).insert(toDb(value)).select("*").single());
  return fromDb<T>(data);
}

async function updateOne<T>(table: TableName, id: number, value: Record<string, unknown>): Promise<T | undefined> {
  const data = await run<DbRow | null>(
    getSupabase().from(table).update(toDb(value)).eq("id", id).select("*").maybeSingle(),
  );
  return data ? fromDb<T>(data) : undefined;
}

async function existsById(table: TableName, id: number) {
  const data = await run<DbRow[]>(
    getSupabase().from(table).delete().eq("id", id).select("id"),
  );
  return data.length > 0;
}

async function countRows(table: TableName, column = "id", value?: unknown) {
  let query = getSupabase().from(table).select("id", { count: "exact", head: true });
  if (column !== "id" || value !== undefined) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return count ?? 0;
}

async function uniqueSlug(table: TableName, base: string, ignoreId?: number) {
  const stem = slugify(base) || "item";
  let slug = stem;
  let n = 1;
  while (true) {
    let query = getSupabase().from(table).select("id").eq("slug", slug);
    if (ignoreId !== undefined) query = query.neq("id", ignoreId);
    const existing = await run<DbRow | null>(query.maybeSingle());
    if (!existing) return slug;
    slug = `${stem}-${++n}`;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 80);
}

export const adminRepo = {
  byEmail: async (email: string): Promise<Admin | undefined> => {
    const row = await run<DbRow | null>(
      getSupabase().from("admins").select("*").eq("email", email.toLowerCase()).maybeSingle(),
    );
    return row ? fromDb<Admin>(row) : undefined;
  },
  byId: (id: number) => byId<Admin>("admins", id),
  count: () => countRows("admins"),
  create: (admin: { email: string; name: string; passwordHash: string; role?: string }) =>
    insertOne<Admin>("admins", { ...admin, email: admin.email.toLowerCase() }),
};

export const categoryRepo = {
  list: async (): Promise<(Category & { projectCount: number })[]> => {
    const [categoryRows, projectRows] = await Promise.all([
      rows<Category>("categories", (q) => q.order("sort_order").order("name")),
      rows<Pick<Project, "categoryId">>("projects", (q) => q.select("category_id")),
    ]);
    const counts = new Map<number | null, number>();
    for (const project of projectRows) counts.set(project.categoryId, (counts.get(project.categoryId) ?? 0) + 1);
    return categoryRows.map((category) => ({ ...category, projectCount: counts.get(category.id) ?? 0 }));
  },
  create: async (name: string, sortOrder = 0) =>
    insertOne<Category>("categories", { name, slug: await uniqueSlug("categories", name), sortOrder }),
  update: async (id: number, name: string, sortOrder = 0) =>
    updateOne<Category>("categories", id, { name, sortOrder, slug: await uniqueSlug("categories", name, id) }),
  remove: (id: number) => existsById("categories", id),
};

async function attach(projectRows: Project[]): Promise<ProjectWithImages[]> {
  if (!projectRows.length) return [];
  const ids = projectRows.map((project) => project.id);
  const [imageRows, categoryRows] = await Promise.all([
    rows<ProjectImage>("project_images", (q) => q.in("project_id", ids).order("is_cover", { ascending: false }).order("sort_order").order("id")),
    rows<Category>("categories", (q) => q),
  ]);
  const categories = new Map(categoryRows.map((category) => [category.id, category]));
  return projectRows.map((project) => ({
    ...project,
    category: project.categoryId ? categories.get(project.categoryId) ?? null : null,
    images: imageRows.filter((image) => image.projectId === project.id),
  }));
}

export const projectRepo = {
  list: async (opts: { publishedOnly: boolean; categorySlug?: string; featured?: boolean }): Promise<ProjectWithImages[]> => {
    let query = getSupabase().from("projects").select("*").order("sort_order").order("id", { ascending: false });
    if (opts.publishedOnly) query = query.eq("published", true);
    if (opts.featured) query = query.eq("featured", true);
    if (opts.categorySlug && opts.categorySlug !== "all") {
      const category = await run<DbRow | null>(
        getSupabase().from("categories").select("id").eq("slug", opts.categorySlug).maybeSingle(),
      );
      if (!category) return [];
      query = query.eq("category_id", category.id);
    }
    const data = await run<DbRow[]>(query);
    return attach(data.map((row) => fromDb<Project>(row)));
  },
  bySlug: async (slug: string, publishedOnly: boolean): Promise<ProjectWithImages | undefined> => {
    const data = await run<DbRow | null>(
      getSupabase().from("projects").select("*").eq("slug", slug).maybeSingle(),
    );
    if (!data) return undefined;
    const project = fromDb<Project>(data);
    if (publishedOnly && !project.published) return undefined;
    return (await attach([project]))[0];
  },
  byId: async (id: number) => {
    const project = await byId<Project>("projects", id);
    return project ? (await attach([project]))[0] : undefined;
  },
  create: async (input: ProjectInput) =>
    insertOne<Project>("projects", {
      ...input,
      areaSqft: input.areaSqft ?? null,
      year: input.year ?? null,
      slug: await uniqueSlug("projects", input.name),
    }),
  update: async (id: number, input: Partial<ProjectInput>) => {
    const patch: Record<string, unknown> = { ...input };
    if (input.name) patch.slug = await uniqueSlug("projects", input.name, id);
    return updateOne<Project>("projects", id, patch);
  },
  remove: async (id: number): Promise<ProjectImage[]> => {
    const images = await rows<ProjectImage>("project_images", (q) => q.eq("project_id", id));
    await run(getSupabase().from("projects").delete().eq("id", id));
    return images;
  },
  stats: async () => {
    const [total, published, images] = await Promise.all([
      countRows("projects"),
      countRows("projects", "published", true),
      countRows("project_images"),
    ]);
    return { total, published, images };
  },
};

export const imageRepo = {
  add: async (projectId: number, image: { basePath: string; width: number; height: number; alt: string }) => {
    const [imageRows, covers] = await Promise.all([
      rows<Pick<ProjectImage, "sortOrder">>("project_images", (q) => q.select("sort_order").eq("project_id", projectId).order("sort_order", { ascending: false }).limit(1)),
      rows<Pick<ProjectImage, "id">>("project_images", (q) => q.select("id").eq("project_id", projectId).eq("is_cover", true).limit(1)),
    ]);
    return insertOne<ProjectImage>("project_images", {
      projectId,
      ...image,
      sortOrder: (imageRows[0]?.sortOrder ?? -1) + 1,
      isCover: covers.length === 0,
    });
  },
  byId: (id: number) => byId<ProjectImage>("project_images", id),
  update: async (id: number, patch: { alt?: string; sortOrder?: number; isCover?: boolean }) => {
    const image = await byId<ProjectImage>("project_images", id);
    if (!image) return undefined;
    if (patch.isCover) {
      await run(getSupabase().from("project_images").update({ is_cover: false }).eq("project_id", image.projectId));
    }
    return updateOne<ProjectImage>("project_images", id, patch);
  },
  reorder: async (projectId: number, orderedIds: number[]) => {
    for (let sortOrder = 0; sortOrder < orderedIds.length; sortOrder++) {
      const imageId = orderedIds[sortOrder];
      await run(
        getSupabase().from("project_images").update({ sort_order: sortOrder }).eq("id", imageId).eq("project_id", projectId),
      );
    }
  },
  remove: async (id: number) => {
    const image = await byId<ProjectImage>("project_images", id);
    if (!image) return undefined;
    await run(getSupabase().from("project_images").delete().eq("id", id));
    if (image.isCover) {
      const next = await run<DbRow | null>(
        getSupabase().from("project_images").select("*").eq("project_id", image.projectId).order("sort_order").limit(1).maybeSingle(),
      );
      if (next) {
        await run(getSupabase().from("project_images").update({ is_cover: true }).eq("id", next.id));
      }
    }
    return image;
  },
};

export const serviceRepo = {
  list: (visibleOnly: boolean) =>
    rows<Service>("services", (q) => {
      const filtered = visibleOnly ? q.eq("visible", true) : q;
      return filtered.order("sort_order").order("id");
    }),
  byId: (id: number) => byId<Service>("services", id),
  create: async (input: ServiceInput) =>
    insertOne<Service>("services", { ...input, slug: await uniqueSlug("services", input.name) }),
  update: async (id: number, input: Partial<ServiceInput>) => {
    const patch: Record<string, unknown> = { ...input };
    if (input.name) patch.slug = await uniqueSlug("services", input.name, id);
    return updateOne<Service>("services", id, patch);
  },
  remove: (id: number) => existsById("services", id),
};

export const managerRepo = {
  list: () => rows<CityManager>("city_managers", (q) => q.order("name")),
  byId: (id: number) => byId<CityManager>("city_managers", id),
  create: (input: ManagerInput) => insertOne<CityManager>("city_managers", input),
  update: (id: number, input: Partial<ManagerInput>) => updateOne<CityManager>("city_managers", id, input),
  remove: (id: number) => existsById("city_managers", id),
};

export const cityRepo = {
  list: async (enabledOnly: boolean): Promise<CityWithManager[]> => {
    const [cityRows, managers] = await Promise.all([
      rows<City>("cities", (q) => {
        const filtered = enabledOnly ? q.eq("enabled", true) : q;
        return filtered.order("sort_order").order("name");
      }),
      managerRepo.list(),
    ]);
    const managerMap = new Map(managers.map((manager) => [manager.id, manager]));
    return cityRows.map((city) => ({
      ...city,
      manager: city.managerId ? managerMap.get(city.managerId) ?? null : null,
    }));
  },
  byId: (id: number) => byId<City>("cities", id),
  create: async (input: CityInput) =>
    insertOne<City>("cities", {
      ...input,
      managerId: input.managerId ?? null,
      slug: await uniqueSlug("cities", input.name),
    }),
  update: async (id: number, input: Partial<CityInput>) => {
    const patch: Record<string, unknown> = { ...input };
    if (input.name) patch.slug = await uniqueSlug("cities", input.name, id);
    if ("managerId" in input) patch.managerId = input.managerId ?? null;
    return updateOne<City>("cities", id, patch);
  },
  remove: (id: number) => existsById("cities", id),
};

export const enquiryRepo = {
  create: (row: Omit<Enquiry, "id">) => insertOne<Enquiry>("enquiries", row),
  list: (status?: string) =>
    rows<Enquiry>("enquiries", (q) => {
      const filtered = status && status !== "all" ? q.eq("status", status) : q;
      return filtered.order("id", { ascending: false });
    }),
  setStatus: (id: number, status: string) => updateOne<Enquiry>("enquiries", id, { status }),
  remove: (id: number) => existsById("enquiries", id),
  countNew: () => countRows("enquiries", "status", "new"),
  count: () => countRows("enquiries"),
};

const CONTENT_KEY = "site_content";
export const settingsRepo = {
  getContent: async (): Promise<SiteContent | undefined> => {
    const row = await run<DbRow | null>(
      getSupabase().from("site_settings").select("value").eq("key", CONTENT_KEY).maybeSingle(),
    );
    return row ? (row.value as SiteContent) : undefined;
  },
  setContent: async (content: SiteContent) => {
    await run(
      getSupabase()
        .from("site_settings")
        .upsert({ key: CONTENT_KEY, value: content }, { onConflict: "key" }),
    );
    return content;
  },
};
