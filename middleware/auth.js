import User from "../models/User.js";
import Clinic from "../models/clinic.js";

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

// 🟢 Require active account + valid subscription
export const requireActive = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user.isActive) {
      return res.redirect("/account-pending");
    }

    if (user.subscriptionEndsAt && new Date() > user.subscriptionEndsAt) {
      return res.status(403).render("account-pending", {
        title: "Subscription Expired",
        message:
          "Your subscription has expired. Please contact support to renew.",
        showRenewal: true,
      });
    }

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
