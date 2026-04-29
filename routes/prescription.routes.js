import express from "express";
import { getPrescription } from "../controllers/prescription.controller.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic);

// View prescription
router.get("/:patientId/:visitIndex", getPrescription);
// Print preview route
router.get("/:patientId/:visitIndex/print", (req, res, next) => {
  req.query.print = "true";
  getPrescription(req, res, next);
});

export default router;
