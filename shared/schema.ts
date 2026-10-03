import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Oak & Line — database schema                                        */
/*  Relationships:                                                      */
/*   projects.categoryId      -> categories.id                          */
/*   project_images.projectId -> projects.id (cascade)                  */
/*   cities.managerId         -> city_managers.id (nullable)            */
/*   enquiries.cityId         -> cities.id (nullable, "Other" = null)   */
/*   enquiries.serviceId      -> services.id (project type)             */
/*   enquiries.routedManagerId-> city_managers.id (snapshot of routing) */
/* ------------------------------------------------------------------ */

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("owner"), // owner | editor
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    location: text("location").notNull(),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    areaSqft: integer("area_sqft"),
    year: integer("year"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("projects_category_idx").on(t.categoryId)],
);

export const projectImages = sqliteTable(
  "project_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** base path without size suffix, e.g. /uploads/ab12cd */
    basePath: text("base_path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    alt: text("alt").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isCover: integer("is_cover", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("project_images_project_idx").on(t.projectId)],
);

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  imagePath: text("image_path").notNull().default(""),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const cityManagers = sqliteTable("city_managers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  title: text("title").notNull().default("City Manager"),
  phone: text("phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""), // digits incl. country code
  email: text("email").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const cities = sqliteTable("cities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  state: text("state").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  managerId: integer("manager_id").references(() => cityManagers.id, { onDelete: "set null" }),
  /** optional override number; falls back to manager → default business number */
  routingWhatsapp: text("routing_whatsapp").notNull().default(""),
  routingEmail: text("routing_email").notNull().default(""),
  routingNotes: text("routing_notes").notNull().default(""),
});

export const enquiries = sqliteTable("enquiries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull().default(""),
  cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
  cityName: text("city_name").notNull(), // resolved name or custom "Other" text
  serviceId: integer("service_id").references(() => services.id, { onDelete: "set null" }),
  projectType: text("project_type").notNull(),
  budget: text("budget").notNull(),
  preferredDate: text("preferred_date").notNull(),
  preferredTime: text("preferred_time").notNull(),
  meetingType: text("meeting_type").notNull(), // online | offline
  meetingAddress: text("meeting_address").notNull().default(""),
  message: text("message").notNull().default(""),
  routedManagerId: integer("routed_manager_id").references(() => cityManagers.id, { onDelete: "set null" }),
  routedTo: text("routed_to").notNull().default(""),
  status: text("status").notNull().default("new"), // new | contacted | scheduled | won | closed
  createdAt: text("created_at").notNull(),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON-encoded
});

/* ------------------------------ Types ------------------------------ */
export type Admin = typeof admins.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectImage = typeof projectImages.$inferSelect;
export type Service = typeof services.$inferSelect;
export type CityManager = typeof cityManagers.$inferSelect;
export type City = typeof cities.$inferSelect;
export type Enquiry = typeof enquiries.$inferSelect;

export type ProjectWithImages = Project & { category: Category | null; images: ProjectImage[] };
export type CityWithManager = City & { manager: CityManager | null };

/* --------------------------- Validation ---------------------------- */
const trimmed = (max: number) => z.string().trim().max(max);
const phoneDigits = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || /^\+?[0-9\s-]{8,20}$/.test(v), "Enter a valid phone number with country code");

export const categoryInput = z.object({
  name: trimmed(60).min(2, "Name is required"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const projectInput = z.object({
  name: trimmed(120).min(2, "Project name is required"),
  location: trimmed(120).min(2, "Location is required"),
  categoryId: z.coerce.number().int().positive("Choose a category"),
  summary: trimmed(200).default(""),
  description: trimmed(4000).default(""),
  areaSqft: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  year: z.coerce.number().int().min(1990).max(2100).nullable().optional(),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type ProjectInput = z.infer<typeof projectInput>;

export const imageUpdateInput = z.object({
  alt: trimmed(200).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isCover: z.boolean().optional(),
});

export const serviceInput = z.object({
  name: trimmed(80).min(2, "Service name is required"),
  tagline: trimmed(160).default(""),
  description: trimmed(1500).default(""),
  imagePath: trimmed(300).default(""),
  visible: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});
export type ServiceInput = z.infer<typeof serviceInput>;

export const managerInput = z.object({
  name: trimmed(80).min(2, "Name is required"),
  title: trimmed(80).default("City Manager"),
  phone: phoneDigits.default(""),
  whatsapp: phoneDigits.default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  active: z.boolean().default(true),
});
export type ManagerInput = z.infer<typeof managerInput>;

export const cityInput = z.object({
  name: trimmed(80).min(2, "City name is required"),
  state: trimmed(80).default(""),
  enabled: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  managerId: z.coerce.number().int().positive().nullable().optional(),
  routingWhatsapp: phoneDigits.default(""),
  routingEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  routingNotes: trimmed(500).default(""),
});
export type CityInput = z.infer<typeof cityInput>;

export const BUDGET_OPTIONS = [
  "Under ₹5 Lakh",
  "₹5 – 10 Lakh",
  "₹10 – 20 Lakh",
  "₹20 – 40 Lakh",
  "₹40 Lakh +",
  "Not sure yet",
] as const;

export const TIME_SLOTS = [
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
] as const;

/** Shared by the public form (client) and the API (server). */
export const enquiryInput = z
  .object({
    name: trimmed(80).min(2, "Please enter your name"),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{10,16}$/, "Enter a valid mobile number"),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
    cityId: z.string().min(1, "Select your city"), // numeric id or "other"
    customCity: trimmed(80).default(""),
    projectType: trimmed(80).min(1, "Select a project type"),
    budget: z.string().min(1, "Select an approximate budget"),
    preferredDate: z
      .string()
      .min(1, "Choose a preferred date")
      .refine((v) => {
        const d = new Date(v + "T00:00:00");
        if (Number.isNaN(d.getTime())) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d >= today;
      }, "Date can't be in the past"),
    preferredTime: z.string().min(1, "Choose a preferred time"),
    meetingType: z.enum(["online", "offline"], { message: "Choose a meeting type" }),
    meetingAddress: trimmed(300).default(""),
    message: trimmed(1500).default(""),
    // honeypot — must stay empty
    website: z.string().max(0).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.meetingType === "offline" && v.meetingAddress.trim().length < 8) {
      ctx.addIssue({ code: "custom", path: ["meetingAddress"], message: "Add the address for the site meeting" });
    }
    if (v.cityId === "other" && v.customCity.trim().length < 2) {
      ctx.addIssue({ code: "custom", path: ["customCity"], message: "Tell us which city" });
    }
  });
export type EnquiryInput = z.infer<typeof enquiryInput>;

export const enquiryStatusInput = z.object({
  status: z.enum(["new", "contacted", "scheduled", "won", "closed"]),
});

export const loginInput = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(200),
});

/* ------------------------- Site content ---------------------------- */
export const ownerSchema = z.object({
  name: trimmed(80).min(1),
  role: trimmed(80).min(1),
  bio: trimmed(600).default(""),
  focus: z.array(trimmed(60)).max(6).default([]),
  imagePath: trimmed(300).default(""),
});
export type Owner = z.infer<typeof ownerSchema>;

export const siteContentSchema = z.object({
  brandName: trimmed(60).min(1),
  heroEyebrow: trimmed(80).default(""),
  heroHeadline: trimmed(140).min(1),
  heroSubheadline: trimmed(300).default(""),
  heroImagePath: trimmed(300).default(""),
  aboutHeading: trimmed(140).default(""),
  aboutBody: trimmed(2000).default(""),
  aboutPillars: z
    .array(z.object({ title: trimmed(60), body: trimmed(300) }))
    .max(6)
    .default([]),
  owners: z.array(ownerSchema).max(6).default([]),
  ctaHeadline: trimmed(140).default(""),
  ctaBody: trimmed(300).default(""),
  defaultWhatsapp: phoneDigits.default(""),
  phone: trimmed(30).default(""),
  email: z.union([z.literal(""), z.string().trim().email()]).default(""),
  studioAddress: trimmed(300).default(""),
  instagram: trimmed(200).default(""),
  stats: z
    .array(z.object({ value: trimmed(20), label: trimmed(60) }))
    .max(4)
    .default([]),
});
export type SiteContent = z.infer<typeof siteContentSchema>;
