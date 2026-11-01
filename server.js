import "dotenv/config";
import express from "express";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();
const SQLiteStore = SQLiteStoreFactory(session);
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
  store: new SQLiteStore({ db: "sessions.sqlite", dir: process.env.SESSION_DIR || "/var/data" }),
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

const requireAuth = (req, res, next) => req.session?.authenticated
  ? next()
  : res.redirect("/login");

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

async function refreshData() {
  // Intentionally safe placeholder:
  // Connect approved read-only data APIs here after credentials and scopes are verified.
  // Never place API secrets in public/ or send them to the browser.
  const snapshot = await readSnapshot();
  snapshot.refreshAttemptAt = new Date().toISOString();
  snapshot.refreshStatus = "awaiting_provider_configuration";
  await fs.mkdir(path.dirname(path.resolve(DATA_FILE)), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  return snapshot;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/login", (_req, res) => res.sendFile(path.resolve("public/login.html")));
app.post("/login", async (req, res) => {
  const hash = process.env.VIEWER_PASSWORD_HASH;
  if (!hash || !req.body.password) return res.status(503).send("لم يتم إعداد كلمة المرور بعد.");
  const valid = await bcrypt.compare(req.body.password, hash);
  if (!valid) return res.status(401).send("كلمة المرور غير صحيحة. <a href='/login'>حاول مجددًا</a>");
  req.session.authenticated = true;
  res.redirect("/");
});
app.post("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

app.get("/", requireAuth, (_req, res) => res.sendFile(path.resolve("public/index.html")));
app.get("/api/dashboard", requireAuth, async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(await readSnapshot());
});
app.post("/api/refresh", requireAuth, async (_req, res) => {
  res.status(202).json({ accepted: true, message: "تم تسجيل طلب التحديث؛ يلزم إعداد موصلات البيانات أولًا." });
});

const schedule = process.env.DATA_REFRESH_CRON || "0 5 * * *";
if (cron.validate(schedule)) cron.schedule(schedule, () => refreshData().catch(() => {}));

app.listen(PORT, () => console.log(`Dashboard listening on ${PORT}`));
