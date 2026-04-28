import express from "express";
import {
  getSupportPage,
  postSupportMessage,
} from "../controllers/support.controller.js";
import {
  requireAuth,
  requireActive,
  requireClinic,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireActive, requireClinic);
router.get("/", getSupportPage);
router.post("/", postSupportMessage);

export default router;
