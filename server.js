import "dotenv/config";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || "./dashboard-data.json";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.json({ limit: "50kb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

const requireAuth = (req, res, next) =>
  req.session?.authenticated ? next() : res.redirect("/login");

async function readSnapshot() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    return {
      status: "not_configured",
      lastUpdated: null,
      sources: {
        salla: { status: "not_connected" },
        ga4: { status: "not_connected" },
        googleAds: { status: "not_connected" },
        tiktok: { status: "not_connected" },
        snapchat: { status: "not_connected" }
      },
      note: "لم يتم ربط مصادر البيانات بعد. لا توجد أرقام مباشرة معروضة."
    };
  }
}

function safePasswordMatch(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string") return false;
  const a = crypto.createHash("sha256").update(candidate, "utf8").digest();
  const b = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(a, b) && candidate === expected;
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/login", (_req, res) => res.sendFile(path.resolve("public/login.html")));
app.post("/login", (req, res) => {
  const expected = process.env.VIEWER_PASSWORD;
  if (!expected) return res.status(503).send("لم يتم إعداد كلمة المرور في Render بعد.");
  if (!safePasswordMatch(req.body.password, expected)) {
    return res.status(401).send("كلمة المرور غير صحيحة. <a href='/login'>حاول مجددًا</a>");
  }
  req.session.authenticated = true;
  res.redirect("/");
});
app.post("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));
app.get("/", requireAuth, (_req, res) => res.sendFile(path.resolve("public/index.html")));
app.get("/api/dashboard", requireAuth, async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(await readSnapshot());
});
app.post("/api/refresh", requireAuth, (_req, res) => {
  res.status(202).json({ accepted: true, message: "موصلات البيانات تحتاج إلى الإعداد أولًا." });
});

app.listen(PORT, () => console.log(`Dashboard listening on ${PORT}`));
