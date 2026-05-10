import express from "express";
import { getReports } from "../controllers/reports.controller.js";
import { requireOwnerClinic } from "../middleware/requireOwnerClinic.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic);
router.get("/", requireOwnerClinic, getReports);

export default router;
