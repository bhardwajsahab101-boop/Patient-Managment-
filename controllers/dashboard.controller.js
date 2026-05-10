import { patient } from "../models/patient.js";
import Medicine from "../models/medicine.js";

export async function getDashboard(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get clinicId from context (supports multi-clinic for Pro users)
    const clinicId = req.clinicContext?.clinicId
      ? String(req.clinicContext.clinicId)
      : null;

    const baseFilter = { clinicId };

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const [
      totalPatients,
      followupsTodayTomorrow,
      followupsOverdue,
      recentPatients,
      urgentPatients,
      revenueResult,
      totalMedicines,
      lowStockMedicines,
      expiringMedicines,
    ] = await Promise.all([
      patient.countDocuments(baseFilter),
      patient.countDocuments({
        ...baseFilter,
        nextVisit: { $gte: yesterday, $lte: tomorrow },
      }),
      patient.countDocuments({
        ...baseFilter,
        nextVisit: { $lt: today },
      }),
      patient.find(baseFilter).sort({ createdAt: -1 }).limit(5).lean(),
      patient
        .find({
          ...baseFilter,
          nextVisit: { $lte: today },
        })
        .sort({ nextVisit: 1 })
        .limit(5)
        .lean(),
      patient.aggregate([
        { $match: baseFilter },
        { $unwind: "$visits" },
        {
          $group: {
            _id: null,
            total: { $sum: "$visits.price" },
          },
        },
      ]),
      clinicId ? Medicine.countDocuments({ clinicId, isActive: true }) : 0,
      clinicId
        ? Medicine.countDocuments({
            clinicId,
            isActive: true,
            $or: [
              { stock: { $lte: 5 } },
              { stock: { $exists: false } },
              { stock: null },
            ],
          })
        : 0,
      clinicId
        ? Medicine.countDocuments({
            clinicId,
            isActive: true,
            expiryDate: { $lte: thirtyDaysFromNow, $gte: today },
          })
        : 0,
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    res.render("Dashboard", {
      stats: {
        totalPatients,
        followupsTodayTomorrow,
        followupsOverdue,
        totalRevenue: totalRevenue.toLocaleString(),
        totalMedicines,
        lowStockMedicines,
        expiringMedicines,
      },
      recentPatients,
      urgentPatients,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).render("error", { message: "Dashboard unavailable" });
  }
}
