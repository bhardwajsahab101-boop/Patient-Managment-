import express from "express";
import User from "../models/User.js";
import Clinic from "../models/clinic.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Simple admin check middleware
const requireAdmin = async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .render("error", { message: "Admin access required" });
  }
  next();
};

// ===================== HTML ADMIN PANEL =====================

// GET /admin — Admin Panel UI
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select("name phone role isActive subscriptionEndsAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const clinics = await Clinic.find({}).select("name ownerId").lean();
    const clinicMap = {};
    clinics.forEach((c) => {
      clinicMap[c.ownerId.toString()] = c.name;
    });

    users.forEach((u) => {
      u.clinicName = clinicMap[u._id.toString()] || null;
      u.isExpired = u.subscriptionEndsAt
        ? new Date() > new Date(u.subscriptionEndsAt)
        : false;
    });

    res.render("admin", {
      title: "Admin Panel",
      users,
    });
  } catch (err) {
    console.error("Admin panel error:", err);
    res.status(500).render("error", { message: "Unable to load admin panel" });
  }
});

// GET /admin/clinics — List all clinics with doctor info
router.get("/clinics", requireAuth, requireAdmin, async (req, res) => {
  try {
    const clinics = await Clinic.find({})
      .populate("ownerId", "name phone role isActive")
      .sort({ createdAt: -1 })
      .lean();

    res.render("admin-clinics", {
      title: "Manage Clinics",
      clinics,
    });
  } catch (err) {
    console.error("Clinics list error:", err);
    res.status(500).render("error", { message: "Unable to load clinics" });
  }
});

// GET /admin/users/:id — View user details
router.get("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).render("error", { message: "User not found" });
    }

    const clinic = await Clinic.findOne({ ownerId: id }).lean();

    res.render("admin-user-detail", {
      title: `User Details - ${user.name}`,
      user,
      clinic,
    });
  } catch (err) {
    console.error("User detail error:", err);
    res.status(500).render("error", { message: "Unable to load user details" });
  }
});

// POST /admin/users/:id/delete — Delete user (with optional clinic deletion)
router.post(
  "/users/:id/delete",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { deleteClinic } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).render("error", { message: "User not found" });
      }

      // Delete associated clinic if requested
      if (deleteClinic === "true") {
        await Clinic.findOneAndDelete({ ownerId: id });
      }

      // Delete user
      await User.findByIdAndDelete(id);

      res.redirect("/admin");
    } catch (err) {
      console.error("Delete user error:", err);
      res.status(500).render("error", { message: "Failed to delete user" });
    }
  },
);

// POST /admin/clinics/:id/delete — Delete clinic
router.post(
  "/clinics/:id/delete",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const clinic = await Clinic.findById(id);
      if (!clinic) {
        return res.status(404).render("error", { message: "Clinic not found" });
      }

      await Clinic.findByIdAndDelete(id);
      res.redirect("/admin/clinics");
    } catch (err) {
      console.error("Delete clinic error:", err);
      res.status(500).render("error", { message: "Failed to delete clinic" });
    }
  },
);

// POST /admin/users/:id/toggle — Toggle isActive (Activate/Deactivate)
router.post(
  "/users/:id/toggle",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).render("error", { message: "User not found" });
      }

      user.isActive = !user.isActive;
      await user.save();

      res.redirect("/admin");
    } catch (err) {
      console.error("Toggle active error:", err);
      res.status(500).render("error", { message: "Failed to update user" });
    }
  },
);

// POST /admin/users/:id/subscription — Update subscription days
router.post(
  "/users/:id/subscription",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { subscriptionDays } = req.body;
      const days = parseInt(subscriptionDays) || 30;

      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + days);

      const user = await User.findByIdAndUpdate(
        id,
        { subscriptionEndsAt },
        { new: true },
      );

      if (!user) {
        return res.status(404).render("error", { message: "User not found" });
      }

      res.redirect("/admin");
    } catch (err) {
      console.error("Update subscription error:", err);
      res
        .status(500)
        .render("error", { message: "Failed to update subscription" });
    }
  },
);

// ===================== JSON API (optional) =====================

// PATCH /admin/users/:id/activate — API endpoint
router.patch(
  "/users/:id/activate",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const subscriptionDays = parseInt(req.body.subscriptionDays) || 30;

      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setDate(
        subscriptionEndsAt.getDate() + subscriptionDays,
      );

      const user = await User.findByIdAndUpdate(
        id,
        { isActive: true, subscriptionEndsAt },
        { new: true },
      );

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        message: `User activated with ${subscriptionDays}-day subscription`,
        user: {
          id: user._id,
          name: user.name,
          isActive: user.isActive,
          subscriptionEndsAt: user.subscriptionEndsAt,
        },
      });
    } catch (err) {
      console.error("Admin activate error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /admin/users — JSON list of inactive users
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const inactiveUsers = await User.find({ isActive: false })
      .select("name phone createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, users: inactiveUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
