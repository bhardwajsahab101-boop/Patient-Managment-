import express from "express";
import { exportClinicData } from "../controllers/export.controller.js";
import { requireOwnerClinic } from "../middleware/requireOwnerClinic.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";
import { requirePlan } from "../middleware/plan.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic);

router.get("/data", requireOwnerClinic, requirePlan("pro"), exportClinicData);
router.get("/backup", requireOwnerClinic, requirePlan("pro"), (req, res) =>
  import("../controllers/export.controller.js").then(({ exportClinicBackupZip }) =>
    exportClinicBackupZip(req, res),
  ),
);

export default router;
