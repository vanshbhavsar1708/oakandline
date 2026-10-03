# Deploy Oak & Line with Supabase and Netlify

Netlify hosts both the website and its serverless Express API. Supabase provides Postgres for business data and Storage for uploaded project photos. There is no separate Render server.

```text
Visitors → Netlify site + Functions → Supabase Postgres
                               └────→ Supabase Storage
```

## 1. Set up the empty Supabase project

1. Open your Supabase project dashboard and select **SQL Editor → New query**.
2. Open `supabase/setup.sql` from this folder, copy all of it into the SQL Editor, and click **Run**. It creates the app tables and a public-read `oakline-uploads` bucket. Row-level security is enabled on the app tables; only the server-side service-role key can read or change them.
3. In **Project Settings → API**, copy:
   - The **Project URL**.
   - The **anon / publishable key**. This key is public and is used for signed browser uploads.
   - The **service_role / secret key**. Keep this private. It is used only by the Netlify Function and must never be added as a `VITE_` variable.

Do not paste your private service-role key into chat, GitHub, or a frontend setting.

## 2. Push the project to GitHub

Use the prepared repository [vanshbhavsar1708/oakandline](https://github.com/vanshbhavsar1708/oakandline) or upload the complete project folder to a new repository. The root `package.json`, `package-lock.json`, `netlify.toml`, `frontend/`, `backend/`, `netlify/`, `shared/`, `script/`, and `supabase/` must stay together. Netlify builds from the repository root.

Do not upload `.env`, `node_modules/`, or local build output.

## 3. Connect the repository to Netlify

1. In Netlify, choose **Add new site → Import an existing project**, connect GitHub, and select `oakandline`.
2. Leave the base directory empty (repository root). Netlify reads the build command and publish folder from `netlify.toml`.
3. Before deploying, open **Site configuration → Environment variables** and add:

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase private service-role / secret key |
   | `VITE_SUPABASE_URL` | Same Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
   | `AUTH_SECRET` | A new, long random secret used to sign admin sessions |
   | `ADMIN_EMAIL` | The owner's admin login email |
   | `ADMIN_PASSWORD` | A strong, unique first admin password |
   | `SEED_DEMO_PROJECTS` | `false` to start with an empty portfolio |
   | `PUBLIC_SITE_URL` | Netlify site URL, such as `https://your-site.netlify.app` |

   `SUPABASE_SERVICE_ROLE_KEY` and `AUTH_SECRET` are private. Never add either to a variable beginning with `VITE_`.

4. Start the deploy. Netlify builds the Vite site and deploys the `netlify/functions/api.ts` serverless API. The first API request seeds the initial admin, site content, services, categories, and cities.

## 4. Check the live site

- Website: `https://your-site.netlify.app`
- Admin: `https://your-site.netlify.app/admin`
- API health check: `https://your-site.netlify.app/api/health`

Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set. Add real projects and photos in Admin → Projects. Photos upload directly to Supabase Storage using short-lived signed URLs; the service-role key stays on the server.

## 5. Optional custom domain

In Netlify, open **Domain management → Add a domain**, add the business domain, and follow the DNS instructions. Then update `PUBLIC_SITE_URL` in Netlify and redeploy.

## Local development

1. Copy `.env.example` to `.env` and fill in your Supabase URL, keys, admin credentials, and `AUTH_SECRET`.
2. Run `npm install` and `npm run dev` from the project root.
3. Open `http://localhost:5000`.

The Supabase tables and Storage bucket must be set up before the first API request. Keep `.env` private; it is excluded from Git.

## Troubleshooting

| Symptom | Check |
|---|---|
| Netlify build fails on Vite Supabase variables | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then trigger a new deploy. |
| API responds with missing Supabase settings | Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Netlify. |
| Admin cannot sign in | Check `ADMIN_EMAIL` / `ADMIN_PASSWORD`; the admin is created on the first API request after the schema is installed. |
| Photo upload fails in the browser | Confirm `supabase/setup.sql` created the `oakline-uploads` bucket and the bucket allows the site origin for Storage CORS. |
| API reports missing database tables | Run `supabase/setup.sql` in the correct Supabase project's SQL Editor. |
| Admin or project links return 404 | Keep the included `netlify.toml` and deploy from the repository root so the SPA and API redirects are installed. |
