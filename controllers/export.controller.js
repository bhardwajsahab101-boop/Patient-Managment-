import { patient } from "../models/patient.js";
import Medicine from "../models/medicine.js";
import * as archiver from "archiver";
import { PassThrough } from "stream";



// wait let me tell you what i want to give a right to doctor/owner so he or she can declair there staff member and make a saperate page for them where they can manage all the things regarding staff member perfoming actions like adding new member removing and much more and also i want to make then capable to manage staf sallery with my app 
const archiverFn = archiver.default || archiver;

const toObjectIdString = (id) => (id ? String(id) : null);

function buildExportPayload({ clinic, patients, medicines }) {
  return {
    clinic: {
      id: clinic._id,
      name: clinic.name,
      location: clinic.location,
      phone: clinic.phone,
      address: clinic.address,
      doctorName: clinic.doctorName,
    },
    exportedAt: new Date().toISOString(),
    patients,
    medicines,
  };
}

async function loadClinicAndData(req) {
  const userId = req.user._id;
  const clinicId = toObjectIdString(req.clinicContext?.clinicId);
  if (!clinicId) throw new Error("Clinic not found in context");

  const Clinic = (await import("../models/clinic.js")).default;
  const clinic = await Clinic.findOne({ _id: clinicId, ownerId: userId }).lean();
  if (!clinic) throw new Error("Clinic not found or not owned");

  const [patients, medicines] = await Promise.all([
    patient.find({ clinicId: clinic._id }).sort({ createdAt: -1 }).lean(),
    Medicine.find({ clinicId: clinic._id, isActive: true }).lean(),
  ]);

  return { clinic, patients, medicines };
}

// MVP JSON export (existing endpoint)
export const exportClinicData = async (req, res) => {
  try {
    const { clinic, patients, medicines } = await loadClinicAndData(req);
    const payload = buildExportPayload({ clinic, patients, medicines });

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=dentacore-export-${clinic._id}.json`,
    );
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error("exportClinicData error:", err);
    return res.status(500).send("Export failed");
  }
};

// Better ZIP export: clinic-backup.zip containing JSON files
// - patients.json
// - medicines.json
// - clinic.json
export const exportClinicBackupZip = async (req, res) => {
  try {
    const { clinic, patients, medicines } = await loadClinicAndData(req);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=clinic-backup-${clinic._id}.zip`,
    );

    const archive = archiverFn("zip", { zlib: { level: 9 } });

    // Pipe ZIP stream to response
    archive.pipe(res);

    // Separate JSON files for long-term compatibility
    archive.append(JSON.stringify({ ...clinic, _id: clinic._id }, null, 2), {
      name: "clinic.json",
    });
    archive.append(JSON.stringify(patients, null, 2), { name: "patients.json" });
    archive.append(JSON.stringify(medicines, null, 2), { name: "medicines.json" });

    await archive.finalize();

    return;
  } catch (err) {
    console.error("exportClinicBackupZip error:", err);
    if (!res.headersSent) return res.status(500).send("Backup export failed");
    return;
  }
};
