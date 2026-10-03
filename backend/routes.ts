import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import type { Server } from "node:http";
import crypto from "node:crypto";
import multer from "multer";
import { z } from "zod";
import {
  categoryInput,
  cityInput,
  enquiryInput,
  enquiryStatusInput,
  imageUpdateInput,
  loginInput,
  managerInput,
  projectInput,
  serviceInput,
  siteContentSchema,
} from "@shared/schema";
import { buildEnquiryMessage, normaliseWhatsapp, waLink } from "@shared/whatsapp";
import { rateLimit, requireAdmin, signToken, verifyPassword } from "./auth";
import {
  ImageValidationError,
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  UPLOAD_DIR,
  deleteImageFiles,
  processImage,
} from "./images";
import {
  adminRepo,
  categoryRepo,
  cityRepo,
  enquiryRepo,
  imageRepo,
  managerRepo,
  projectRepo,
  serviceRepo,
  settingsRepo,
} from "./storage";
import { defaultContent, seed } from "./seed";
import { getSupabase } from "./supabase";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FILES_PER_REQUEST },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|avif|heic|heif|tiff)$/.test(file.mimetype)) cb(null, true);
    else cb(new ImageValidationError(`"${file.originalname}" is not a supported image type.`));
  },
});

/** Wrap handlers so thrown errors reach the error middleware (incl. Zod). */
const h =
  (fn: (req: Request, res: Response) => unknown | Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err) {
      next(err);
    }
  };

const idParam = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error("Invalid id"), { status: 400 });
  return id;
};

const notFound = (res: Response, what = "Item") => res.status(404).json({ message: `${what} not found` });

const publicCity = (c: { id: number; name: string; slug: string; state: string }) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  state: c.state,
});

/** Parse a PATCH body: validate only the keys that were sent, so schema defaults never overwrite stored values. */
function patchOf<T extends z.ZodTypeAny>(schema: T, body: unknown): Partial<z.infer<T>> {
  const parsed = (schema as any).partial().parse(body ?? {}) as Record<string, unknown>;
  const sent = body && typeof body === "object" ? Object.keys(body as object) : [];
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => sent.includes(k))) as Partial<z.infer<T>>;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seed();

  /* ---------- optional CORS (only when the frontend calls the API cross-origin via VITE_API_URL) ---------- */
  const allowed = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length) {
    app.use("/api", (req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowed.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      }
      if (req.method === "OPTIONS") return res.sendStatus(204);
      next();
    });
  }

  /* ---------- security headers ---------- */
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  if (!process.env.SUPABASE_URL) {
    app.use(
      "/uploads",
      express.static(UPLOAD_DIR, {
        immutable: true,
        maxAge: "365d",
        fallthrough: false,
        setHeaders: (res) => res.setHeader("Access-Control-Allow-Origin", "*"),
      }),
    );
  }

  /* ======================= PUBLIC API ======================= */
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.get(
    "/api/site",
    h(async (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.json({
        content: (await settingsRepo.getContent()) ?? defaultContent,
        services: await serviceRepo.list(true),
        categories: (await categoryRepo.list()).map(({ projectCount, ...c }) => c),
        cities: (await cityRepo.list(true)).map(publicCity),
      });
    }),
  );

  app.get(
    "/api/projects",
    h(async (req, res) => {
      const category = typeof req.query.category === "string" ? req.query.category : undefined;
      const featured = req.query.featured === "1";
      res.setHeader("Cache-Control", "no-cache");
      res.json(await projectRepo.list({ publishedOnly: true, categorySlug: category, featured }));
    }),
  );

  app.get(
    "/api/projects/:slug",
    h(async (req, res) => {
      const p = await projectRepo.bySlug(String(req.params.slug), true);
      if (!p) return notFound(res, "Project");
      const others = (await projectRepo
        .list({ publishedOnly: true }))
        .filter((o) => o.id !== p.id)
        .slice(0, 3);
      res.json({ project: p, related: others });
    }),
  );

  app.post(
    "/api/enquiries",
    rateLimit(8, 10 * 60 * 1000),
    h(async (req, res) => {
      const data = enquiryInput.parse(req.body);
      const content = (await settingsRepo.getContent()) ?? defaultContent;

      let cityId: number | null = null;
      let cityName = data.customCity.trim();
      let routedManagerId: number | null = null;
      let routedNumber = content.defaultWhatsapp;
      let routedTo = "Head office";

      if (data.cityId !== "other") {
        const city = await cityRepo.byId(Number(data.cityId));
        if (!city || !city.enabled) return res.status(400).json({ message: "Please choose a city from the list." });
        cityId = city.id;
        cityName = city.name;
        const manager = city.managerId ? await managerRepo.byId(city.managerId) : undefined;
        if (normaliseWhatsapp(city.routingWhatsapp)) {
          routedNumber = city.routingWhatsapp;
          routedTo = `${city.name} routing line`;
          routedManagerId = manager?.id ?? null;
        } else if (manager && manager.active && normaliseWhatsapp(manager.whatsapp)) {
          routedNumber = manager.whatsapp;
          routedTo = manager.name;
          routedManagerId = manager.id;
        }
      }

      const service = (await serviceRepo.list(true)).find((s) => s.name === data.projectType);
      const row = await enquiryRepo.create({
        name: data.name,
        phone: data.phone,
        email: data.email,
        cityId,
        cityName,
        serviceId: service?.id ?? null,
        projectType: data.projectType,
        budget: data.budget,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        meetingType: data.meetingType,
        meetingAddress: data.meetingType === "offline" ? data.meetingAddress : "",
        message: data.message,
        routedManagerId,
        routedTo,
        status: "new",
        createdAt: new Date().toISOString(),
      });

      const message = buildEnquiryMessage(
        {
          name: row.name,
          city: row.cityName,
          projectType: row.projectType,
          budget: row.budget,
          preferredDate: row.preferredDate,
          preferredTime: row.preferredTime,
          meetingType: row.meetingType,
          meetingAddress: row.meetingAddress,
          message: row.message,
          reference: row.id,
        },
        content.brandName,
      );
      res.status(201).json({ id: row.id, reference: `OL-${row.id}`, routedTo, whatsappUrl: waLink(routedNumber, message), message });
    }),
  );

  /* ---------- SEO ---------- */
  app.get(
    "/sitemap.xml",
    h(async (req, res) => {
      const origin = process.env.PUBLIC_SITE_URL || `${req.protocol}://${req.get("host")}`;
      const urls = ["/", "/work", "/contact", ...(await projectRepo.list({ publishedOnly: true })).map((p) => `/work/${p.slug}`)];
      res.type("application/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${origin}${u}</loc></url>`)
          .join("\n")}\n</urlset>`,
      );
    }),
  );

  /* ======================= AUTH ======================= */
  app.post(
    "/api/auth/login",
    rateLimit(10, 15 * 60 * 1000),
    h(async (req, res) => {
      const { email, password } = loginInput.parse(req.body);
      const admin = await adminRepo.byEmail(email);
      if (!admin || !verifyPassword(password, admin.passwordHash)) {
        return res.status(401).json({ message: "Email or password is incorrect." });
      }
      res.json({ token: signToken(admin.id, admin.role), admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
    }),
  );

  const admin = express.Router();
  admin.use(requireAdmin());

  admin.get(
    "/me",
    h(async (req, res) => {
      const a = await adminRepo.byId(req.admin!.sub);
      if (!a) return res.status(401).json({ message: "Please sign in again." });
      res.json({ id: a.id, name: a.name, email: a.email, role: a.role });
    }),
  );

  admin.get(
    "/stats",
    h(async (_req, res) => {
      const [projects, totalEnquiries, newEnquiries, cities, services, recent] = await Promise.all([
        projectRepo.stats(),
        enquiryRepo.count(),
        enquiryRepo.countNew(),
        cityRepo.list(false),
        serviceRepo.list(false),
        enquiryRepo.list(),
      ]);
      res.json({
        projects,
        enquiries: { total: totalEnquiries, new: newEnquiries },
        cities: cities.length,
        services: services.length,
        recent: recent.slice(0, 5),
      });
    }),
  );

  /* ---------- projects ---------- */
  admin.get("/projects", h(async (_req, res) => res.json(await projectRepo.list({ publishedOnly: false }))));
  admin.get(
    "/projects/:id",
    h(async (req, res) => {
      const p = await projectRepo.byId(idParam(req));
      return p ? res.json(p) : notFound(res, "Project");
    }),
  );
  admin.post(
    "/projects",
    h(async (req, res) => {
      const data = projectInput.parse(req.body);
      res.status(201).json(await projectRepo.create(data));
    }),
  );
  admin.patch(
    "/projects/:id",
    h(async (req, res) => {
      const id = idParam(req);
      const data = patchOf(projectInput, req.body);
      if (data.published) {
        const p = await projectRepo.byId(id);
        if (p && p.images.length === 0) return res.status(400).json({ message: "Add at least one image before publishing." });
      }
      const row = await projectRepo.update(id, data);
      return row ? res.json(row) : notFound(res, "Project");
    }),
  );
  admin.delete(
    "/projects/:id",
    h(async (req, res) => {
      const imgs = await projectRepo.remove(idParam(req));
      await Promise.all(imgs.map((image) => deleteImageFiles(image.basePath)));
      res.status(204).end();
    }),
  );

  /* ---------- project images ---------- */
  admin.post(
    "/projects/:id/images",
    upload.array("images", MAX_FILES_PER_REQUEST),
    h(async (req, res) => {
      const id = idParam(req);
      const project = await projectRepo.byId(id);
      if (!project) return notFound(res, "Project");
      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) return res.status(400).json({ message: "Choose at least one image." });
      const created = [];
      const failed: { file: string; reason: string }[] = [];
      for (const f of files) {
        try {
          const out = await processImage(f.buffer);
          created.push(await imageRepo.add(id, { ...out, alt: `${project.name} — ${project.category?.name ?? "interior"}` }));
        } catch (e) {
          failed.push({ file: f.originalname, reason: (e as Error).message });
        }
      }
      res.status(created.length ? 201 : 400).json({ created, failed, message: failed.length && !created.length ? failed[0].reason : undefined });
    }),
  );
  admin.patch(
    "/images/:id",
    h(async (req, res) => {
      const row = await imageRepo.update(idParam(req), imageUpdateInput.parse(req.body));
      return row ? res.json(row) : notFound(res, "Image");
    }),
  );
  admin.post(
    "/projects/:id/images/reorder",
    h(async (req, res) => {
      const ids = z.array(z.number().int().positive()).max(200).parse(req.body?.ids);
      await imageRepo.reorder(idParam(req), ids);
      res.json({ ok: true });
    }),
  );
  admin.delete(
    "/images/:id",
    h(async (req, res) => {
      const img = await imageRepo.remove(idParam(req));
      if (!img) return notFound(res, "Image");
      await deleteImageFiles(img.basePath);
      // keep the site consistent: an image-less project is hidden
      const p = await projectRepo.byId(img.projectId);
      if (p && p.images.length === 0 && p.published) await projectRepo.update(p.id, { published: false });
      res.status(204).end();
    }),
  );

  /* ---------- generic single upload (services, hero, owners) ---------- */
  admin.post(
    "/uploads",
    upload.single("image"),
    h(async (req, res) => {
      if (!req.file) return res.status(400).json({ message: "Choose an image." });
      const out = await processImage(req.file.buffer);
      res.status(201).json(out);
    }),
  );
  admin.post(
    "/uploads/sign",
    h(async (req, res) => {
      const contentType = z
        .enum(["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif", "image/tiff"])
        .parse(req.body?.contentType);
      const path = `incoming/${crypto.randomUUID()}`;
      const { data, error } = await getSupabase().storage.from("oakline-uploads").createSignedUploadUrl(path);
      if (error) throw new Error(`Could not prepare image upload: ${error.message}`);
      res.status(201).json({ path: data.path, token: data.token, contentType });
    }),
  );
  admin.post(
    "/uploads/finalize",
    h(async (req, res) => {
      const { path: incomingPath, projectId } = z
        .object({
          path: z.string().regex(/^incoming\/[0-9a-f-]{36}$/i),
          projectId: z.number().int().positive().optional(),
        })
        .parse(req.body);
      const supabase = getSupabase();
      const bucket = supabase.storage.from("oakline-uploads");
      const { data, error } = await bucket.download(incomingPath);
      if (error) throw new Error(`Could not read uploaded image: ${error.message}`);
      if (!data) throw new Error("The uploaded image could not be found.");

      let image: Awaited<ReturnType<typeof processImage>>;
      try {
        image = await processImage(Buffer.from(await data.arrayBuffer()));
      } finally {
        const { error: cleanupError } = await bucket.remove([incomingPath]);
        if (cleanupError) console.error("Could not remove temporary upload:", cleanupError.message);
      }

      if (projectId === undefined) {
        res.status(201).json(image);
        return;
      }

      const project = await projectRepo.byId(projectId);
      if (!project) {
        await deleteImageFiles(image.basePath);
        return notFound(res, "Project");
      }
      const created = await imageRepo.add(projectId, {
        ...image,
        alt: `${project.name} — ${project.category?.name ?? "interior"}`,
      });
      res.status(201).json(created);
    }),
  );

  /* ---------- categories ---------- */
  admin.get("/categories", h(async (_req, res) => res.json(await categoryRepo.list())));
  admin.post(
    "/categories",
    h(async (req, res) => {
      const d = categoryInput.parse(req.body);
      res.status(201).json(await categoryRepo.create(d.name, d.sortOrder));
    }),
  );
  admin.patch(
    "/categories/:id",
    h(async (req, res) => {
      const d = categoryInput.parse(req.body);
      const row = await categoryRepo.update(idParam(req), d.name, d.sortOrder);
      return row ? res.json(row) : notFound(res, "Category");
    }),
  );
  admin.delete(
    "/categories/:id",
    h(async (req, res) => {
      const id = idParam(req);
      const cat = (await categoryRepo.list()).find((c) => c.id === id);
      if (cat && cat.projectCount > 0) {
        return res.status(409).json({ message: `Move the ${cat.projectCount} project(s) in "${cat.name}" to another category first.` });
      }
      await categoryRepo.remove(id);
      res.status(204).end();
    }),
  );

  /* ---------- services ---------- */
  admin.get("/services", h(async (_req, res) => res.json(await serviceRepo.list(false))));
  admin.post("/services", h(async (req, res) => res.status(201).json(await serviceRepo.create(serviceInput.parse(req.body)))));
  admin.patch(
    "/services/:id",
    h(async (req, res) => {
      const row = await serviceRepo.update(idParam(req), patchOf(serviceInput, req.body));
      return row ? res.json(row) : notFound(res, "Service");
    }),
  );
  admin.delete(
    "/services/:id",
    h(async (req, res) => {
      await serviceRepo.remove(idParam(req));
      res.status(204).end();
    }),
  );

  /* ---------- city managers ---------- */
  admin.get("/managers", h(async (_req, res) => res.json(await managerRepo.list())));
  admin.post("/managers", h(async (req, res) => res.status(201).json(await managerRepo.create(managerInput.parse(req.body)))));
  admin.patch(
    "/managers/:id",
    h(async (req, res) => {
      const row = await managerRepo.update(idParam(req), patchOf(managerInput, req.body));
      return row ? res.json(row) : notFound(res, "Manager");
    }),
  );
  admin.delete(
    "/managers/:id",
    h(async (req, res) => {
      await managerRepo.remove(idParam(req));
      res.status(204).end();
    }),
  );

  /* ---------- cities ---------- */
  admin.get("/cities", h(async (_req, res) => res.json(await cityRepo.list(false))));
  admin.post("/cities", h(async (req, res) => res.status(201).json(await cityRepo.create(cityInput.parse(req.body)))));
  admin.patch(
    "/cities/:id",
    h(async (req, res) => {
      const row = await cityRepo.update(idParam(req), patchOf(cityInput, req.body));
      return row ? res.json(row) : notFound(res, "City");
    }),
  );
  admin.delete(
    "/cities/:id",
    h(async (req, res) => {
      await cityRepo.remove(idParam(req));
      res.status(204).end();
    }),
  );

  /* ---------- enquiries ---------- */
  admin.get(
    "/enquiries",
    h(async (req, res) => res.json(await enquiryRepo.list(typeof req.query.status === "string" ? req.query.status : undefined))),
  );
  admin.patch(
    "/enquiries/:id",
    h(async (req, res) => {
      const row = await enquiryRepo.setStatus(idParam(req), enquiryStatusInput.parse(req.body).status);
      return row ? res.json(row) : notFound(res, "Enquiry");
    }),
  );
  admin.delete(
    "/enquiries/:id",
    h(async (req, res) => {
      await enquiryRepo.remove(idParam(req));
      res.status(204).end();
    }),
  );

  /* ---------- site content ---------- */
  admin.get("/content", h(async (_req, res) => res.json((await settingsRepo.getContent()) ?? defaultContent)));
  admin.put("/content", h(async (req, res) => res.json(await settingsRepo.setContent(siteContentSchema.parse(req.body)))));

  app.use("/api/admin", admin);

  /* ---------- API 404 + error normalisation ---------- */
  app.use("/api", (_req, res) => res.status(404).json({ message: "Not found" }));
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) fieldErrors[issue.path.join(".") || "_"] ??= issue.message;
      return res.status(400).json({ message: Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors });
    }
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `Each image must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`
          : err.code === "LIMIT_FILE_COUNT"
            ? `Upload up to ${MAX_FILES_PER_REQUEST} images at a time.`
            : err.message;
      return res.status(400).json({ message: msg });
    }
    if (err instanceof ImageValidationError) return res.status(400).json({ message: err.message });
    if (err?.code === "23503") return res.status(409).json({ message: "This item is still linked to other records." });
    next(err);
  });

  return httpServer;
}
