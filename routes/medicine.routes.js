import express from "express";
import Medicine from "../models/medicine.js";
import { requireAuth } from "../middleware/auth.js";
import Clinic from "../models/clinic.js";

const router = express.Router();

// Helper: get user's default clinic
async function getUserClinic(userId) {
  const clinic = await Clinic.findOne({ ownerId: userId }).lean();
  return clinic ? clinic._id.toString() : null;
}

// GET all medicines
router.get("/", requireAuth, async (req, res) => {
  try {
    let { clinicId } = req.query;
    const userId = req.user._id;

    // If no clinicId in query, use user's default clinic
    if (!clinicId) {
      clinicId = await getUserClinic(userId);
    }

    if (!clinicId) {
      return res.render("medicine/index", {
        medicines: [],
        error: "No clinic found. Please create a clinic first.",
      });
    }

    // Validate clinic ownership
    const clinic = await Clinic.findById(clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res
        .status(403)
        .render("error", { message: "Unauthorized access to clinic" });
    }

    const medicines = await Medicine.find({ clinicId })
      .lean()
      .sort({ name: 1 });

    res.render("medicine/index", { medicines, clinicId });
  } catch (err) {
    console.error("Medicines list error:", err);
    res.status(500).render("error", { message: "Unable to load medicines" });
  }
});

// GET new medicine form
router.get("/new", requireAuth, async (req, res) => {
  try {
    let { clinicId } = req.query;
    const userId = req.user._id;

    if (!clinicId) {
      clinicId = await getUserClinic(userId);
    }

    if (!clinicId) {
      return res
        .status(400)
        .render("error", {
          message: "No clinic found. Please create a clinic first.",
        });
    }

    // Validate ownership
    const clinic = await Clinic.findById(clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    res.render("medicine/new", { clinicId });
  } catch (err) {
    console.error("New medicine form error:", err);
    res.status(500).render("error", { message: "Unable to load form" });
  }
});

// POST create medicine
router.post("/", requireAuth, async (req, res) => {
  try {
    let { name, stock, buyPrice, sellPrice, clinicId } = req.body;
    const userId = req.user._id;

    // Trim and validate name
    name = typeof name === "string" ? name.trim() : "";
    if (!name || name.length < 2) {
      return res.status(400).render("medicine/new", {
        clinicId,
        error: "Medicine name must be at least 2 characters",
      });
    }

    // Validate numeric fields
    stock = parseInt(stock, 10) || 0;
    buyPrice = parseFloat(buyPrice) || 0;
    sellPrice = parseFloat(sellPrice) || 0;

    if (stock < 0 || buyPrice < 0 || sellPrice < 0) {
      return res.status(400).render("medicine/new", {
        clinicId,
        error: "Stock and prices cannot be negative",
      });
    }

    // Validate clinic ownership
    const clinic = await Clinic.findById(clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    // Create medicine
    const medicine = new Medicine({
      name,
      stock,
      buyPrice,
      sellPrice,
      clinicId,
    });

    await medicine.save();

    res.redirect(`/medicines?clinicId=${clinicId}`);
  } catch (err) {
    console.error("Create medicine error:", err);
    res.status(500).render("medicine/new", {
      clinicId: req.body.clinicId,
      error: "Failed to save medicine. Please try again.",
    });
  }
});

// GET add stock (+1)
router.get("/add/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).render("error", { message: "Medicine not found" });
    }

    // Validate clinic ownership
    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    medicine.stock += 1;
    await medicine.save();

    res.redirect(`/medicines?clinicId=${medicine.clinicId}`);
  } catch (err) {
    console.error("Add stock error:", err);
    res.status(500).render("error", { message: "Unable to update stock" });
  }
});

// GET remove stock (-1)
router.get("/remove/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).render("error", { message: "Medicine not found" });
    }

    // Validate clinic ownership
    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    if (medicine.stock > 0) {
      medicine.stock -= 1;
      await medicine.save();
    }

    res.redirect(`/medicines?clinicId=${medicine.clinicId}`);
  } catch (err) {
    console.error("Remove stock error:", err);
    res.status(500).render("error", { message: "Unable to update stock" });
  }
});

export default router;
