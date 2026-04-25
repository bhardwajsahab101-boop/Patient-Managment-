import express from "express";
import { getFollowups } from "../controllers/followup.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);
router.get("/", getFollowups);

export default router;
