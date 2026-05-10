import Plan from "../models/Plan.js";

const NOW = () => new Date();
const FAR_FUTURE_DAYS = 365 * 50; // ~50 years

function normalizeToDate(d) {
  return d instanceof Date ? d : d ? new Date(d) : null;
}

export function getPlanStatus(plan) {
  if (!plan) return { status: "pending", isActive: false };

  const now = NOW();

  const trialEndsAt = normalizeToDate(plan.trialEndsAt);
  const paidEndsAt = normalizeToDate(plan.subscriptionEndsAt);

  const hasTrialEndsAt = !!trialEndsAt;
  const hasPaidEndsAt = !!paidEndsAt;

  const trialActive = hasTrialEndsAt ? now <= trialEndsAt : false;
  const paidActive = hasPaidEndsAt ? now <= paidEndsAt : false;

  if (paidActive || trialActive) {
    return { status: "active", isActive: true };
  }

  if (hasPaidEndsAt || hasTrialEndsAt) {
    return { status: "expired", isActive: false };
  }

  return { status: "pending", isActive: false };
}

export function isPlanActive(plan) {
  return getPlanStatus(plan).isActive;
}

/**
 * Ensure admins always have an active paid PRO entitlement that never expires.
 * - If Plan doc missing: create it
 * - If Plan doc exists but not PRO/expired: update it
 */
export async function ensureAdminProPlan({ userId }) {
  const now = NOW();
  const farFuture = new Date(now);
  farFuture.setDate(farFuture.getDate() + FAR_FUTURE_DAYS);

  let planDoc = await Plan.findOne({ userId });

  if (!planDoc) {
    planDoc = new Plan({
      userId,
      plan: "pro",
      trialEndsAt: undefined,
      subscriptionEndsAt: farFuture,
      status: "active",
    });
    await planDoc.save();
    return planDoc;
  }

  planDoc.plan = "pro";
  planDoc.trialEndsAt = undefined;
  planDoc.subscriptionEndsAt = farFuture;
  planDoc.status = "active";
  await planDoc.save();
  return planDoc;
}

/**
 * DB sync helper: if the computed status differs from persisted status,
 * update Plan.status and (optionally) user.isActive.
 */
export async function syncPlanStatusForUser({ userId, user, planDoc }) {
  const plan = planDoc || (await Plan.findOne({ userId }).lean());
  if (!plan) {
    return { plan: null, status: "pending", isActive: false, updated: false };
  }

  const computed = getPlanStatus(plan);
  const updated = { plan: plan._id, statusChanged: false, userChanged: false };

  if (plan.status !== computed.status) {
    await Plan.updateOne(
      { _id: plan._id },
      { $set: { status: computed.status } },
    );
    updated.statusChanged = true;
  }

  if (user && user.isActive !== computed.isActive) {
    user.isActive = computed.isActive;
    await user.save();
    updated.userChanged = true;
  }

  return {
    plan,
    status: computed.status,
    isActive: computed.isActive,
    updated,
  };
}
