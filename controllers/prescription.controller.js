import { patient } from "../models/patient.js";
import Clinic from "../models/clinic.js";
import Medicine from "../models/medicine.js";

// Helper: resolve clinicId from context
function resolveClinicId(req) {
  return req.clinicContext?.clinicId ? req.clinicContext.clinicId : null;
}

// GET /prescription/:patientId/:visitIndex
// GET /prescription/:patientId/:visitIndex/print
export async function getPrescription(req, res) {
  try {
    const { patientId, visitIndex } = req.params;
    const userId = req.user._id;
    const clinicId = resolveClinicId(req);
    const isPrintMode = req.query.print === "true";

    // Find patient owned by user in current clinic
    const patientData = await patient
      .findOne({
        _id: patientId,
        clinicId,
      })
      .lean();

    if (!patientData || !patientData.visits[visitIndex]) {
      return res.status(404).send("Prescription not found");
    }

    const visit = patientData.visits[visitIndex];

    // Get clinic details
    const patientClinicId = patientData.clinicId;
    let clinic = null;
    if (patientClinicId) {
      clinic = await Clinic.findById(patientClinicId).lean();
    }

    // Enrich medicines with full details if needed (populate name/dosage already stored)
    const medicines = visit.medicines.map((med) => ({
      name: med.name,
      dosage: med.dosage,
      duration: med.duration || "",
      instructions: med.instructions || "",
      quantity: med.quantity,
    }));

    res.render("prescription", {
      patient: patientData,
      visit,
      visitIndex: parseInt(visitIndex),
      clinic,
      medicines,
      currentUser: req.user,
      isPrintMode,
      title: "Prescription",
    });
  } catch (err) {
    console.error("Prescription error:", err);
    res.status(500).send("Server error");
  }
}
