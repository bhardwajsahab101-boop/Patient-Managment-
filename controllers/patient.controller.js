import { patient } from "../models/patient.js";

// GET /patients/new
export function newPatientForm(req, res) {
  res.render("NewPatients.ejs", { errors: [], patient: null, visit: null });
}

// POST /patients
export async function createPatient(req, res) {
  try {
    const { name, age, gender, phone, treatment } = req.body.patient;
    const { notes, price, nextVisit } = req.body.visit;
    const userId = req.user._id;

    const sanitizedPhone = phone.replace(/\D/g, "");

    const nextVisitDate = nextVisit ? new Date(nextVisit) : null;
    if (nextVisitDate && isNaN(nextVisitDate.getTime())) {
      throw new Error("Invalid next visit date");
    }

    const newPatient = new patient({
      name: name.trim(),
      age: parseInt(age) || undefined,
      gender,
      phone: sanitizedPhone,
      treatment: treatment?.trim(),
      nextVisit: nextVisitDate,
      userId,
      visits: [
        {
          notes: notes?.trim(),
          price: parseFloat(price) || 0,
          nextVisit: nextVisitDate,
        },
      ],
    });

    await newPatient.save();
    res.redirect("/patients");
  } catch (err) {
    console.error("Create patient error:", err);
    res.status(400).render("NewPatients", {
      errors: [{ msg: err.message }],
      patient: req.body.patient,
      visit: req.body.visit,
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
    const patientData = await patient.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!patientData) return res.status(404).send("Patient not found");
    res.render("patients-visits-new", { patient: patientData });
  } catch (err) {
    res.status(500).send("Server error");
  }
}

// POST /patients/:id/visits
export async function addVisit(req, res) {
  try {
    const { id } = req.params;
    const { notes, price, nextVisit } = req.body.visit;

    const foundPatient = await patient.findOne({
      _id: id,
      userId: req.user._id,
    });
    if (!foundPatient) return res.status(404).send("Patient not found");

    const nextVisitDate = nextVisit ? new Date(nextVisit) : null;
    if (
      nextVisit &&
      (isNaN(nextVisitDate.getTime()) || nextVisitDate < new Date())
    ) {
      return res.status(400).send("Invalid future date");
    }

    foundPatient.visits.push({
      notes: notes?.trim(),
      price: parseFloat(price) || 0,
      nextVisit: nextVisitDate,
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
