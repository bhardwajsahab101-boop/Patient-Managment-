import Clinic from "../models/clinic.js";
import ClinicMember from "../models/ClinicMember.js";

function getClinicId(req) {
  return req?.clinicContext?.clinicId ? String(req.clinicContext.clinicId) : null;
}

export async function requireOwnerOrMemberClinic(req, res, next) {
  try {
    if (!req.user?._id) return res.status(401).send("Unauthorized");

    const userId = req.user._id;
    const clinicId = getClinicId(req);

    if (!clinicId) return res.status(404).send("Clinic not found");

    // Owner always allowed
    const clinic = await Clinic.findOne({ _id: clinicId, ownerId: userId }).lean();
    if (clinic) return next();

    // Otherwise must be a clinic member
    const member = await ClinicMember.findOne({
      clinicId,
      userId,
    }).lean();

    if (!member) return res.status(403).send("Forbidden");

    return next();
  } catch (err) {
    console.error("requireOwnerOrMemberClinic error:", err);
    return res.status(500).send("Clinic authorization failed");
  }
}
