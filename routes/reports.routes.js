import express from "express";
import { getReports } from "../controllers/reports.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);
router.get("/", getReports);

export default router;

