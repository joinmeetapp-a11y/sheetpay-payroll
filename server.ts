import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 301 Permanent Redirects for legacy SEO migration & query routes
const REDIRECT_MAP: Record<string, string> = {
  "/nis-calculator": "/nis-calculator-trinidad",
  "/trinidad-nis-calculator": "/nis-calculator-trinidad",
  "/barbados-nis-calculator": "/nis-calculator-barbados",
  "/st-lucia-paye-calculator": "/paye-calculator-st-lucia",
  "/saint-lucia-paye-calculator": "/paye-calculator-st-lucia",
  "/belize-tax-calculator": "/income-tax-calculator-belize",
  "/belize-income-tax-calculator": "/income-tax-calculator-belize",
  "/tt-calculator": "/trinidad-and-tobago",
  "/bb-calculator": "/barbados",
  "/lc-calculator": "/saint-lucia",
  "/bz-calculator": "/belize",
  "/calculator": "/calculators",
  "/tax-calculators": "/calculators",
};

Object.entries(REDIRECT_MAP).forEach(([from, to]) => {
  app.get(from, (req, res) => {
    res.redirect(301, to);
  });
});

// All AI features (chat, OCR, transcription) run in Convex actions against
// OpenAI. This Express server only handles static hosting + SEO redirects.
app.post("/api/cayla", (_req, res) => {
  res.status(410).json({
    error:
      "This endpoint is retired. Cayla now runs entirely through Convex actions calling OpenAI.",
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sheetpay server running on http://localhost:${PORT}`);
  });
}

startServer();
