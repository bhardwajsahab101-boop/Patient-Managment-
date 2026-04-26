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
import signupRoutes from "./routes/signup.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";
import User from "./models/User.js";

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


app.set('trust proxy', 1);
// Trust proxy for accurate client IP behind reverse proxies (Docker, Nginx, etc.)
// Set TRUST_PROXY in .env or defaults to 1 (trust first proxy)
app.set("trust proxy", process.env.TRUST_PROXY || 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SECURITY MIDDLEWARE
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
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
        ],
        imgSrc: ["'self'", "data:", "https://ui-avatars.com"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
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

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "defaultsecretchangeme",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
  }),
);

// VIEW ENGINE
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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

// ROUTES
app.use("/", signupRoutes);

app.use("/dashboard", dashboardRoutes);
app.use("/patients", patientRoutes);
app.use("/followup", followupRoutes);
app.use("/reports", reportsRoutes);
app.use("/message", messagesRoutes);
app.use("/medicines", medicineRoutes);


// Backward-compatible singular patient detail route (protected)
app.get("/patient/:id", requireAuth, async (req, res, next) => {
  const { getPatientDetail } =
    await import("./controllers/patient.controller.js");
  getPatientDetail(req, res, next);
});

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
