import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import type { Server } from "node:http";
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

  /* ---------- uploaded media (immutable, long cache) ---------- */
  app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
      immutable: true,
      maxAge: "365d",
      fallthrough: false,
      setHeaders: (res) => res.setHeader("Access-Control-Allow-Origin", "*"),
    }),
  );

  /* ======================= PUBLIC API ======================= */
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.get(
    "/api/site",
    h((_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.json({
        content: settingsRepo.getContent() ?? defaultContent,
        services: serviceRepo.list(true),
        categories: categoryRepo.list().map(({ projectCount, ...c }) => c),
        cities: cityRepo.list(true).map(publicCity),
      });
    }),
  );

  app.get(
    "/api/projects",
    h((req, res) => {
      const category = typeof req.query.category === "string" ? req.query.category : undefined;
      const featured = req.query.featured === "1";
      res.setHeader("Cache-Control", "no-cache");
      res.json(projectRepo.list({ publishedOnly: true, categorySlug: category, featured }));
    }),
  );

  app.get(
    "/api/projects/:slug",
    h((req, res) => {
      const p = projectRepo.bySlug(String(req.params.slug), true);
      if (!p) return notFound(res, "Project");
      const others = projectRepo
        .list({ publishedOnly: true })
        .filter((o) => o.id !== p.id)
        .slice(0, 3);
      res.json({ project: p, related: others });
    }),
  );

  app.post(
    "/api/enquiries",
    rateLimit(8, 10 * 60 * 1000),
    h((req, res) => {
      const data = enquiryInput.parse(req.body);
      const content = settingsRepo.getContent() ?? defaultContent;

      let cityId: number | null = null;
      let cityName = data.customCity.trim();
      let routedManagerId: number | null = null;
      let routedNumber = content.defaultWhatsapp;
      let routedTo = "Head office";

      if (data.cityId !== "other") {
        const city = cityRepo.byId(Number(data.cityId));
        if (!city || !city.enabled) return res.status(400).json({ message: "Please choose a city from the list." });
        cityId = city.id;
        cityName = city.name;
        const manager = city.managerId ? managerRepo.byId(city.managerId) : undefined;
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

      const service = serviceRepo.list(true).find((s) => s.name === data.projectType);
      const row = enquiryRepo.create({
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
    h((req, res) => {
      const origin = process.env.PUBLIC_SITE_URL || `${req.protocol}://${req.get("host")}`;
      const urls = ["/", "/work", "/contact", ...projectRepo.list({ publishedOnly: true }).map((p) => `/work/${p.slug}`)];
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
    h((req, res) => {
      const { email, password } = loginInput.parse(req.body);
      const admin = adminRepo.byEmail(email);
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
    h((req, res) => {
      const a = adminRepo.byId(req.admin!.sub);
      if (!a) return res.status(401).json({ message: "Please sign in again." });
      res.json({ id: a.id, name: a.name, email: a.email, role: a.role });
    }),
  );

  admin.get(
    "/stats",
    h((_req, res) => {
      res.json({
        projects: projectRepo.stats(),
        enquiries: { total: enquiryRepo.count(), new: enquiryRepo.countNew() },
        cities: cityRepo.list(false).length,
        services: serviceRepo.list(false).length,
        recent: enquiryRepo.list().slice(0, 5),
      });
    }),
  );

  /* ---------- projects ---------- */
  admin.get("/projects", h((_req, res) => res.json(projectRepo.list({ publishedOnly: false }))));
  admin.get(
    "/projects/:id",
    h((req, res) => {
      const p = projectRepo.byId(idParam(req));
      return p ? res.json(p) : notFound(res, "Project");
    }),
  );
  admin.post(
    "/projects",
    h((req, res) => {
      const data = projectInput.parse(req.body);
      res.status(201).json(projectRepo.create(data));
    }),
  );
  admin.patch(
    "/projects/:id",
    h((req, res) => {
      const id = idParam(req);
      const data = patchOf(projectInput, req.body);
      if (data.published) {
        const p = projectRepo.byId(id);
        if (p && p.images.length === 0) return res.status(400).json({ message: "Add at least one image before publishing." });
      }
      const row = projectRepo.update(id, data);
      return row ? res.json(row) : notFound(res, "Project");
    }),
  );
  admin.delete(
    "/projects/:id",
    h((req, res) => {
      const imgs = projectRepo.remove(idParam(req));
      imgs.forEach((i) => deleteImageFiles(i.basePath));
      res.status(204).end();
    }),
  );

  /* ---------- project images ---------- */
  admin.post(
    "/projects/:id/images",
    upload.array("images", MAX_FILES_PER_REQUEST),
    h(async (req, res) => {
      const id = idParam(req);
      const project = projectRepo.byId(id);
      if (!project) return notFound(res, "Project");
      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) return res.status(400).json({ message: "Choose at least one image." });
      const created = [];
      const failed: { file: string; reason: string }[] = [];
      for (const f of files) {
        try {
          const out = await processImage(f.buffer);
          created.push(imageRepo.add(id, { ...out, alt: `${project.name} — ${project.category?.name ?? "interior"}` }));
        } catch (e) {
          failed.push({ file: f.originalname, reason: (e as Error).message });
        }
      }
      res.status(created.length ? 201 : 400).json({ created, failed, message: failed.length && !created.length ? failed[0].reason : undefined });
    }),
  );
  admin.patch(
    "/images/:id",
    h((req, res) => {
      const row = imageRepo.update(idParam(req), imageUpdateInput.parse(req.body));
      return row ? res.json(row) : notFound(res, "Image");
    }),
  );
  admin.post(
    "/projects/:id/images/reorder",
    h((req, res) => {
      const ids = z.array(z.number().int().positive()).max(200).parse(req.body?.ids);
      imageRepo.reorder(idParam(req), ids);
      res.json({ ok: true });
    }),
  );
  admin.delete(
    "/images/:id",
    h((req, res) => {
      const img = imageRepo.remove(idParam(req));
      if (!img) return notFound(res, "Image");
      deleteImageFiles(img.basePath);
      // keep the site consistent: an image-less project is hidden
      const p = projectRepo.byId(img.projectId);
      if (p && p.images.length === 0 && p.published) projectRepo.update(p.id, { published: false });
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

  /* ---------- categories ---------- */
  admin.get("/categories", h((_req, res) => res.json(categoryRepo.list())));
  admin.post(
    "/categories",
    h((req, res) => {
      const d = categoryInput.parse(req.body);
      res.status(201).json(categoryRepo.create(d.name, d.sortOrder));
    }),
  );
  admin.patch(
    "/categories/:id",
    h((req, res) => {
      const d = categoryInput.parse(req.body);
      const row = categoryRepo.update(idParam(req), d.name, d.sortOrder);
      return row ? res.json(row) : notFound(res, "Category");
    }),
  );
  admin.delete(
    "/categories/:id",
    h((req, res) => {
      const id = idParam(req);
      const cat = categoryRepo.list().find((c) => c.id === id);
      if (cat && cat.projectCount > 0) {
        return res.status(409).json({ message: `Move the ${cat.projectCount} project(s) in "${cat.name}" to another category first.` });
      }
      categoryRepo.remove(id);
      res.status(204).end();
    }),
  );

  /* ---------- services ---------- */
  admin.get("/services", h((_req, res) => res.json(serviceRepo.list(false))));
  admin.post("/services", h((req, res) => res.status(201).json(serviceRepo.create(serviceInput.parse(req.body)))));
  admin.patch(
    "/services/:id",
    h((req, res) => {
      const row = serviceRepo.update(idParam(req), patchOf(serviceInput, req.body));
      return row ? res.json(row) : notFound(res, "Service");
    }),
  );
  admin.delete(
    "/services/:id",
    h((req, res) => {
      serviceRepo.remove(idParam(req));
      res.status(204).end();
    }),
  );

  /* ---------- city managers ---------- */
  admin.get("/managers", h((_req, res) => res.json(managerRepo.list())));
  admin.post("/managers", h((req, res) => res.status(201).json(managerRepo.create(managerInput.parse(req.body)))));
  admin.patch(
    "/managers/:id",
    h((req, res) => {
      const row = managerRepo.update(idParam(req), patchOf(managerInput, req.body));
      return row ? res.json(row) : notFound(res, "Manager");
    }),
  );
  admin.delete(
    "/managers/:id",
    h((req, res) => {
      managerRepo.remove(idParam(req));
      res.status(204).end();
    }),
  );

  /* ---------- cities ---------- */
  admin.get("/cities", h((_req, res) => res.json(cityRepo.list(false))));
  admin.post("/cities", h((req, res) => res.status(201).json(cityRepo.create(cityInput.parse(req.body)))));
  admin.patch(
    "/cities/:id",
    h((req, res) => {
      const row = cityRepo.update(idParam(req), patchOf(cityInput, req.body));
      return row ? res.json(row) : notFound(res, "City");
    }),
  );
  admin.delete(
    "/cities/:id",
    h((req, res) => {
      cityRepo.remove(idParam(req));
      res.status(204).end();
    }),
  );

  /* ---------- enquiries ---------- */
  admin.get(
    "/enquiries",
    h((req, res) => res.json(enquiryRepo.list(typeof req.query.status === "string" ? req.query.status : undefined))),
  );
  admin.patch(
    "/enquiries/:id",
    h((req, res) => {
      const row = enquiryRepo.setStatus(idParam(req), enquiryStatusInput.parse(req.body).status);
      return row ? res.json(row) : notFound(res, "Enquiry");
    }),
  );
  admin.delete(
    "/enquiries/:id",
    h((req, res) => {
      enquiryRepo.remove(idParam(req));
      res.status(204).end();
    }),
  );

  /* ---------- site content ---------- */
  admin.get("/content", h((_req, res) => res.json(settingsRepo.getContent() ?? defaultContent)));
  admin.put("/content", h((req, res) => res.json(settingsRepo.setContent(siteContentSchema.parse(req.body)))));

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
    if (err?.code === "SQLITE_CONSTRAINT_FOREIGNKEY") return res.status(409).json({ message: "This item is still linked to other records." });
    next(err);
  });

  return httpServer;
}
