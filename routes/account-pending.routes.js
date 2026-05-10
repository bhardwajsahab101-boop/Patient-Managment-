import express from "express";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
// POST /account-pending/activate-trial?plan=starter|pro
// User requests a free trial; admin approval is required to activate it.
router.post(
  "/account-pending/activate-trial",
  requireAuth,
  async (req, res) => {
    try {
      const planType = (req.query.plan || "").toLowerCase();
      if (!planType || !["starter", "pro"].includes(planType)) {
        return res.status(400).redirect("/account-pending");
      }

      const user = req.user;

      // ensure plan doc exists
      let planDoc = await Plan.findOne({ userId: user._id });
      if (!planDoc) {
        planDoc = new Plan({ userId: user._id });
      }

      // Mark as pending approval (no trialEndsAt yet; admin will set it)
      planDoc.plan = planType;
      planDoc.trialEndsAt = undefined;
      planDoc.subscriptionEndsAt = undefined;
      planDoc.status = "pending";

      // Mark as not active (admin will activate)
      user.isActive = false;
      await user.save();

      await planDoc.save();

      return res.redirect("/account-pending");
    } catch (err) {
      console.error("activate-trial (request) error:", err);
      return res.status(500).redirect("/account-pending");
    }
  },
);

export default router;
