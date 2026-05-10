import express from "express";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
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

// POST /admin/trials/approve?userId=<id>&plan=starter|pro
// Approves a pending free trial so the account becomes active for 14 days.
router.post(
  "/admin/trials/approve",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = req.query.userId;
      const planType = (req.query.plan || "").toLowerCase();

      if (!userId || !["starter", "pro"].includes(planType)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid parameters" });
      }

      const user = await User.findById(userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      // Create/update plan
      let planDoc = await Plan.findOne({ userId });
      if (!planDoc) planDoc = new Plan({ userId });

      const now = new Date();
      const trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      planDoc.plan = planType;
      planDoc.trialEndsAt = trialEndsAt;
      planDoc.subscriptionEndsAt = undefined;
      planDoc.status = "active";

      // Safety: if user was waiting for admin approval, ensure they're active now
      // so protected routes can pass.

      await planDoc.save();

      // Activate user for trial window
      user.isActive = true;
      await user.save();

      return res.redirect("/admin");
    } catch (err) {
      console.error("Trial approve error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

export default router;
