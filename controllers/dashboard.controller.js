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

    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const baseFilter = { userId };

    const [
      totalPatients,
      followupsTodayTomorrow,
      followupsOverdue,
      recentPatients,
      urgentPatients,
      revenueResult,
      todaysVisits,
      weeklyNewPatients,
      genderStats,
      monthlyRevenueResult,
      lastWeekPatients,
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
      // Today's visits (patients with nextVisit today)
      patient.countDocuments({
        ...baseFilter,
        nextVisit: { $gte: today, $lt: tomorrow },
      }),
      // New patients this week
      patient.countDocuments({
        ...baseFilter,
        createdAt: { $gte: weekAgo },
      }),
      // Gender distribution
      patient.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: "$gender",
            count: { $sum: 1 },
          },
        },
      ]),
      // Monthly revenue
      patient.aggregate([
        { $match: baseFilter },
        { $unwind: "$visits" },
        {
          $match: {
            "visits.date": { $gte: monthStart },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$visits.price" },
          },
        },
      ]),
      // Patients added last week (for trend)
      patient.countDocuments({
        ...baseFilter,
        createdAt: {
          $gte: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
          $lt: weekAgo,
        },
      }),
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;
    const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;

    // Format gender stats
    const genderMap = { Male: 0, Female: 0, Other: 0 };
    genderStats.forEach((g) => {
      if (g._id) genderMap[g._id] = g.count;
    });
    const totalGender =
      genderMap.Male + genderMap.Female + genderMap.Other || 1;

    const genderPercentages = {
      Male: Math.round((genderMap.Male / totalGender) * 100),
      Female: Math.round((genderMap.Female / totalGender) * 100),
      Other: Math.round((genderMap.Other / totalGender) * 100),
    };

    // Weekly trend
    const weeklyTrend = weeklyNewPatients >= lastWeekPatients ? "up" : "down";
    const weeklyTrendPercent =
      lastWeekPatients > 0
        ? Math.round(
            ((weeklyNewPatients - lastWeekPatients) / lastWeekPatients) * 100,
          )
        : weeklyNewPatients > 0
          ? 100
          : 0;

    res.render("Dashboard", {
      stats: {
        totalPatients,
        followupsTodayTomorrow,
        followupsOverdue,
        totalRevenue: totalRevenue.toLocaleString(),
        todaysVisits,
        weeklyNewPatients,
        monthlyRevenue: monthlyRevenue.toLocaleString(),
        weeklyTrend,
        weeklyTrendPercent,
      },
      genderStats: genderPercentages,
      genderCounts: genderMap,
      recentPatients,
      urgentPatients,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).render("error", { message: "Dashboard unavailable" });
  }
}
