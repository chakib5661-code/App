# Vite/React → Next.js (App Router) migration

## Structure
- `src/app/layout.tsx` – root layout (metadata, `lang="ar" dir="rtl"`, theme color, preloads) replacing `index.html`.
- `src/app/page.tsx` → `ClientRoot.tsx` → `Root.tsx` – the storefront (`src/App.tsx`, unchanged) is a client component loaded with `dynamic(..., { ssr: false })` because it uses localStorage/IndexedDB/service workers. `Root.tsx` replaces `main.tsx` (ErrorBoundary, analytics init, PWA registration, Vercel Analytics/Speed Insights).
- `src/app/api/[[...path]]/route.ts` – serves the existing Express API (`src/server/app.ts`) through `src/server/nodeBridge.ts`, which adapts a Fetch `Request` to Node req/res (JSON bodies, SSE `/api/events`, CORS, write lock queue preserved). No custom server needed; works on Vercel.
- `next.config.mjs` – maps `VITE_*`/`GA_*`/`CLARITY_*` env vars so existing names still work; `postcss.config.mjs` – Tailwind v4.

## Removed
`vite.config.ts`, `server.ts`, `index.html`, `src/main.tsx`, `vite-env.d.ts`, `vercel.json`, `api/` (prebuilt bundle), `src/server/vercelEntry.ts`, `bun.lock`; deps vite, @vitejs/plugin-react, @tailwindcss/vite, esbuild, compression, tsx.

## Code edits
- `utils/analytics.ts`, `utils/supabaseClient.ts`: `import.meta.env.*` → `process.env.*`.
- `server/app.ts`: dropped `compression` and `express.static` (Next handles both).

## Run
`npm install && npm run dev` (or `npm run build && npm start`). Copy `.env.example` to `.env`.
