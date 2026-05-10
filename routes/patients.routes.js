import express from "express";
import {
  newPatientForm,
  createPatient,
  listPatients,
  getPatientDetail,
  newVisitForm,
  addVisit,
  editForm,
  deleteForm,
  updatePatient,
  deletePatient,
  payVisit,
} from "../controllers/patient.controller.js";
import { validatePatient, validateVisit } from "../middleware/validation.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";
import { loadClinicContext } from "../middleware/clinicContext.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic, loadClinicContext);

// New patient form (must be BEFORE /:id)
router.get("/new", newPatientForm);

// Create patient
router.post("/", validatePatient, createPatient);

// List all patients
router.get(
  "/",
  (req, res, next) => {
    // ensure selected clinicId persists; loadClinicContext already runs in router.use
    // but we normalize empty/invalid clinicId so it cannot fall back to default
    if (
      typeof req.query.clinicId === "string" &&
      req.query.clinicId.trim() === ""
    ) {
      delete req.query.clinicId;
    }
    next();
  },
  listPatients,
);

// Visit form & add visit (must be BEFORE /:id)
router.get("/:id/visits/new", newVisitForm);
router.post("/:id/visits", validateVisit, addVisit);

// Pay for a specific visit
router.get("/:id/visit/:visitIndex/pay", payVisit);

// Edit, update, delete (must be BEFORE /:id)
router.get("/:id/edit", editForm);
router.put("/:id", validatePatient, updatePatient);
router.get("/:id/delete", deleteForm);
router.post("/:id/delete", deletePatient);

// Patient detail (generic /:id goes LAST)
router.get("/:id", getPatientDetail);

export default router;
