import ClinicMember from "../models/ClinicMember.js";
import User from "../models/User.js";
import Clinic from "../models/clinic.js";

function getClinicId(req) {
  return req?.clinicContext?.clinicId
    ? String(req.clinicContext.clinicId)
    : null;
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== "string") return null;
  const sanitized = phone.replace(/\D/g, "");
  if (!/^\d{10}$/.test(sanitized)) return null;
  return sanitized;
}

async function getClinicForOwner(req) {
  const clinicId = getClinicId(req);
  if (!clinicId) return null;
  return await Clinic.findOne({ _id: clinicId, ownerId: req.user._id }).lean();
}

// GET /staff
export async function staffDashboard(req, res) {
  try {
    const clinicId = getClinicId(req);
    const clinic = await Clinic.findById(clinicId).lean();

    const members = await ClinicMember.find({
      clinicId,
    })
      .populate("userId", "name phone role")
      .lean();

    const safeMembers = members
      .map((m) => {
        return {
          id: m._id,
          userId: m.userId?._id,
          name: m.userId?.name || "",
          phone: m.userId?.phone || "",
          role: m.role,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.render("staff", {
      title: "Staff",
      clinic,
      members: safeMembers,
      error: null,
    });
  } catch (err) {
    console.error("staffDashboard error:", err);
    res.status(500).render("error", { message: "Unable to load staff" });
  }
}

// GET /staff/members
export async function listMembers(req, res) {
  try {
    const clinicId = getClinicId(req);
    const members = await ClinicMember.find({ clinicId })
      .populate("userId", "name phone role")
      .lean();

    res.json({
      success: true,
      members: members.map((m) => ({
        id: m._id,
        userId: m.userId?._id,
        name: m.userId?.name || "",
        phone: m.userId?.phone || "",
        role: m.role,
      })),
    });
  } catch (err) {
    console.error("listMembers error:", err);
    res.status(500).json({ success: false, error: "Failed to list members" });
  }
}

// POST /staff/members
// Phase 1: add staff by phone (owner only, via requireOwnerClinic)
export async function addMemberByPhone(req, res) {
  try {
    const phone = normalizePhone(req.body?.phone);
    const name = (req.body?.name || "").toString().trim();
    const staffPassword = req.body?.staffPassword;

    if (!phone) {
      return res
        .status(400)
        .json({ error: "Enter a valid 10-digit phone number" });
    }

    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Enter staff name" });
    }

    if (!staffPassword || typeof staffPassword !== "string") {
      return res.status(400).json({ error: "Staff password is required" });
    }

    const clinic = await getClinicForOwner(req);
    if (!clinic) return res.status(403).json({ error: "Forbidden" });

    // Owner should NOT convert an admin account into staff.
    const existingUserAdmin = await User.findOne({
      phone,
      role: "admin",
    }).lean();
    if (existingUserAdmin) {
      return res
        .status(403)
        .json({ error: "Cannot add admin account as staff" });
    }

    // If user exists => attach.
    let memberUser = await User.findOne({ phone }).lean();

    // If user doesn't exist => create user then attach (per your requirement)
    if (!memberUser) {
      // This app's auth expects a hashed password during signup flow.
      // For Phase 1 management, we create the user with a temp password.
      const bcrypt = (await import("bcrypt")).default;
      const hashedPassword = await bcrypt.hash(staffPassword, 10);

      memberUser = await User.create({
        name,
        phone,
        password: hashedPassword,
        role: "doctor",
        isActive: true,
      });

      memberUser = memberUser?.toObject ? memberUser.toObject() : memberUser;
    }

    const existing = await ClinicMember.findOne({
      clinicId: clinic._id,
      userId: memberUser._id,
    }).lean();

    if (existing) {
      return res.json({
        success: true,
        message: "Member already exists",
        member: {
          id: existing._id,
          userId: existing.userId,
          role: existing.role,
        },
      });
    }

    const member = await ClinicMember.create({
      clinicId: clinic._id,
      userId: memberUser._id,
      role: "ownerstaff",
    });

    res.json({
      success: true,
      message: "Member declared successfully",
      member: {
        id: member._id,
        userId: member.userId,
        role: member.role,
      },
    });
  } catch (err) {
    console.error("addMemberByPhone error:", err);
    res.status(400).json({ error: err.message || "Failed to add member" });
  }
}

// POST /staff/members/:userId/remove
export async function removeMember(req, res) {
  try {
    const clinicId = getClinicId(req);
    const { userId } = req.params;

    if (!userId) return res.status(400).json({ error: "Invalid user" });

    const clinic = await Clinic.findOne({
      _id: clinicId,
      ownerId: req.user._id,
    }).lean();
    if (!clinic) return res.status(403).json({ error: "Forbidden" });

    const member = await ClinicMember.findOne({ clinicId, userId }).lean();
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Phase 1 restriction: owner can never remove himself
    if (String(member.userId) === String(req.user._id)) {
      return res.status(400).json({ error: "You cannot remove yourself" });
    }

    await ClinicMember.findOneAndDelete({ _id: member._id });

    res.json({ success: true, message: "Member removed" });
  } catch (err) {
    console.error("removeMember error:", err);
    res.status(500).json({ error: "Failed to remove member" });
  }
}
