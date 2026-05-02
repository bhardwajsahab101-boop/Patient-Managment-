import { patient } from "../models/patient.js";
import Medicine from "../models/medicine.js";
import StockTransaction from "../models/stockTransaction.js";
import Clinic from "../models/clinic.js";
import {
  processPrescribedMedicines,
  enrichPrescribedMedicines,
} from "../middleware/medicineHelpers.js";

// Helper: get user's default clinic
async function getUserClinic(userId) {
  const clinic = await Clinic.findOne({ ownerId: userId }).lean();
  return clinic ? clinic._id.toString() : null;
}

// Helper: get available medicines for clinic
async function getClinicMedicines(clinicId) {
  if (!clinicId) return [];
  return await Medicine.find({ clinicId, isActive: true, stock: { $gt: 0 } })
    .sort({ name: 1 })
    .lean();
}

// GET /patients/new
export async function newPatientForm(req, res) {
  try {
    const userId = req.user._id;
    const clinicId = await getUserClinic(userId);
    const medicines = await getClinicMedicines(clinicId);

    res.render("NewPatients.ejs", {
      errors: [],
      patient: null,
      visit: null,
      medicines,
    });
  } catch (err) {
    console.error("New patient form error:", err);
    res.status(500).render("error", { message: "Unable to load form" });
  }
}

// POST /patients
export async function createPatient(req, res) {
  try {
    if (req.validationErrors && req.validationErrors.length) {
      const clinicId = await getUserClinic(req.user._id);
      const medicines = await getClinicMedicines(clinicId);
      const selectedMedicineIds = Array.isArray(req.body.medicineIds)
        ? req.body.medicineIds.map(String)
        : req.body.medicineIds
          ? [String(req.body.medicineIds)]
          : [];
      const medicineQuantities = Array.isArray(req.body.medicineQuantities)
        ? req.body.medicineQuantities
        : req.body.medicineQuantities
          ? [req.body.medicineQuantities]
          : [];
      const selectedMedicineQuantities = selectedMedicineIds.reduce(
        (map, medId, idx) => ({
          ...map,
          [medId]: medicineQuantities[idx] || "1",
        }),
        {},
      );

      return res.status(400).render("NewPatients", {
        errors: req.validationErrors,
        patient: req.body.patient || {},
        visit: req.body.visit || {},
        medicines,
        selectedMedicineIds,
        selectedMedicineQuantities,
      });
    }

    const { name, age, gender, phone, treatment, address } = req.body.patient;
    const { notes, price, nextVisit } = req.body.visit;
    const { medicineIds, medicineQuantities } = req.body;
    const userId = req.user._id;
    const clinicId = await getUserClinic(userId);

    // Payment fields - calculate pending automatically
    const totalPayment =
      parseFloat(req.body.patient?.totalPayment || price) || 0;
    const paidPayment = parseFloat(req.body.patient?.paidPayment) || 0;
    const pendingPayment = Math.max(0, totalPayment - paidPayment);

    const sanitizedPhone = phone.replace(/\D/g, "");

    const nextVisitDate = nextVisit ? new Date(nextVisit) : null;
    if (nextVisitDate && isNaN(nextVisitDate.getTime())) {
      throw new Error("Invalid next visit date");
    }

    // Process prescribed medicines
    // Handle new duration/instructions fields
    const medicineDurations = req.body.medicineDurations || [];
    const medicineInstructions = req.body.medicineInstructions || [];

    const prescribedMedicines = await processPrescribedMedicines(
      medicineIds,
      medicineQuantities,
      clinicId,
      null,
      notes?.trim(),
    );

    // Use shared helper to add duration/instructions
    enrichPrescribedMedicines(
      prescribedMedicines,
      medicineDurations,
      medicineInstructions,
    );

    const initialVisitPrice = totalPayment;
    const initialVisitPaid = paidPayment;

    const newPatient = new patient({
      name: name.trim(),
      age: parseInt(age) || undefined,
      gender,
      phone: sanitizedPhone,
      treatment: treatment?.trim(),
      address: address?.trim(),
      nextVisit: nextVisitDate,
      userId,
      clinicId,
      // Payment fields - pending is calculated automatically
      totalPayment,
      paidPayment,
      pendingPayment,
      visits: [
        {
          notes: notes?.trim(),
          price: initialVisitPrice,
          paidAmount: initialVisitPaid,
          nextVisit: nextVisitDate,
          medicines: prescribedMedicines,
        },
      ],
    });

    await newPatient.save();

    // Update stock transactions with correct patientId
    if (prescribedMedicines.length > 0) {
      await StockTransaction.updateMany(
        {
          clinicId,
          patientId: null,
          createdAt: { $gte: new Date(Date.now() - 60000) }, // last minute
        },
        { patientId: newPatient._id },
      );
    }

    res.redirect("/patients");
  } catch (err) {
    console.error("Create patient error:", err);
    const clinicId = await getUserClinic(req.user._id);
    const medicines = await getClinicMedicines(clinicId);
    res.status(400).render("NewPatients", {
      errors: [{ msg: err.message }],
      patient: req.body.patient,
      visit: req.body.visit,
      medicines,
    });
  }
}

// GET /patients
export async function listPatients(req, res) {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = 12;
  const searchQuery = req.query.q ? req.query.q.trim() : "";

  const filter = { userId };

  if (searchQuery) {
    filter.$or = [
      { name: { $regex: searchQuery, $options: "i" } },
      { phone: { $regex: searchQuery, $options: "i" } },
    ];
  }

  const total = await patient.countDocuments(filter);

  // Optimize: Only fetch required fields for list view using .select()
  const patients = await patient
    .find(filter)
    .select(
      "name age gender phone treatment visits nextVisit isActive createdAt totalPayment paidPayment",
    )
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.render("patients", {
    patients,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    searchQuery,
  });
}

// GET /patients/:id
export async function getPatientDetail(req, res) {
  try {
    // Don't use .lean() - we need the Mongoose document with proper getters
    const patientData = await patient.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!patientData) return res.status(404).send("Patient not found");

    // Ensure payment totals are up to date
    let totalFromVisits = 0;
    let paidFromVisits = 0;
    if (patientData.visits && patientData.visits.length) {
      patientData.visits.forEach((v) => {
        totalFromVisits += v.price || 0;
        paidFromVisits += v.paidAmount || 0;
      });
    }

    // Update totals if they don't match
    if (patientData.totalPayment !== totalFromVisits) {
      patientData.totalPayment = totalFromVisits;
    }
    if (patientData.paidPayment !== paidFromVisits) {
      patientData.paidPayment = paidFromVisits;
    }
    patientData.pendingPayment = Math.max(
      0,
      patientData.totalPayment - patientData.paidPayment,
    );

    // Save if updated
    if (patientData.isModified()) {
      await patientData.save();
    }

    res.render("patient-detail", { patient: patientData });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
}

// GET /patients/:id/visits/new
export async function newVisitForm(req, res) {
  try {
    const userId = req.user._id;
    const patientData = await patient.findOne({
      _id: req.params.id,
      userId,
    });
    if (!patientData) return res.status(404).send("Patient not found");

    const clinicId = await getUserClinic(userId);
    const medicines = await getClinicMedicines(clinicId);

    res.render("patients-visits-new", { patient: patientData, medicines });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
}

// POST /patients/:id/visits
export async function addVisit(req, res) {
  try {
    const { id } = req.params;
    const { notes, totalPayment, paidPayment, nextVisit } = req.body.visit;
    const { medicineIds, medicineQuantities } = req.body;
    const userId = req.user._id;

    const foundPatient = await patient.findOne({
      _id: id,
      userId,
    });
    if (!foundPatient) return res.status(404).send("Patient not found");

    const nextVisitDate = nextVisit ? new Date(nextVisit) : null;
    if (
      nextVisit &&
      (isNaN(nextVisitDate.getTime()) || nextVisitDate < new Date())
    ) {
      return res.status(400).send("Invalid future date");
    }

    const clinicId = await getUserClinic(userId);

    // Process prescribed medicines
    // Handle new duration/instructions fields
    const medicineDurations = req.body.medicineDurations || [];
    const medicineInstructions = req.body.medicineInstructions || [];

    const prescribedMedicines = await processPrescribedMedicines(
      medicineIds,
      medicineQuantities,
      clinicId,
      foundPatient._id,
      notes?.trim(),
    );

    // Use shared helper to add duration/instructions
    enrichPrescribedMedicines(
      prescribedMedicines,
      medicineDurations,
      medicineInstructions,
    );

    const visitPrice = parseFloat(totalPayment || req.body.visit?.price) || 0;
    const visitPaid =
      parseFloat(paidPayment || req.body.visit?.paidAmount) || 0;

    foundPatient.visits.push({
      notes: notes?.trim(),
      price: visitPrice,
      paidAmount: visitPaid,
      nextVisit: nextVisitDate,
      medicines: prescribedMedicines,
    });
    foundPatient.nextVisit = nextVisitDate;

    // Recalculate patient totals from visit history for consistency
    const totalFromVisits = foundPatient.visits.reduce(
      (sum, v) => sum + (v.price || 0),
      0,
    );
    const paidFromVisits = foundPatient.visits.reduce(
      (sum, v) => sum + (v.paidAmount || 0),
      0,
    );

    foundPatient.totalPayment = totalFromVisits;
    foundPatient.paidPayment = paidFromVisits;
    foundPatient.pendingPayment = Math.max(0, totalFromVisits - paidFromVisits);

    await foundPatient.save();
    res.redirect(`/patient/${id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding visit");
  }
}

// GET /patients/:id/visit/:visitIndex/pay
export async function payVisit(req, res) {
  try {
    const { id, visitIndex } = req.params;
    const foundPatient = await patient.findOne({
      _id: id,
      userId: req.user._id,
    });
    if (!foundPatient || !foundPatient.visits[visitIndex]) {
      return res.status(404).send("Patient or visit not found");
    }

    const visit = foundPatient.visits[visitIndex];
    const pending = visit.price - (visit.paidAmount || 0);
    if (pending <= 0) {
      return res.redirect(`/patient/${id}`);
    }

    visit.paidAmount = visit.price;

    const totalFromVisits = foundPatient.visits.reduce(
      (sum, v) => sum + (v.price || 0),
      0,
    );
    const paidFromVisits = foundPatient.visits.reduce(
      (sum, v) => sum + (v.paidAmount || 0),
      0,
    );

    foundPatient.totalPayment = totalFromVisits;
    foundPatient.paidPayment = paidFromVisits;
    foundPatient.pendingPayment = Math.max(0, totalFromVisits - paidFromVisits);

    await foundPatient.save();
    res.redirect(`/patient/${id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
}

// GET /patients/:id/edit
export async function editForm(req, res) {
  try {
    const patientData = await patient.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!patientData) return res.status(404).send("Patient not found");
    res.render("edit", { patient: patientData });
  } catch (err) {
    res.status(500).send("Server error");
  }
}

// GET /patients/:id/delete
export async function deleteForm(req, res) {
  try {
    const patientData = await patient.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!patientData) return res.status(404).send("Patient not found");
    res.render("delete", { patient: patientData });
  } catch (err) {
    res.status(500).send("Server error");
  }
}

// PUT /patients/:id
export async function updatePatient(req, res) {
  try {
    if (req.validationErrors && req.validationErrors.length) {
      return res.status(400).render("edit", {
        patient: {
          _id: req.params.id,
          ...req.body.patient,
          nextVisit: req.body.visit?.nextVisit,
        },
        errors: req.validationErrors,
      });
    }

    const { id } = req.params;
    const userId = req.user._id;

    // Verify ownership first
    const existing = await patient.findOne({
      _id: id,
      userId,
    });
    if (!existing) return res.status(404).send("Patient not found");

    const updateData = {
      name: req.body.patient?.name?.trim(),
      age: parseInt(req.body.patient?.age),
      gender: req.body.patient?.gender,
      phone: req.body.patient?.phone?.replace(/\D/g, ""),
      treatment: req.body.patient?.treatment?.trim(),
      address: req.body.patient?.address?.trim(),
      nextVisit: req.body.visit?.nextVisit
        ? new Date(req.body.visit.nextVisit)
        : undefined,
      // Payment fields - calculate pending automatically
      totalPayment: parseFloat(req.body.patient?.totalPayment) || 0,
      paidPayment: parseFloat(req.body.patient?.paidPayment) || 0,
      pendingPayment: Math.max(
        0,
        (parseFloat(req.body.patient?.totalPayment) || 0) -
          (parseFloat(req.body.patient?.paidPayment) || 0),
      ),
    };

    Object.keys(updateData).forEach(
      (key) =>
        (updateData[key] === undefined || updateData[key] === null) &&
        delete updateData[key],
    );

    if (updateData.nextVisit && isNaN(updateData.nextVisit.getTime())) {
      return res.status(400).send("Invalid date");
    }

    const updatedPatient = await patient.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedPatient) return res.status(404).send("Patient not found");
    res.redirect("/patients");
  } catch (err) {
    console.error("Update error:", err);
    res.status(400).send("Validation error: " + err.message);
  }
}

// DELETE /patients/:id
export async function deletePatient(req, res) {
  try {
    const { id } = req.params;

    const deleted = await patient.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });
    if (!deleted) return res.status(404).send("Patient not found");

    res.redirect("/patients");
  } catch (err) {
    console.error(err);
    res.status(500).send("Delete error");
  }
}
