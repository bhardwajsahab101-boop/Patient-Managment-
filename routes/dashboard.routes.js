import express from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic);
router.get("/", getDashboard);

export default router;
