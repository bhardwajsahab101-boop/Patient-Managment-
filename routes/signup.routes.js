import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Clinic from "../models/clinic.js";

const router = express.Router();

// GET /signup — render signup form
router.get("/signup", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("signup", { title: "Sign Up", error: null });
});

// POST /signup — create user (NO clinic yet, isActive: false)
router.post("/signup", async (req, res) => {
  try {
    const { name, phone, password, secretKey } = req.body;

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).render("signup", {
        title: "Sign Up",
        error: "Phone number already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔑 Check secret key for admin signup
    const isAdminSignup =
      secretKey && secretKey.trim() === process.env.SECRET_KEY;

    const user = new User({
      name,
      phone,
      password: hashedPassword,
      role: isAdminSignup ? "admin" : "doctor",
      isActive: isAdminSignup ? true : false,
    });

    await user.save();

    // ⛔ NO clinic created here anymore — user must do it after activation
    req.session.userId = user._id;

    // Admin goes straight to dashboard, others go to pending
    if (isAdminSignup) {
      return res.redirect("/dashboard");
    }

    res.redirect("/account-pending");
  } catch (err) {
    res.status(500).render("signup", {
      title: "Sign Up",
      error: err.message,
    });
  }
});

// GET /login — render login form
router.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("login", { title: "Login", error: null });
});

// POST /login — smart redirect based on activation + clinic status
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).render("login", {
        title: "Login",
        error: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).render("login", {
        title: "Login",
        error: "Invalid credentials",
      });
    }

    req.session.userId = user._id;

    // 🧠 STEP 2: Check if active
    if (!user.isActive) {
      return res.redirect("/account-pending");
    }

    // 🧠 STEP 4: Check subscription expiry
    if (user.subscriptionEndsAt && new Date() > user.subscriptionEndsAt) {
      return res.redirect("/account-pending");
    }

    // 🧠 STEP 4: Check clinic existence
    const clinic = await Clinic.findOne({ ownerId: user._id }).lean();
    if (!clinic) {
      return res.redirect("/create-clinic");
    }

    // ✅ All good → Dashboard
    res.redirect("/dashboard");
  } catch (err) {
    res.status(500).render("login", {
      title: "Login",
      error: err.message,
    });
  }
});

// POST /logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// GET /account-pending — show pending approval page
router.get("/account-pending", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  try {
    const user = await User.findById(req.session.userId).lean();
    if (!user) return res.redirect("/login");

    // If user became active, redirect them
    if (user.isActive) {
      const clinic = await Clinic.findOne({ ownerId: user._id }).lean();
      return res.redirect(clinic ? "/dashboard" : "/create-clinic");
    }

    res.render("account-pending", {
      title: "Account Pending",
      userName: user.name,
      message: null,
      showRenewal: false,
    });
  } catch (err) {
    res.status(500).render("error", { message: "Something went wrong" });
  }
});

// GET /profile — User profile page
router.get("/profile", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  try {
    const { patient } = await import("../models/patient.js");
    const Medicine = (await import("../models/medicine.js")).default;

    const user = await User.findById(req.session.userId).lean();
    if (!user) return res.redirect("/login");

    const clinic = await Clinic.findOne({ ownerId: user._id }).lean();

    // Counts
    const patientCount = clinic
      ? await patient.countDocuments({ clinicId: clinic._id })
      : 0;
    const medicineCount = clinic
      ? await Medicine.countDocuments({ clinicId: clinic._id, isActive: true })
      : 0;

    // Visits this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    let visitsThisMonth = 0;
    if (clinic) {
      const patientsWithVisits = await patient
        .find({ clinicId: clinic._id })
        .lean();
      visitsThisMonth = patientsWithVisits.reduce((total, p) => {
        const monthVisits = (p.visits || []).filter(
          (v) => v.date >= startOfMonth && v.date <= endOfMonth,
        );
        return total + monthVisits.length;
      }, 0);
    }

    // Subscription status
    const isExpired = user.subscriptionEndsAt
      ? new Date() > new Date(user.subscriptionEndsAt)
      : false;

    res.render("profile", {
      title: "My Profile",
      user,
      clinic,
      patientCount,
      medicineCount,
      visitsThisMonth,
      isExpired,
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).render("error", { message: "Unable to load profile" });
  }
});

export default router;
