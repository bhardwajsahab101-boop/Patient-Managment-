import express from "express";
import mongoose from "mongoose";
import path from "path";
import ejsMate from "ejs-mate";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import medicineRoutes from "./routes/medicine.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import patientRoutes from "./routes/patients.routes.js";
import followupRoutes from "./routes/followup.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import supportRoutes from "./routes/support.routes.js";
import signupRoutes from "./routes/signup.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import prescriptionRoutes from "./routes/prescription.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import exportRoutes from "./routes/export.routes.js";
import accountPendingRoutes from "./routes/account-pending.routes.js";
import adminTrialRoutes from "./routes/admin-trial.routes.js";

import { errorHandler } from "./middleware/errorHandler.js";
import {
  loadClinicContext,
  requireProForClinicSelector,
} from "./middleware/clinicContext.js";
import { requireOwnerOrMemberClinic } from "./middleware/clinicMemberAuth.js";
import { requireOwnerClinic } from "./middleware/requireOwnerClinic.js";

import {
  requireAuth,
  requireActive,
  requireClinic,
} from "./middleware/auth.js";

import User from "./models/User.js";
import Clinic from "./models/clinic.js";
import Plan from "./models/Plan.js";
import {
  getCreateClinicForm,
  createClinic,
} from "./controllers/clinic.controller.js";

dotenv.config();

// DB CONNECT
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected securely");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}
main();

const app = express();

// Trust proxy for accurate client IP behind reverse proxies (Docker, Nginx, etc.)
app.set("trust proxy", process.env.TRUST_PROXY || 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SECURITY MIDDLEWARE
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://html2canvas.hertzen.com",
          "'unsafe-eval'",
        ],
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://ui-avatars.com",
          "https://cdnjs.cloudflare.com",
        ],
        connectSrc: [
          "'self'",
          "https://ui-avatars.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
        ],
      },
    },
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// Session middleware - validate SESSION_SECRET in production
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  console.error("❌ SESSION_SECRET must be set in production environment");
  process.exit(1);
}
app.use(
  session({
    secret: sessionSecret || "dev-only-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    },
  }),
);

// VIEW ENGINE
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// EJS Helper functions for dates and status formatting
app.locals.formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

app.locals.getVisitStatus = (nextVisit) => {
  if (!nextVisit) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(nextVisit);
  next.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((next - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: "Today", class: "bg-warning text-dark" };
  if (diffDays < 0) return { label: "Overdue", class: "bg-danger" };
  return { label: "Upcoming", class: "bg-success" };
};

app.locals.safe = (str) => (str ? str : "");

// Custom method override (forms use ?_method=PUT/DELETE)
app.use((req, res, next) => {
  if (req.query._method) {
    req.method = req.query._method.toUpperCase();
  }
  next();
});

// Global locals & current user for views
app.use((req, res, next) => {
  res.locals.currentRoute = req.path.toLowerCase();
  next();
});

app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).lean();
      res.locals.currentUser = user || null;
    } catch {
      res.locals.currentUser = null;
    }
  } else {
    res.locals.currentUser = null;
  }
  next();
});

// Load user's plan for views (currentPlan)
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const plan = await Plan.findOne({ userId: req.session.userId }).lean();
      res.locals.currentPlan = plan?.plan || null;
    } catch {
      res.locals.currentPlan = null;
    }
  } else {
    res.locals.currentPlan = null;
  }
  next();
});

// Clinic context is loaded via `loadClinicContext` from ./middleware/clinicContext.js.
// (Removed duplicated inline middleware to avoid multi-clinic context mismatches.)

// ROUTES
app.use("/", signupRoutes);

app.use(
  "/dashboard",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireProForClinicSelector,
  requireOwnerOrMemberClinic,
  dashboardRoutes,
);
app.use(
  "/patients",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireProForClinicSelector,
  requireOwnerOrMemberClinic,
  patientRoutes,
);
app.use(
  "/followup",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireProForClinicSelector,
  requireOwnerOrMemberClinic,
  followupRoutes,
);
app.use(
  "/reports",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireProForClinicSelector,
  requireOwnerOrMemberClinic,
  reportsRoutes,
);
app.use(
  "/message",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireProForClinicSelector,
  requireOwnerOrMemberClinic,
  messagesRoutes,
);

app.use("/support", supportRoutes);
app.use(
  "/medicines",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireProForClinicSelector,
  requireOwnerOrMemberClinic,
  medicineRoutes,
);
app.use(
  "/prescription",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireProForClinicSelector,
  requireOwnerOrMemberClinic,
  prescriptionRoutes,
);
app.use(
  "/settings",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireOwnerClinic,
  settingsRoutes,
);

app.use("/admin", adminRoutes);

app.use(
  "/export",
  requireAuth,
  requireActive,
  requireClinic,
  loadClinicContext,
  requireProForClinicSelector,
  requireOwnerOrMemberClinic,
  exportRoutes,
);
app.use("/", accountPendingRoutes);
app.use("/", adminTrialRoutes);

// Pricing page
app.get("/pricing", (req, res) => {
  res.render("pricing");
});
// make it easy to to to crate clinic  page and easy to switch clinic and admin can also saw how many clinics had a pro user resistered
// Create clinic routes (must be active but no clinic yet)

app.get("/create-clinic", requireAuth, requireActive, getCreateClinicForm);
app.post("/create-clinic", requireAuth, requireActive, createClinic);

// Backward-compatible singular patient detail route (protected)
app.get(
  "/patient/:id",
  requireAuth,
  requireActive,
  requireClinic,
  async (req, res, next) => {
    const { getPatientDetail } =
      await import("./controllers/patient.controller.js");
    getPatientDetail(req, res, next);
  },
);

app.get("/", (req, res) => {
  res.render("landing_page");
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running securely on port ${PORT}`);
  console.log("✅ Security fixes applied:");
  console.log("   • Helmet headers");
  console.log("   • Rate limiting");
  console.log("   • Input validation");
  console.log("   • Env vars");
  console.log("AT FINAL EVERY THING IS FINE ");
});
