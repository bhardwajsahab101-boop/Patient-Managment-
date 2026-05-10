import Clinic from "../models/clinic.js";
import User from "../models/User.js";
import ClinicMember from "../models/ClinicMember.js";

// Helper: Get user's clinic (owner’s clinic)
async function getUserClinic(userId) {
  return await Clinic.findOne({ ownerId: userId });
}

// Helper: upsert clinic member by phone
async function upsertClinicMemberByPhone({ ownerId, phone }) {
  const clinic = await getUserClinic(ownerId);
  if (!clinic) throw new Error("Clinic not found");

  const memberUser = await User.findOne({ phone }).lean();
  if (!memberUser) throw new Error("User with this phone not found");

  const existingMember = await ClinicMember.findOne({
    clinicId: clinic._id,
    userId: memberUser._id,
  });

  if (existingMember) return { member: existingMember, created: false };

  const member = await ClinicMember.create({
    clinicId: clinic._id,
    userId: memberUser._id,
    role: "ownerstaff",
  });

  return { member, created: true };
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

// POST /settings/clinic/members — declare/attach clinic member by phone (owner only)
export const declareClinicMember = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { phone, staffPassword } = req.body;

    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ error: "Phone is required" });
    }

    const sanitized = phone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(sanitized)) {
      return res
        .status(400)
        .json({ error: "Enter a valid 10-digit phone number" });
    }

    // doctor must provide staff password for login
    if (!staffPassword || typeof staffPassword !== "string") {
      return res.status(400).json({ error: "Staff password is required" });
    }

    const { member, created } = await upsertClinicMemberByPhone({
      ownerId,
      phone: sanitized,
    });

    // If user existed already, we still require password set/update.
    // Update password only if we created a new user OR user exists but has different password.
    // Phase 1 simplest: always update password for the member's user record.
    const bcrypt = (await import("bcrypt")).default;
    const hashedPassword = await bcrypt.hash(staffPassword, 10);
    await (
      await import("../models/User.js")
    ).default.findOneAndUpdate(
      { phone: sanitized },
      { $set: { password: hashedPassword, isActive: true, role: "doctor" } },
      { new: true },
    );

    res.json({
      success: true,
      message: created
        ? "Member declared successfully"
        : "Member already exists (password updated)",
      member: {
        id: member._id,
        clinicId: String(member.clinicId),
        userId: String(member.userId),
        role: member.role,
      },
    });
  } catch (err) {
    console.error("declareClinicMember error:", err);
    res.status(400).json({ error: err.message || "Failed to declare member" });
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

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ error: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const UserModel = await import("../models/User.js");
    const User = UserModel.default;

    const userData = await User.findById(user._id);
    const isMatch = await userData.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

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
    const Plan = (await import("../models/Plan.js")).default;
    const plan = await Plan.findOne({ userId: user._id }).lean();

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
