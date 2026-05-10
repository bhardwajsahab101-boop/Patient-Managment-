import Plan from "../models/Plan.js";

export const requireTrialActive = async (req, res, next) => {
  try {
    const plan = (await Plan.findOne({ userId: req.user._id }).lean()) || null;

    if (!plan) return res.redirect("/account-pending");

    // If subscriptionEndsAt exists and is in past => expired
    if (plan.subscriptionEndsAt && new Date() > plan.subscriptionEndsAt) {
      return res.status(403).render("account-pending", {
        title: "Subscription Expired",
        message: "Your plan has expired. Please contact support to renew.",
        showRenewal: true,
      });
    }

    if (plan.status === "pending") {
      return res.redirect("/account-pending");
    }
    // clinic request is not showing in admin panal 
//  the admin page should show approve trial button after user send request for free trial and free trial should be depend on the use request of which plane use is sending requset  and admin panal should only show one button for approve trial depending on user request and days left shuld also  show in view clinic details page in  the admin panal  
    // Trial gate (both Starter + Pro can use trial)
    if (plan.trialEndsAt && new Date() > plan.trialEndsAt) {
      // If user has an active subscription, allow them to continue.
      // (Upgraded users will have subscriptionEndsAt)
      if (!plan.subscriptionEndsAt) {
        // Deactivate in DB so user is actually blocked after trial end
        // (request-time deactivation; no cron in this project)
        // Deactivate in DB so user is actually blocked after trial end
        // (request-time deactivation; no cron in this project)
        req.user.isActive = false;
        await req.user.save();

        // Optional: mark plan as expired (for clarity)
        await Plan.updateOne(
          { userId: req.user._id },
          { $set: { status: "expired" } },
        );

        return res.status(403).render("account-pending", {
          title: "Trial Expired",
          message:
            "Your 14-day trial is over. Please contact support to activate/renew.",
          showRenewal: true,
        });
      }
    }

    req.plan = plan;
    next();
  } catch (err) {
    console.error("requireTrialActive error:", err);
    res.status(500).send("Plan check failed");
  }
};

export const requirePlan = (requiredPlan) => {
  return async (req, res, next) => {
    try {
      const plan =
        (await Plan.findOne({ userId: req.user._id }).lean()) || null;

      if (!plan) {
        return res.status(403).render("account-pending", {
          title: "Plan Required",
          message: "Please activate your plan to continue.",
          showRenewal: true,
        });
      }

      // Ensure not expired
      if (plan.subscriptionEndsAt && new Date() > plan.subscriptionEndsAt) {
        return res.status(403).render("account-pending", {
          title: "Subscription Expired",
          message: "Your plan has expired. Please contact support to renew.",
          showRenewal: true,
        });
      }

      // Allow if user is on required plan
      if (plan.plan !== requiredPlan) {
        return res.status(403).render("account-pending", {
          title: "Pro Feature",
          message: `This feature requires the ${requiredPlan.toUpperCase()} plan.`,
          showRenewal: true,
        });
      }

      req.plan = plan;
      next();
    } catch (err) {
      console.error("requirePlan error:", err);
      res.status(500).send("Plan check failed");
    }
  };
};
