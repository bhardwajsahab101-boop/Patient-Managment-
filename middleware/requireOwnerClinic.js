import Clinic from "../models/clinic.js";

function getClinicId(req) {
  return req?.clinicContext?.clinicId ? String(req.clinicContext.clinicId) : null;
}

export async function requireOwnerClinic(req, res, next) {
  try {
    if (!req.user?._id) return res.status(401).send("Unauthorized");

    const clinicId = getClinicId(req);
    if (!clinicId) return res.status(404).send("Clinic not found");

    const clinic = await Clinic.findOne({ _id: clinicId, ownerId: req.user._id }).lean();
    if (!clinic) return res.status(403).send("Forbidden");

    next();
  } catch (err) {
    console.error("requireOwnerClinic error:", err);
    res.status(500).send("Owner authorization failed");
  }
}
