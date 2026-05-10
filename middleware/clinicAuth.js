import Clinic from "../models/clinic.js";

// Strict clinic authorization for Phase 1 migration.
// - If route param `clinicId` exists: enforce ownership and set req.clinicContext
// - Else: keep backward compatibility (fallback to existing loadClinicContext behavior)
//
// Usage example (Phase 3 will move to /clinic/:clinicId/...):
// router.use(requireAuth, requireActive, requireClinicAccessFromParam);
export async function requireClinicAccessFromParam(req, res, next) {
  try {
    const clinicIdFromParam = req.params?.clinicId
      ? String(req.params.clinicId)
      : null;
      // hey black box this check total revenue is not working in any of pages like patients and reports  

    // Backward compatibility: when app is still mounted at /patients etc
    // and clinicId comes from query via loadClinicContext, do nothing here.
    if (!clinicIdFromParam) return next();

    if (!req.user?._id) return res.status(401).send("Unauthorized");

    const clinic = await Clinic.findOne({
      _id: clinicIdFromParam,
      ownerId: req.user._id,
    }).lean();

    if (!clinic) {
      return res.status(404).send("Clinic not found");
    }

    req.clinicContext = {
      ...(req.clinicContext || {}),
      clinicId: clinicIdFromParam,
    };
    res.locals.clinicId = clinicIdFromParam;

    next();
  } catch (err) {
    console.error("requireClinicAccessFromParam error:", err);
    res.status(500).send("Clinic authorization failed");
  }
}

export function getClinicId(req) {
  return req?.clinicContext?.clinicId
    ? String(req.clinicContext.clinicId)
    : null;
}
