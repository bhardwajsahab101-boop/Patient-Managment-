import express from "express";
import { getFollowups } from "../controllers/followup.controller.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic);
router.get("/", getFollowups);

export default router;
