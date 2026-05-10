import User from "../models/User.js";
import Clinic from "../models/clinic.js";
import Plan from "../models/Plan.js";
import {
  ensureAdminProPlan,
  syncPlanStatusForUser,
} from "./planStatus.js";

// 🔐 Base auth: session must exist + user must exist in DB
export const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).send("User not found");
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).send("Authentication error");
  }
};

// 🏥 Fetch clinic for current user and attach to req (reduces duplicate DB calls)
export const attachClinic = async (req, res, next) => {
  try {
    if (req.user?._id) {
      const clinic = await Clinic.findOne({ ownerId: req.user._id }).lean();
      req.clinic = clinic;
    }
    next();
  } catch (err) {
    console.error("Clinic attach error:", err);
    next();
  }
};

// 🟢 Require active account + valid subscription (Plan is source of truth)
export const requireActive = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.redirect("/login");

    // Admins: never expire (always treated as active PRO)
    if (user.role === "admin") {
      await ensureAdminProPlan({ userId: user._id });
      return next();
    }

    const planDoc = await Plan.findOne({ userId: user._id }).lean();

    // Compute active/expired from plan/trial dates and optionally sync user.isActive
    const syncResult = await syncPlanStatusForUser({
      userId: user._id,
      user,
      planDoc,
    });

    // Block if plan is not active (trial or paid)
    if (!syncResult.isActive) {
      return res.status(403).render("account-pending", {
        title: "Subscription Expired",
        message:
          "Your subscription/trial has expired. Please contact support to renew.",
        showRenewal: true,
        userName: user?.name || "",
      });
    }

    // If plan is active, allow access.
    next();
  } catch (err) {
    console.error("Active check error:", err);
    res.status(500).send("Account status check failed");
  }
};

// 🏥 Require clinic ownership (redirect to create if none)
export const requireClinic = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const clinic = await Clinic.findOne({ ownerId: userId }).lean();

    if (!clinic) {
      return res.redirect("/create-clinic");
    }

    req.clinic = clinic;
    next();
  } catch (err) {
    console.error("Clinic check error:", err);
    res.status(500).send("Clinic verification failed");
  }
};

// 🔒 Combined: active + clinic (for dashboard & main app routes)
export const requireActiveAndClinic = [
  requireAuth,
  requireActive,
  requireClinic,
];
