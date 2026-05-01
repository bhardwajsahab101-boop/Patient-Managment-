import Clinic from "../models/clinic.js";
import User from "../models/User.js";

// Helper: Get user's clinic
async function getUserClinic(userId) {
  return await Clinic.findOne({ ownerId: userId });
}

// GET /settings — Main settings page
export const getSettings = async (req, res) => {
  try {
    const user = req.user;
    const clinic = await getUserClinic(user._id);
    
    if (!clinic) {
      return res.redirect("/create-clinic");
    }

    res.render("settings", {
      title: "Settings",
      user,
      clinic,
      currentSection: req.query.section || "clinic",
    });
  } catch (err) {
    console.error("Settings error:", err);
    res.status(500).render("error", { message: "Unable to load settings" });
  }
};

// PUT /settings/clinic — Update clinic details
export const updateClinicDetails = async (req, res) => {
  try {
    const user = req.user;
    const { name, location, address, phone, email, doctorName } = req.body;

    const clinic = await getUserClinic(user._id);
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found" });
    }

    // Update basic details
    if (name) clinic.name = name;
    if (location !== undefined) clinic.location = location;
    if (address !== undefined) clinic.address = address;
    if (phone !== undefined) clinic.phone = phone;
    if (email !== undefined) clinic.email = email;
    if (doctorName !== undefined) clinic.doctorName = doctorName;

    await clinic.save();

    res.json({ success: true, message: "Clinic details updated" });
  } catch (err) {
    console.error("Update clinic error:", err);
    res.status(500).json({ error: "Failed to update clinic details" });
  }
};

// PUT /settings/print — Update print settings
export const updatePrintSettings = async (req, res) => {
  try {
    const user = req.user;
    const {
      showLogo,
      showAddress,
      showSignature,
      showClinicName,
      showNextVisitDate,
      showMedicineInstructions,
      defaultFooterMessage,
      paperSize,
      autoPrint,
    } = req.body;

    const clinic = await getUserClinic(user._id);
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found" });
    }

    // Update print settings
    clinic.printSettings = {
      showLogo: showLogo === "true",
      showAddress: showAddress === "true",
      showSignature: showSignature === "true",
      showClinicName: showClinicName === "true",
      showNextVisitDate: showNextVisitDate === "true",
      showMedicineInstructions: showMedicineInstructions === "true",
      defaultFooterMessage: defaultFooterMessage || "Get well soon!",
      paperSize: paperSize || "A5",
      autoPrint: autoPrint === "true",
    };

    await clinic.save();

    res.json({ success: true, message: "Print settings updated" });
  } catch (err) {
    console.error("Update print settings error:", err);
    res.status(500).json({ error: "Failed to update print settings" });
  }
};

// PUT /settings/notifications — Update notification settings
export const updateNotificationSettings = async (req, res) => {
  try {
    const user = req.user;
    const {
      whatsappReminders,
      appointmentReminderHours,
      followupReminders,
      smsReminders,
    } = req.body;

    const clinic = await getUserClinic(user._id);
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found" });
    }

    // Update notification settings
    clinic.notificationSettings = {
      whatsappReminders: whatsappReminders === "true",
      appointmentReminderHours: parseInt(appointmentReminderHours) || 24,
      followupReminders: followupReminders === "true",
      smsReminders: smsReminders === "true",
    };

    await clinic.save();

    res.json({ success: true, message: "Notification settings updated" });
  } catch (err) {
    console.error("Update notification settings error:", err);
    res.status(500).json({ error: "Failed to update notification settings" });
  }
};

// PUT /settings/inventory — Update inventory settings
export const updateInventorySettings = async (req, res) => {
  try {
    const user = req.user;
    const { lowStockThreshold, expiryAlertDays, autoStockDeduction } = req.body;

    const clinic = await getUserClinic(user._id);
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found" });
    }

    // Update inventory settings
    clinic.inventorySettings = {
      lowStockThreshold: parseInt(lowStockThreshold) || 10,
      expiryAlertDays: parseInt(expiryAlertDays) || 30,
      autoStockDeduction: autoStockDeduction !== "false",
    };

    await clinic.save();

    res.json({ success: true, message: "Inventory settings updated" });
  } catch (err) {
    console.error("Update inventory settings error:", err);
    res.status(500).json({ error: "Failed to update inventory settings" });
  }
};

// PUT /settings/password — Change password
export const changePassword = async (req, res) => {
  try {
    const user = req.user;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Verify current password
    const UserModel = await import("../models/User.js");
    const User = UserModel.default;
    
    const userData = await User.findById(user._id);
    const isMatch = await userData.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Update password
    userData.password = newPassword;
    await userData.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
};

// PUT /settings/logo — Upload clinic logo
export const updateLogo = async (req, res) => {
  try {
    const user = req.user;
    const { logo } = req.body;

    const clinic = await getUserClinic(user._id);
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found" });
    }

    if (logo) {
      clinic.logo = logo;
      await clinic.save();
    }

    res.json({ success: true, message: "Logo updated" });
  } catch (err) {
    console.error("Update logo error:", err);
    res.status(500).json({ error: "Failed to update logo" });
  }
};

// PUT /settings/signature — Upload doctor signature
export const updateSignature = async (req, res) => {
  try {
    const user = req.user;
    const { signature } = req.body;

    const clinic = await getUserClinic(user._id);
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found" });
    }

    if (signature) {
      clinic.signature = signature;
      await clinic.save();
    }

    res.json({ success: true, message: "Signature updated" });
  } catch (err) {
    console.error("Update signature error:", err);
    res.status(500).json({ error: "Failed to update signature" });
  }
};

// GET /settings/data — Get all settings data (API for AJAX)
export const getSettingsData = async (req, res) => {
  try {
    const user = req.user;
    const clinic = await getUserClinic(user._id);

    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found" });
    }

    res.json({
      clinic: {
        name: clinic.name,
        location: clinic.location,
        address: clinic.address,
        phone: clinic.phone,
        email: clinic.email,
        doctorName: clinic.doctorName,
        logo: clinic.logo,
        signature: clinic.signature,
        printSettings: clinic.printSettings,
        notificationSettings: clinic.notificationSettings,
        inventorySettings: clinic.inventorySettings,
        subscriptionStatus: clinic.subscriptionStatus,
        plan: clinic.plan,
        subscriptionEndsAt: clinic.subscriptionEndsAt,
      },
      user: {
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Get settings data error:", err);
    res.status(500).json({ error: "Failed to load settings data" });
  }
};
