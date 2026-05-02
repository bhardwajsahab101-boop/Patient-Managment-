import { patient } from "../models/patient.js";

export async function getReports(req, res) {
  try {
    const userId = req.user._id;
    const { from, to } = req.query;

    // Default date range: all time if not specified
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    // Normalize dates to local full-day boundaries if provided
    if (fromDate) {
      fromDate.setHours(0, 0, 0, 0);
    }
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    const userMatch = { userId };
    let match = userMatch;
    if (fromDate && toDate) {
      match = {
        ...userMatch,
        "visits.date": { $gte: fromDate, $lte: toDate },
      };
    }

    const [
      totalPatients,
      totalVisitsAgg,
      revenueAgg,
      overdueCount,
      revenueChart,
      topPatientsAgg,
    ] = await Promise.all([
      patient.countDocuments(userMatch),
      patient.aggregate([
        { $match: userMatch },
        { $unwind: "$visits" },
        ...(fromDate && toDate
          ? [{ $match: { "visits.date": { $gte: fromDate, $lte: toDate } } }]
          : []),
        { $count: "count" },
      ]),
      patient.aggregate([
        { $match: userMatch },
        { $unwind: "$visits" },
        ...(fromDate && toDate
          ? [{ $match: { "visits.date": { $gte: fromDate, $lte: toDate } } }]
          : []),
        {
          $group: {
            _id: null,
            total: { $sum: "$visits.price" },
          },
        },
      ]),
      patient.countDocuments({
        ...userMatch,
        nextVisit: { $lt: new Date() },
      }),
      patient.aggregate([
        { $match: userMatch },
        { $unwind: "$visits" },
        ...(fromDate && toDate
          ? [{ $match: { "visits.date": { $gte: fromDate, $lte: toDate } } }]
          : []),
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$visits.date",
              },
            },
            total: { $sum: "$visits.price" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      patient.aggregate([
        { $match: userMatch },
        { $unwind: "$visits" },
        ...(fromDate && toDate
          ? [{ $match: { "visits.date": { $gte: fromDate, $lte: toDate } } }]
          : []),
        {
          $group: {
            _id: "$_id",
            name: { $first: "$name" },
            visitCount: { $sum: 1 },
            totalSpend: { $sum: "$visits.price" },
          },
        },
        { $sort: { totalSpend: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const totalVisits = totalVisitsAgg[0]?.count || 0;
    const totalRevenue = revenueAgg[0]?.total || 0;

    // Growth calculation: compare current period vs previous same-length period
    let growth = 0;
    if (fromDate && toDate) {
      const periodLength = toDate.getTime() - fromDate.getTime();
      const lastPeriodFrom = new Date(fromDate.getTime() - periodLength);
      const lastPeriodTo = new Date(fromDate.getTime() - 1);

      const lastRevenueAgg = await patient.aggregate([
        { $match: userMatch },
        { $unwind: "$visits" },
        {
          $match: {
            "visits.date": {
              $gte: lastPeriodFrom,
              $lte: lastPeriodTo,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$visits.price" },
          },
        },
      ]);
      const lastRevenue = lastRevenueAgg[0]?.total || 0;
      growth =
        lastRevenue === 0
          ? 0
          : ((totalRevenue - lastRevenue) / lastRevenue) * 100;
    }

    // Fill missing dates in revenueChart with 0 revenue for continuous chart
    const filledRevenueChart = fillMissingDates(revenueChart, fromDate, toDate);

    res.render("reports", {
      stats: {
        totalPatients,
        totalVisits,
        totalRevenue,
        overdueCount,
        revenueChart: filledRevenueChart,
        growth: Math.round(growth),
        topPatients: topPatientsAgg || [],
      },
      filters: {
        from: from || "",
        to: to || "",
      },
    });
  } catch (err) {
    console.error("Reports error:", err);

    res.render("reports", {
      stats: {
        totalPatients: 0,
        totalVisits: 0,
        totalRevenue: 0,
        overdueCount: 0,
        revenueChart: [],
        growth: 0,
        topPatients: [],
      },
      filters: { from: "", to: "" },
    });
  }
}

/**
 * Fill missing dates between from and to with 0 revenue entries
 * so the Chart.js line chart shows a continuous timeline.
 */
function fillMissingDates(data, fromDate, toDate) {
  if (!data || data.length === 0) return data;

  const result = [];
  const dateMap = new Map();
  data.forEach((d) => dateMap.set(d._id, d.total));

  let current, end;
  if (fromDate && toDate) {
    current = new Date(fromDate);
    end = new Date(toDate);
  } else {
    // For all time, find min and max dates from data
    const dates = data.map((d) => new Date(d._id)).sort((a, b) => a - b);
    current = dates[0];
    end = dates[dates.length - 1];
  }

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    result.push({
      _id: dateStr,
      total: dateMap.get(dateStr) || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}
