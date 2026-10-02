// Suppress legacy third-party dependency warnings (such as url.parse DEP0169)
process.noDeprecation = true;

import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { app } from "./src/server/app";

export { app };

const PORT = Number(process.env.PORT) || 3000;

// Vite & Standalone HTTP Server Setup
async function startServer() {
  if (process.env.VERCEL) {
    return;
  }

  const server = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      }
    }));
    app.get("*", (_req, res) => {
      try {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          let html = fs.readFileSync(indexPath, "utf8");
          const gaMeasurementId = (process.env.VITE_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID || "").trim();
          const clarityProjectId = (process.env.VITE_CLARITY_PROJECT_ID || process.env.CLARITY_PROJECT_ID || "").trim();
          const envInjection = `<script>window.__TULIP_ENV__ = Object.assign(window.__TULIP_ENV__ || {}, { VITE_GA_MEASUREMENT_ID: ${JSON.stringify(gaMeasurementId)}, VITE_CLARITY_PROJECT_ID: ${JSON.stringify(clarityProjectId)} });</script>`;
          html = html.replace("<head>", `<head>\n    ${envInjection}`);
          return res.send(html);
        }
      } catch (e) {
        console.warn("[Server] Notice injecting env into index.html:", e);
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Tulip Fragrance Company server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
