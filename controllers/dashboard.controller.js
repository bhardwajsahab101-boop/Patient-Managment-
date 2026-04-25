import { patient } from "../models/patient.js";

export async function getDashboard(req, res) {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const baseFilter = { userId };

    const [
      totalPatients,
      followupsTodayTomorrow,
      followupsOverdue,
      recentPatients,
      urgentPatients,
      revenueResult,
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
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    res.render("Dashboard", {
      stats: {
        totalPatients,
        followupsTodayTomorrow,
        followupsOverdue,
        totalRevenue: totalRevenue.toLocaleString(),
      },
      recentPatients,
      urgentPatients,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).render("error", { message: "Dashboard unavailable" });
  }
}
