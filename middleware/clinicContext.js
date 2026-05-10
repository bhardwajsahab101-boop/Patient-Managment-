import Clinic from "../models/clinic.js";
import ClinicMember from "../models/ClinicMember.js";
import Plan from "../models/Plan.js";
import { getPlanStatus } from "./planStatus.js";

// Determines clinic context for Pro users.

// - Reads `clinicId` from query (dropdown)
// - Validates clinic belongs to current user
// - Falls back to first clinic for the user
export async function loadClinicContext(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId) return next();

    // Fetch clinics where user is either:
    // - owner (Clinic.ownerId)
    // - member (ClinicMember.userId)
    const ownedClinics = await Clinic.find({ ownerId: userId })
      .select("_id name")
      .sort({ createdAt: -1 })
      .lean();

    const memberClinicIds = await ClinicMember.find({ userId })
      .select("clinicId")
      .lean();

    const memberIds = new Set(memberClinicIds.map((m) => String(m.clinicId)));

    const memberClinics = await Clinic.find({
      _id: { $in: Array.from(memberIds) },
    })
      .select("_id name")
      .sort({ createdAt: -1 })
      .lean();

    const clinicsMap = new Map();
    for (const c of ownedClinics) clinicsMap.set(String(c._id), c);
    for (const c of memberClinics) clinicsMap.set(String(c._id), c);

    const clinics = Array.from(clinicsMap.values()).sort((a, b) =>
      a._id.toString().localeCompare(b._id.toString()),
    );

    res.locals.userClinics = clinics;

    const defaultClinicId = clinics[0]?._id || null;

    const selectedClinicId = req.query?.clinicId ? req.query.clinicId : null;


    // Validate selected clinic (must be owned OR member)
    let clinicId = defaultClinicId;

    if (selectedClinicId) {
      const okClinic = clinics.find(
        (c) => c._id.toString() === String(selectedClinicId),
      );
      if (okClinic) {
        clinicId = okClinic._id; // MUST remain ObjectId
      }
    }

    // Extra safety: if no clinic found for user, don't set clinicId
    if (!clinicId) {
      req.clinicContext = {
        clinicId: null,
        clinics,
      };

      res.locals.clinicId = null;
      return next();
    }

    req.clinicContext = {
      clinicId,
      clinics,
    };

    res.locals.clinicId = clinicId;

    next();
  } catch (err) {
    console.error("loadClinicContext error:", err);
    next();
  }
}

// Pro-only gate to show multi-clinic dropdown (expiration-aware)
// Pro-only gate to show multi-clinic dropdown (expiration-aware)
export async function requireProForClinicSelector(req, res, next) {
  try {
    // Admins always have pro capabilities
    if (req.user?.role === "admin") return next();

    const plan = await Plan.findOne({ userId: req.user._id }).lean();
    if (plan?.plan !== "pro") return next();

    const { isActive } = getPlanStatus(plan);
    if (!isActive) return next();

    next();
  } catch (e) {
    next();
  }
}
