import app from "./app";

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel Serverless Function Error]:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Erreur interne du serveur Vercel",
        details: err?.message || String(err),
      });
    }
  }
}
