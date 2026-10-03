# Oak & Line Interiors — Website, Admin & Material Match

A portfolio and enquiry website for Oak & Line Interiors, with an owner-friendly admin portal. It is not an online store: the site exists to build trust, show finished homes and bring in consultation requests.

## What's inside

| Area | Route | What it does |
|---|---|---|
| Home | `/` | Hero, services, studio/about, founders, featured work, final CTA |
| Work | `/work` | Editorial portfolio with category filters (managed in admin) |
| Project | `/work/:slug` | Story, facts (location, category, area, year), full gallery, lightbox |
| Contact | `/contact` | Validated consultation form → stored enquiry → city-routed WhatsApp message |
| Game | `/play` | "Material Match", an on-brand memory game using the studio's material palette |
| Admin | `/admin` | Login, dashboard, enquiries, projects + photos, categories, services, cities & routing, website content |
| SEO | `/sitemap.xml`, `/robots.txt` | Built from published projects |

## Architecture

```
frontend/ React + Vite + Tailwind (public site, admin, game)  → static files (dist/public)
backend/  Express API, auth, image processing (sharp), SQLite (better-sqlite3)
shared/   Zod schemas + WhatsApp message builder shared by both sides
data/     oakline.db + uploads/   (created at runtime — never committed)
```

- **Database tables:** admins, projects, project_images, categories, services, cities, city_managers, enquiries, site_settings.
- **Images:** each upload is validated (type checked by decoding, max 15 MB, max 20 per batch), auto-rotated, stripped of metadata and saved as WebP at 640/1280/2000 px. The site serves `srcset` + lazy loading. The admin uploads in batches, so a project can hold any number of photos.
- **Enquiry routing:** city override WhatsApp → the city's assigned active manager → the head-office number in Website Content. Disabled cities disappear from the form instantly. "Other" lets visitors type a city, which goes to head office.
- **Security:** scrypt-hashed passwords, signed 8-hour session tokens kept in memory (not localStorage), every `/api/admin/*` route protected, rate-limited login and enquiry endpoints, a honeypot field, Zod validation on every write, security headers. No credentials or secrets exist in the frontend bundle.

## Local development

```bash
npm install
cp .env.example .env        # optional in dev
npm run dev                 # http://localhost:5000  (admin: /#/admin)
```

In development, the first admin is `admin@oakandline.in` / `OakLine@2026` unless `ADMIN_EMAIL` / `ADMIN_PASSWORD` are set. **In production there is no default password**: you must set `ADMIN_PASSWORD` (and `AUTH_SECRET`) before first boot.

## Ownership

Everything is set up so the business owns it, not the developer:

1. Create the **GitHub repo, Netlify site and API host under the client's own accounts** (or transfer them).
2. Secrets live only in those dashboards' environment settings. Nothing is hard-coded.
3. All business content (headline, founders, phone, WhatsApp, cities, managers, services, projects) is edited in `/admin`. Code changes aren't needed to add a city or a manager.

### Replacing the founders / brand assets
Admin → Website Content → Founders: change names, roles, bios and focus areas, and upload new portraits. To swap the logo, edit `Logo` in `frontend/src/components/site/primitives.tsx` (SVG) and `frontend/public/favicon.svg`. Static images live in `frontend/public/images/` (regenerate sizes with `node script/static-images.mjs`).

## Deployment
Step-by-step client-owned setup (GitHub → Render API + disk → Netlify website → domain) is in **[DEPLOYMENT.md](DEPLOYMENT.md)**. Included config: `netlify.toml`, `render.yaml`, `Dockerfile`, `.env.example`.

## Pre-launch checklist
- [ ] Set real WhatsApp numbers (Website Content + each manager)
- [ ] Replace demo projects/photos with real work, and unpublish the demos
- [ ] Change the admin password and keep `AUTH_SECRET` private
- [ ] Set `PUBLIC_SITE_URL` and update `robots.txt` sitemap URL
- [ ] Set `API_ORIGIN` on Netlify

## Running on Windows / your own computer
1. Install **Node.js 20 LTS or newer** from nodejs.org.
2. Unzip the project, open the folder in VS Code, and open a terminal there.
3. `npm install` (first time only), then `npm run dev`.
4. Open http://localhost:5000 (site) and http://localhost:5000/#/admin (admin).
Edits to files under `frontend/src` refresh the browser automatically; restart `npm run dev` after editing `backend/` files.
To start with a fresh database, stop the server and delete the `data` folder.
