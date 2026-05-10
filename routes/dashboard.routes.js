import express from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";
import { loadClinicContext } from "../middleware/clinicContext.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic, loadClinicContext);

router.get("/", getDashboard);
// hey blackbox please go throw my code and check why i am not redircting on dashboard of the specific clinic when i click on user name button in switch clinic dropdown

export default router;
