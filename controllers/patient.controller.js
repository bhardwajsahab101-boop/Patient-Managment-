import { patient } from "../models/patient.js";
import Medicine from "../models/medicine.js";
import StockTransaction from "../models/stockTransaction.js";
import Clinic from "../models/clinic.js";

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

// Helper: process prescribed medicines
async function processPrescribedMedicines(
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
    const { name, age, gender, phone, treatment } = req.body.patient;
    const { notes, price, nextVisit } = req.body.visit;
    const { medicineIds, medicineQuantities } = req.body;
    const userId = req.user._id;
    const clinicId = await getUserClinic(userId);

    const sanitizedPhone = phone.replace(/\D/g, "");

    const nextVisitDate = nextVisit ? new Date(nextVisit) : null;
    if (nextVisitDate && isNaN(nextVisitDate.getTime())) {
      throw new Error("Invalid next visit date");
    }

    // Process prescribed medicines
    const prescribedMedicines = await processPrescribedMedicines(
      medicineIds,
      medicineQuantities,
      clinicId,
      null, // patient not created yet, will update after
      notes?.trim(),
    );

    const newPatient = new patient({
      name: name.trim(),
      age: parseInt(age) || undefined,
      gender,
      phone: sanitizedPhone,
      treatment: treatment?.trim(),
      nextVisit: nextVisitDate,
      userId,
      clinicId,
      visits: [
        {
          notes: notes?.trim(),
          price: parseFloat(price) || 0,
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

  const patients = await patient
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

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
    const patientData = await patient
      .findOne({
        _id: req.params.id,
        userId: req.user._id,
      })
      .lean();
    if (!patientData) return res.status(404).send("Patient not found");
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
    const { notes, price, nextVisit } = req.body.visit;
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
    const prescribedMedicines = await processPrescribedMedicines(
      medicineIds,
      medicineQuantities,
      clinicId,
      foundPatient._id,
      notes?.trim(),
    );

    foundPatient.visits.push({
      notes: notes?.trim(),
      price: parseFloat(price) || 0,
      nextVisit: nextVisitDate,
      medicines: prescribedMedicines,
    });
    foundPatient.nextVisit = nextVisitDate;

    await foundPatient.save();
    res.redirect(`/patient/${id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding visit");
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
      nextVisit: req.body.visit?.nextVisit
        ? new Date(req.body.visit.nextVisit)
        : undefined,
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
