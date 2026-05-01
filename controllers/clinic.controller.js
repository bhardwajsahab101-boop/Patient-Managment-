import Clinic from "../models/clinic.js";

// GET /create-clinic - show form
export async function getCreateClinicForm(req, res) {
  res.render("create-clinic", {
    title: "Create Clinic",
    error: null,
    formData: {},
  });
}

// POST /create-clinic - create clinic for logged-in user
export async function createClinic(req, res) {
  try {
    const { name, location } = req.body;
    const userId = req.user._id;

    if (!name || name.trim().length < 2) {
      return res.status(400).render("create-clinic", {
        title: "Create Clinic",
        error: "Clinic name must be at least 2 characters",
        formData: { name, location },
      });
    }

    // Prevent duplicate clinic creation
    const existing = await Clinic.findOne({ ownerId: userId }).lean();
    if (existing) {
      return res.redirect("/dashboard");
    }

    const clinic = new Clinic({
      name: name.trim(),
      location: location?.trim() || "",
      ownerId: userId,
    });

    await clinic.save();

    // ✅ Redirect to dashboard after clinic creation
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Create clinic error:", err);
    res.status(500).render("create-clinic", {
      title: "Create Clinic",
      error: "Failed to create clinic. Please try again.",
      formData: {
        name: req.body?.name || "",
        location: req.body?.location || "",
      },
    });
  }
}
