import { patient } from "../models/patient.js";
import Clinic from "../models/clinic.js";

export async function getMessage(req, res) {
  try {
    const patientData = await patient
      .findOne({
        _id: req.params.id,
        userId: req.user._id,
      })
      .lean();

    if (!patientData) return res.status(404).send("Patient not found");

    // Get user's clinic
    const userClinic = await Clinic.findOne({ ownerId: req.user._id }).lean();
const clinicName = userClinic?.name || "DentaCore";

    const latestVisit = patientData.visits.at(-1);
    const nextDate = latestVisit?.nextVisit
      ? new Date(latestVisit.nextVisit).toDateString()
      : "not scheduled";

    const message = `Hello ${patientData.name},\nYour next visit is on ${nextDate}.\nPlease visit the clinic on time.\n\n- ${clinicName}`;

    const encodedMessage = encodeURIComponent(message);
    const phone = `91${patientData.phone}`;
    const whatsappURL = `https://wa.me/${phone}?text=${encodedMessage}`;
    const smsURL = `sms:${phone}?body=${encodedMessage}`;

    res.render("message", {
      patient: patientData,
      message,
      whatsappURL,
      smsURL,
      phone,
      nextDate,
      clinicName,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", {
      err: { message: "Unable to load message preview" },
    });
  }
}
