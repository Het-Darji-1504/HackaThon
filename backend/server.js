require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "";
if (JWT_SECRET.length < 32 || JWT_SECRET.startsWith("replace_")) {
  console.error("Set JWT_SECRET to a private random value of at least 32 characters.");
  process.exit(1);
}

const databasePath = path.resolve(process.env.DATABASE_PATH || "./data/work-satthi.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const allowedOrigins = (process.env.CORS_ORIGINS ||
  "https://het-darji-1504.github.io,http://localhost:5500,http://127.0.0.1:5500")
  .split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "20kb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait before trying again." }
});
app.use("/api", apiLimiter);

const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer', 'worker')),
    phone TEXT NOT NULL DEFAULT '',
    area TEXT NOT NULL DEFAULT '',
    service TEXT NOT NULL DEFAULT '',
    rate TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    experience TEXT NOT NULL DEFAULT '',
    availability TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_id TEXT NOT NULL,
    location TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    preferred_date TEXT NOT NULL,
    preferred_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    ,worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS worker_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, phone TEXT NOT NULL, service TEXT NOT NULL, area TEXT NOT NULL,
    rate TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON bookings(customer_id);
  CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings(created_at);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare("PRAGMA table_info(" + table + ")").all();
  if (!columns.some((item) => item.name === column)) {
    db.exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
  }
}
// Keep existing hackathon prototype databases compatible with the updated API.
ensureColumn("bookings", "customer_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
ensureColumn("bookings", "worker_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
ensureColumn("users", "experience", "TEXT NOT NULL DEFAULT ''");
ensureColumn("users", "availability", "TEXT NOT NULL DEFAULT ''");

const services = [
  { id: "plumbing", name: "Plumbing", category: "Repairs", description: "Leaks, taps, fittings, and common water-related repairs.", icon: "🔧" },
  { id: "electrical", name: "Electrical work", category: "Home", description: "Household electrical repairs and installation.", icon: "⚡" },
  { id: "cleaning", name: "Home cleaning", category: "Cleaning", description: "One-time cleaning or scheduled help.", icon: "🧹" },
  { id: "cooking", name: "Cooking & daily help", category: "Daily help", description: "Local cooks and other everyday skills.", icon: "🍲" },
  { id: "carpentry", name: "Carpentry", category: "Repairs", description: "Furniture repairs, fittings, and small woodwork jobs.", icon: "🪚" },
  { id: "painting", name: "Painting", category: "Home", description: "Room painting and touch-up work.", icon: "🖌️" }
];

function cleanString(value, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
function isValidPhone(phone) { return /^\+?[0-9\s()-]{8,18}$/.test(phone); }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T00:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone,
    area: user.area, service: user.service, rate: user.rate, bio: user.bio,
    experience: user.experience || "", availability: user.availability || "",
    createdAt: user.created_at, updatedAt: user.updated_at
  };
}
function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, JWT_SECRET, { expiresIn: "7d", issuer: "work-satthi" });
}
function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: "work-satthi" });
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(payload.sub));
    if (!user) return res.status(401).json({ error: "Your session is no longer valid. Please log in again." });
    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Work Satthi API", timestamp: new Date().toISOString() });
});

app.get("/api/services", (req, res) => {
  const query = cleanString(req.query.q, 80).toLowerCase();
  const category = cleanString(req.query.category, 60).toLowerCase();
  const result = services.filter((service) => {
    const matchesQuery = !query || (service.name + " " + service.description + " " + service.category).toLowerCase().includes(query);
    return matchesQuery && (!category || service.category.toLowerCase() === category);
  });
  res.json({ count: result.length, services: result });
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const body = req.body || {};
  const name = cleanString(body.name, 80);
  const email = cleanString(body.email, 160).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "worker" ? "worker" : body.role === "customer" ? "customer" : "";
  const phone = cleanString(body.phone, 20);
  const area = cleanString(body.area, 160);
  const service = cleanString(body.service, 100);
  const rate = cleanString(body.rate, 100);
  const bio = cleanString(body.bio, 500);
  const experience = cleanString(body.experience, 80);
  const availability = cleanString(body.availability, 160);
  if (!name || !email || !password || !role) return res.status(400).json({ error: "Name, email, password, and account type are required." });
  if (!isValidEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be between 8 and 72 characters." });
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: "Please enter a valid phone number." });
  if (role === "worker" && (!area || !service)) return res.status(400).json({ error: "Workers must provide their service and local area." });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return res.status(409).json({ error: "An account with this email already exists. Please log in." });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare("INSERT INTO users (name, email, password_hash, role, phone, area, service, rate, bio, experience, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(name, email, passwordHash, role, phone, area, service, rate, bio, experience, availability);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json({ message: "Your account has been created.", token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error && error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "An account with this email already exists. Please log in." });
    console.error("Account registration failed:", error.message);
    return res.status(500).json({ error: "Could not create your account right now. Please try again." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const email = cleanString(req.body && req.body.email, 160).toLowerCase();
  const password = req.body && typeof req.body.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ error: "Please enter your email and password." });
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  return res.json({ message: "You are now logged in.", token: signToken(user), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.put("/api/users/me", requireAuth, (req, res) => {
  const body = req.body || {};
  const current = req.user;
  const name = body.name === undefined ? current.name : cleanString(body.name, 80);
  const phone = body.phone === undefined ? current.phone : cleanString(body.phone, 20);
  const area = body.area === undefined ? current.area : cleanString(body.area, 160);
  const service = body.service === undefined ? current.service : cleanString(body.service, 100);
  const rate = body.rate === undefined ? current.rate : cleanString(body.rate, 100);
  const bio = body.bio === undefined ? current.bio : cleanString(body.bio, 500);
  const experience = current.role === "worker" && body.experience !== undefined ? cleanString(body.experience, 80) : current.experience;
  const availability = current.role === "worker" && body.availability !== undefined ? cleanString(body.availability, 160) : current.availability;
  if (!name) return res.status(400).json({ error: "Your name is required." });
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: "Please enter a valid phone number." });
  if (current.role === "worker" && (!area || !service)) return res.status(400).json({ error: "Worker profiles must include a service and local area." });
  db.prepare("UPDATE users SET name = ?, phone = ?, area = ?, service = ?, rate = ?, bio = ?, experience = ?, availability = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, phone, area, service, rate, bio, experience, availability, current.id);
  return res.json({ message: "Profile saved.", user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(current.id)) });
});

app.get("/api/workers", (req, res) => {
  const query = cleanString(req.query.q, 80).toLowerCase();
  const areaFilter = cleanString(req.query.area, 100).toLowerCase();
  const workers = db.prepare("SELECT id, name, area, service, rate, bio, experience, availability, created_at FROM users WHERE role = 'worker' AND area <> '' AND service <> '' ORDER BY created_at DESC").all()
    .filter((worker) => {
      const text = [worker.name, worker.area, worker.service, worker.bio].join(" ").toLowerCase();
      return (!query || text.includes(query)) && (!areaFilter || worker.area.toLowerCase().includes(areaFilter));
    })
    .map((worker) => ({ id: worker.id, name: worker.name, area: worker.area, service: worker.service, rate: worker.rate, bio: worker.bio, experience: worker.experience, availability: worker.availability, createdAt: worker.created_at }));
  res.json({ count: workers.length, workers });
});

app.post("/api/bookings", requireAuth, (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ error: "Only customer accounts can create booking requests." });
  const body = req.body || {};
  const customerName = cleanString(body.customerName || req.user.name, 80);
  const phone = cleanString(body.phone || req.user.phone, 20);
  const serviceId = cleanString(body.serviceId, 40);
  const location = cleanString(body.location, 160);
  const details = cleanString(body.details, 1000);
  const preferredDate = cleanString(body.preferredDate, 10);
  const preferredTime = cleanString(body.preferredTime, 5);
  if (!customerName || !phone || !serviceId || !location || !preferredDate || !preferredTime) {
    return res.status(400).json({ error: "Please provide your name, phone, service, location, date, and time." });
  }
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Please enter a valid phone number." });
  if (!services.some((service) => service.id === serviceId)) return res.status(400).json({ error: "Please select a valid service." });
  if (!isValidDate(preferredDate) || preferredDate < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: "Please choose a valid date that is not in the past." });
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) return res.status(400).json({ error: "Please choose a valid time." });
  const result = db.prepare("INSERT INTO bookings (customer_name, phone, service_id, location, details, preferred_date, preferred_time, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(customerName, phone, serviceId, location, details, preferredDate, preferredTime, req.user.id);
  return res.status(201).json({
    message: "Your booking request has been received. The team will contact you to confirm availability.",
    booking: { id: result.lastInsertRowid, serviceId, preferredDate, preferredTime, status: "pending" }
  });
});

app.get("/api/bookings/mine", requireAuth, (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ error: "Only customer accounts can view customer booking history." });
  const rows = db.prepare("SELECT id, customer_name AS customerName, phone, service_id AS serviceId, location, details, preferred_date AS preferredDate, preferred_time AS preferredTime, status, created_at AS createdAt FROM bookings WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(req.user.id);
  const bookingRows = rows.map((booking) => ({ ...booking, serviceName: (services.find((item) => item.id === booking.serviceId) || {}).name || booking.serviceId }));
  res.json({ count: bookingRows.length, bookings: bookingRows });
});

app.delete("/api/bookings/:id", requireAuth, (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ error: "Only customer accounts can cancel customer booking requests." });
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid booking ID." });
  const booking = db.prepare("SELECT id, status FROM bookings WHERE id = ? AND customer_id = ?").get(id, req.user.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.status !== "pending") return res.status(409).json({ error: "Only pending booking requests can be cancelled." });
  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND customer_id = ?").run(id, req.user.id);
  res.json({ message: "Booking request cancelled." });
});

app.post("/api/contact", (req, res) => {
  const body = req.body || {};
  const name = cleanString(body.name, 80);
  const email = cleanString(body.email, 160).toLowerCase();
  const subject = cleanString(body.subject, 120);
  const message = cleanString(body.message, 2000);
  if (!name || !email || !subject || !message) return res.status(400).json({ error: "Please complete all contact form fields." });
  if (!isValidEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  const result = db.prepare("INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)")
    .run(name, email, subject, message);
  return res.status(201).json({ message: "Your message has been received.", messageId: result.lastInsertRowid });
});

app.use((req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((err, _req, res, _next) => {
  if (err.message === "Origin is not allowed by CORS") return res.status(403).json({ error: "This website origin is not allowed to access the API." });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body must contain valid JSON." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  console.error("Request failed:", err.message);
  return res.status(500).json({ error: "Unexpected server error." });
});

const server = app.listen(PORT, () => console.log("Work Satthi API listening on port " + PORT));
function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
