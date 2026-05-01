import express from "express";
import { requireAuth, requireActive } from "../middleware/auth.js";
import {
  getSettings,
  updateClinicDetails,
  updatePrintSettings,
  updateNotificationSettings,
  updateInventorySettings,
  changePassword,
  updateLogo,
  updateSignature,
  getSettingsData,
} from "../controllers/settings.controller.js";

const router = express.Router();

// All routes require authentication and active subscription
router.use(requireAuth);
router.use(requireActive);

// GET /settings — Main settings page
router.get("/", getSettings);

// GET /settings/data — API endpoint for AJAX
router.get("/data", getSettingsData);

// PUT /settings/clinic — Update clinic details
router.put("/clinic", updateClinicDetails);

// PUT /settings/print — Update print settings
router.put("/print", updatePrintSettings);

// PUT /settings/notifications — Update notification settings
router.put("/notifications", updateNotificationSettings);

// PUT /settings/inventory — Update inventory settings
router.put("/inventory", updateInventorySettings);

// PUT /settings/password — Change password
router.put("/password", changePassword);

// PUT /settings/logo — Upload clinic logo
router.put("/logo", updateLogo);

// PUT /settings/signature — Upload doctor signature
router.put("/signature", updateSignature);

export default router;
