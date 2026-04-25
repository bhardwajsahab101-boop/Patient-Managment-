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

// POST /signup — create user + clinic
router.post("/signup", async (req, res) => {
  try {
    const { name, phone, password, clinicName, clinicLocation } = req.body;

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).render("signup", {
        title: "Sign Up",
        error: "Phone number already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      phone,
      password: hashedPassword,
    });

    await user.save();

    // Create default clinic for this doctor
    const clinic = new Clinic({
      name: clinicName || `${name}'s Clinic`,
      location: clinicLocation || "",
      ownerId: user._id,
    });

    await clinic.save();

    req.session.userId = user._id;
    res.redirect("/dashboard");
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

// POST /login
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

export default router;
