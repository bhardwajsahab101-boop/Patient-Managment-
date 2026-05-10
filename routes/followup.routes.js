import express from "express";
import { getFollowups } from "../controllers/followup.controller.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";
import { loadClinicContext } from "../middleware/clinicContext.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic, loadClinicContext);
router.get("/", getFollowups);

export default router;
