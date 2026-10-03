import { z } from "zod";

export type Admin = { id: number; email: string; name: string; passwordHash: string; role: string };
export type Category = { id: number; name: string; slug: string; sortOrder: number };
export type Project = {
  id: number;
  name: string;
  slug: string;
  location: string;
  categoryId: number | null;
  summary: string;
  description: string;
  areaSqft: number | null;
  year: number | null;
  featured: boolean;
  published: boolean;
  sortOrder: number;
};
export type ProjectImage = {
  id: number;
  projectId: number;
  basePath: string;
  width: number;
  height: number;
  alt: string;
  sortOrder: number;
  isCover: boolean;
};
export type Service = {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  imagePath: string;
  visible: boolean;
  sortOrder: number;
};
export type CityManager = {
  id: number;
  name: string;
  title: string;
  phone: string;
  whatsapp: string;
  email: string;
  active: boolean;
};
export type City = {
  id: number;
  name: string;
  slug: string;
  state: string;
  enabled: boolean;
  sortOrder: number;
  managerId: number | null;
  routingWhatsapp: string;
  routingEmail: string;
  routingNotes: string;
};
export type Enquiry = {
  id: number;
  name: string;
  phone: string;
  email: string;
  cityId: number | null;
  cityName: string;
  serviceId: number | null;
  projectType: string;
  budget: string;
  preferredDate: string;
  preferredTime: string;
  meetingType: string;
  meetingAddress: string;
  message: string;
  routedManagerId: number | null;
  routedTo: string;
  status: string;
  createdAt: string;
};

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
