import express from "express";
import Medicine from "../models/medicine.js";
import { requireAuth } from "../middleware/auth.js";
import Clinic from "../models/clinic.js";
import StockTransaction from "../models/stockTransaction.js";
import { patient } from "../models/patient.js";

const router = express.Router();

// Helper: get user's default clinic
async function getUserClinic(userId) {
  const clinic = await Clinic.findOne({ ownerId: userId }).lean();
  return clinic ? clinic._id.toString() : null;
}

// Helper: get user patients for dropdown
async function getUserPatients(userId, clinicId) {
  const filter = { userId };
  if (clinicId) filter.clinicId = clinicId;
  return await patient.find(filter).sort({ name: 1 }).lean();
}

// GET all medicines with search/filter
router.get("/", requireAuth, async (req, res) => {
  try {
    let { clinicId, q, category, lowStock, expiring } = req.query;
    const userId = req.user._id;

    if (!clinicId) {
      clinicId = await getUserClinic(userId);
    }

    if (!clinicId) {
      return res.render("medicine/index", {
        medicines: [],
        error: "No clinic found. Please create a clinic first.",
        q: "",
        category: "",
        lowStock: false,
        expiring: false,
      });
    }

    const clinic = await Clinic.findById(clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res
        .status(403)
        .render("error", { message: "Unauthorized access to clinic" });
    }

    const filter = { clinicId, isActive: true };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { manufacturer: { $regex: q, $options: "i" } },
        { batchNumber: { $regex: q, $options: "i" } },
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (lowStock === "true") {
      filter.$or = [
        { stock: { $lte: 5 } },
        { stock: { $exists: false } },
        { stock: null },
      ];
    }

    if (expiring === "true") {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      filter.expiryDate = { $lte: thirtyDaysFromNow, $gte: new Date() };
    }

    const medicines = await Medicine.find(filter).lean().sort({ name: 1 });

    // Get distinct categories for filter dropdown
    const categories = await Medicine.distinct("category", { clinicId });

    res.render("medicine/index", {
      medicines,
      clinicId,
      q: q || "",
      category: category || "",
      lowStock: lowStock === "true",
      expiring: expiring === "true",
      categories,
    });
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
      return res.status(400).render("error", {
        message: "No clinic found. Please create a clinic first.",
      });
    }

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
    let {
      name,
      category,
      dosage,
      manufacturer,
      batchNumber,
      expiryDate,
      description,
      stock,
      buyPrice,
      sellPrice,
      clinicId,
    } = req.body;
    const userId = req.user._id;

    name = typeof name === "string" ? name.trim() : "";
    if (!name || name.length < 2) {
      return res.status(400).render("medicine/new", {
        clinicId,
        error: "Medicine name must be at least 2 characters",
      });
    }

    stock = parseInt(stock, 10) || 0;
    buyPrice = parseFloat(buyPrice) || 0;
    sellPrice = parseFloat(sellPrice) || 0;

    if (stock < 0 || buyPrice < 0 || sellPrice < 0) {
      return res.status(400).render("medicine/new", {
        clinicId,
        error: "Stock and prices cannot be negative",
      });
    }

    const clinic = await Clinic.findById(clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    const medicine = new Medicine({
      name,
      category: category || "Tablet",
      dosage,
      manufacturer,
      batchNumber,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      description,
      stock,
      buyPrice,
      sellPrice,
      clinicId,
    });

    await medicine.save();

    // Create initial stock transaction if stock > 0
    if (stock > 0) {
      await StockTransaction.create({
        medicineId: medicine._id,
        clinicId,
        type: "IN",
        quantity: stock,
        previousStock: 0,
        newStock: stock,
        note: "Initial stock",
      });
    }

    res.redirect(`/medicines?clinicId=${clinicId}`);
  } catch (err) {
    console.error("Create medicine error:", err);
    res.status(500).render("medicine/new", {
      clinicId: req.body.clinicId,
      error: "Failed to save medicine. Please try again.",
    });
  }
});

// GET medicine detail
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const medicine = await Medicine.findById(req.params.id).lean();

    if (!medicine) {
      return res.status(404).render("error", { message: "Medicine not found" });
    }

    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    const transactions = await StockTransaction.find({
      medicineId: medicine._id,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Manually lookup patient names for transactions
    const patientIds = transactions
      .map((tx) => tx.patientId)
      .filter((id) => id);
    const patients = await patient
      .find({ _id: { $in: patientIds } })
      .select("name")
      .lean();
    const patientMap = {};
    patients.forEach((p) => (patientMap[p._id.toString()] = p.name));

    transactions.forEach((tx) => {
      if (tx.patientId) {
        tx.patientName = patientMap[tx.patientId.toString()] || "Unknown";
      }
    });

    res.render("medicine/detail", { medicine, transactions });
  } catch (err) {
    console.error("Medicine detail error:", err);
    res
      .status(500)
      .render("error", { message: "Unable to load medicine details" });
  }
});

// GET edit medicine form
router.get("/:id/edit", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const medicine = await Medicine.findById(req.params.id).lean();

    if (!medicine) {
      return res.status(404).render("error", { message: "Medicine not found" });
    }

    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    res.render("medicine/edit", { medicine });
  } catch (err) {
    console.error("Edit medicine form error:", err);
    res.status(500).render("error", { message: "Unable to load form" });
  }
});

// POST update medicine details
router.post("/:id/edit", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      name,
      category,
      dosage,
      manufacturer,
      batchNumber,
      expiryDate,
      description,
      buyPrice,
      sellPrice,
    } = req.body;

    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).render("error", { message: "Medicine not found" });
    }

    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    medicine.name = name?.trim();
    medicine.category = category || "Tablet";
    medicine.dosage = dosage?.trim();
    medicine.manufacturer = manufacturer?.trim();
    medicine.batchNumber = batchNumber?.trim();
    medicine.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
    medicine.description = description?.trim();
    medicine.buyPrice = parseFloat(buyPrice) || 0;
    medicine.sellPrice = parseFloat(sellPrice) || 0;

    await medicine.save();

    res.redirect(`/medicines/${medicine._id}`);
  } catch (err) {
    console.error("Edit medicine error:", err);
    res.status(500).render("error", { message: "Failed to update medicine" });
  }
});

// POST soft delete medicine
router.post("/:id/delete", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).render("error", { message: "Medicine not found" });
    }

    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    medicine.isActive = false;
    await medicine.save();

    res.redirect(`/medicines?clinicId=${medicine.clinicId}`);
  } catch (err) {
    console.error("Delete medicine error:", err);
    res.status(500).render("error", { message: "Failed to delete medicine" });
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

    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    const previousStock = medicine.stock;
    medicine.stock += 1;
    await medicine.save();

    await StockTransaction.create({
      medicineId: medicine._id,
      clinicId: medicine.clinicId,
      type: "IN",
      quantity: 1,
      previousStock,
      newStock: medicine.stock,
      note: "Quick add (+1)",
    });

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

    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    if (medicine.stock > 0) {
      const previousStock = medicine.stock;
      medicine.stock -= 1;
      await medicine.save();

      await StockTransaction.create({
        medicineId: medicine._id,
        clinicId: medicine.clinicId,
        type: "OUT",
        quantity: 1,
        previousStock,
        newStock: medicine.stock,
        note: "Quick remove (-1)",
      });
    }

    res.redirect(`/medicines?clinicId=${medicine.clinicId}`);
  } catch (err) {
    console.error("Remove stock error:", err);
    res.status(500).render("error", { message: "Unable to update stock" });
  }
});

// GET update stock form
router.get("/:id/update", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const medicine = await Medicine.findById(req.params.id).lean();

    if (!medicine) {
      return res.status(404).render("error", { message: "Medicine not found" });
    }

    const clinic = await Clinic.findById(medicine.clinicId).lean();
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).render("error", { message: "Unauthorized" });
    }

    const patients = await getUserPatients(userId, medicine.clinicId);

    res.render("medicine/update", { medicine, patients });
  } catch (err) {
    console.error("Update stock form error:", err);
    res.status(500).render("error", { message: "Unable to load form" });
  }
});

// POST update stock
router.post("/:id/update", requireAuth, async (req, res) => {
  try {
    const { type, quantity, note, patientId } = req.body;
    const userId = req.user._id;

    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).send("Medicine not found");
    }

    const clinic = await Clinic.findById(medicine.clinicId);
    if (!clinic || clinic.ownerId.toString() !== userId.toString()) {
      return res.status(403).send("Unauthorized");
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).send("Invalid quantity");
    }

    const previousStock = medicine.stock;

    if (type === "IN") {
      medicine.stock += qty;
    } else {
      if (medicine.stock < qty) {
        return res.status(400).send("Not enough stock");
      }
      medicine.stock -= qty;
    }

    await medicine.save();

    await StockTransaction.create({
      medicineId: medicine._id,
      clinicId: medicine.clinicId,
      patientId: patientId || undefined,
      type,
      quantity: qty,
      previousStock,
      newStock: medicine.stock,
      note,
    });

    res.redirect(`/medicines?clinicId=${medicine.clinicId}`);
  } catch (err) {
    console.error("Update stock error:", err);
    res.status(500).send(err.message);
  }
});

export default router;
