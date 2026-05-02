import Medicine from "../models/medicine.js";
import StockTransaction from "../models/stockTransaction.js";

/**
 * Extract prescribed medicines with duration/instructions from request body
 * Consolidates duplicate code from createPatient and addVisit
 * @param {Object} reqBody - Express request body
 * @param {string} clinicId - Clinic ID
 * @param {string|Object} patientId - Patient ID or null for new patients
 * @param {string} visitNote - Visit notes for transaction
 * @returns {Array} Array of prescribed medicine objects
 */
export async function processPrescribedMedicines(
  medicineIds,
  quantities,
  clinicId,
  patientId,
  visitNote,
) {
  const prescribedMedicines = [];

  if (!medicineIds || !Array.isArray(medicineIds)) return prescribedMedicines;

  for (let i = 0; i < medicineIds.length; i++) {
    const medId = medicineIds[i];
    if (!medId) continue;

    const qty = parseInt(quantities?.[i]) || 1;
    const medicine = await Medicine.findById(medId);

    if (!medicine || medicine.stock < qty) continue;

    const previousStock = medicine.stock;
    medicine.stock -= qty;
    await medicine.save();

    // Create stock transaction
    await StockTransaction.create({
      medicineId: medicine._id,
      clinicId,
      patientId,
      type: "OUT",
      quantity: qty,
      previousStock,
      newStock: medicine.stock,
      note: visitNote || `Prescribed to patient`,
    });

    prescribedMedicines.push({
      medicineId: medicine._id,
      name: medicine.name,
      dosage: medicine.dosage,
      quantity: qty,
    });
  }

  return prescribedMedicines;
}

/**
 * Add duration and instructions to prescribed medicines
 * @param {Array} prescribedMedicines - Array of medicine objects
 * @param {Array} medicineDurations - Array of duration strings
 * @param {Array} medicineInstructions - Array of instruction strings
 */
export function enrichPrescribedMedicines(
  prescribedMedicines,
  medicineDurations = [],
  medicineInstructions = [],
) {
  prescribedMedicines.forEach((med, index) => {
    med.duration = medicineDurations[index] || "";
    med.instructions = medicineInstructions[index] || "";
  });
  return prescribedMedicines;
}
