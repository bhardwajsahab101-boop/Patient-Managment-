import Medicine from "../models/medicine.js";
import * as archiver from "archiver";
import { Readable } from "stream";

import { patient } from "../models/patient.js";

const archiverFn = archiver.default || archiver;

const toObjectIdString = (id) => (id ? String(id) : null);

const MAX_EXPORT_PATIENTS = 20000;
const MAX_EXPORT_MEDICINES = 5000;

async function resolveClinicAndOwnership(req) {
  const userId = req.user._id;
  const clinicId = toObjectIdString(req.clinicContext?.clinicId);
  if (!clinicId) throw new Error("Clinic not found in context");

  const Clinic = (await import("../models/clinic.js")).default;
  const clinic = await Clinic.findOne({
    _id: clinicId,
    ownerId: userId,
  }).lean();
  if (!clinic) throw new Error("Clinic not found or not owned");

  return clinic;
}

function jsonArrayFromCursor(cursor) {
  // Stream JSON array: [item1,item2,...] without holding everything in memory.
  let first = true;

  return new Readable({
    async read() {
      try {
        // `cursor.next()` returns a promise.
        const doc = await cursor.next();
        if (!doc) {
          this.push("]\n");
          this.push(null);
          return;
        }

        const chunk = first ? "[\n" : ",\n";
        first = false;
        this.push(chunk);
        this.push(JSON.stringify(doc, null, 2));
      } catch (e) {
        this.destroy(e);
      }
    },
  });
}

async function getPatientsCursor(clinicMongoId) {
  const q = patient
    .find({ clinicId: clinicMongoId })
    .sort({ createdAt: -1 })
    .lean()
    .cursor({ batchSize: 500 });

  // soft limit guard (avoid exporting insane datasets)
  const count = await patient.countDocuments({ clinicId: clinicMongoId });
  if (count > MAX_EXPORT_PATIENTS) {
    throw new Error(
      `Export too large: patients=${count}. Refusing to prevent memory exhaustion.`,
    );
  }

  return q;
}

async function getMedicinesCursor(clinicMongoId) {
  const q = Medicine.find({ clinicId: clinicMongoId, isActive: true })
    .lean()
    .cursor({ batchSize: 500 });

  const count = await Medicine.countDocuments({
    clinicId: clinicMongoId,
    isActive: true,
  });
  if (count > MAX_EXPORT_MEDICINES) {
    throw new Error(
      `Export too large: medicines=${count}. Refusing to prevent memory exhaustion.`,
    );
  }

  return q;
}

export const exportClinicData = async (req, res) => {
  // Memory-safe policy: refuse the big single JSON payload.
  // This endpoint used to build huge JS objects -> heap out of memory.
  return res
    .status(409)
    .send(
      "Large JSON export is disabled to prevent server memory exhaustion. Use ZIP export instead.",
    );
};

// Better ZIP export: clinic-backup.zip containing JSON files
// - patients.json (streamed)
// - medicines.json (streamed)
// - clinic.json (small)
export const exportClinicBackupZip = async (req, res) => {
  try {
    const clinic = await resolveClinicAndOwnership(req);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=clinic-backup-${clinic._id}.zip`,
    );

    const archive = archiverFn("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // Small file can be appended normally.
    archive.append(JSON.stringify({ ...clinic, _id: clinic._id }, null, 2), {
      name: "clinic.json",
    });

    const patientsCursor = await getPatientsCursor(clinic._id);
    const medicinesCursor = await getMedicinesCursor(clinic._id);

    archive.append(jsonArrayFromCursor(patientsCursor), {
      name: "patients.json",
    });
    archive.append(jsonArrayFromCursor(medicinesCursor), {
      name: "medicines.json",
    });

    await archive.finalize();
    return;
  } catch (err) {
    console.error("exportClinicBackupZip error:", err);
    if (!res.headersSent) return res.status(500).send("Backup export failed");
    return;
  }
};
