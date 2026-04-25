import express from "express";
import { getMessage } from "../controllers/message.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);
router.get("/:id", getMessage);

export default router;
