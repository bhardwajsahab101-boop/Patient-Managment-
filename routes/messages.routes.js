import express from "express";
import { getMessage } from "../controllers/message.controller.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic);
router.get("/:id", getMessage);

export default router;
