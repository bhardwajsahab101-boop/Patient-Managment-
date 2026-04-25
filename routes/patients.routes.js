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
} from "../controllers/patient.controller.js";
import { validatePatient, validateVisit } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

// New patient form (must be BEFORE /:id)
router.get("/new", newPatientForm);

// Create patient
router.post("/", validatePatient, createPatient);

// List all patients
router.get("/", listPatients);

// Visit form & add visit (must be BEFORE /:id)
router.get("/:id/visits/new", newVisitForm);
router.post("/:id/visits", validateVisit, addVisit);

// Edit, update, delete (must be BEFORE /:id)
router.get("/:id/edit", editForm);
router.put("/:id", validatePatient, updatePatient);
router.get("/:id/delete", deleteForm);
router.delete("/:id", deletePatient);

// Patient detail (generic /:id goes LAST)
router.get("/:id", getPatientDetail);

export default router;
