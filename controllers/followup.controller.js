import { patient } from "../models/patient.js";

// Helper: resolve clinicId from context
function resolveClinicId(req) {
  return req.clinicContext?.clinicId
    ? String(req.clinicContext.clinicId)
    : null;
}

export async function removeFromFollowup(req, res) {
  try {
    const { id } = req.params;
    const clinicId = resolveClinicId(req);

    const existing = await patient.findOne({ _id: id, clinicId });
    if (!existing) return res.status(404).send("Patient not found");

    await patient.findByIdAndUpdate(id, { nextVisit: null });
    res.redirect(`/followup?clinicId=${clinicId || ""}`);
  } catch (err) {
    console.error("Remove followup error:", err);
    res
      .status(500)
      .render("error", { message: "Failed to remove from follow-ups" });
  }
}

export async function getFollowups(req, res) {
  try {
    const clinicId = resolveClinicId(req);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    function getDateRange(offset) {
      const date = new Date(todayMidnight);
      date.setDate(todayMidnight.getDate() + offset);
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    const yesterdayRange = getDateRange(-1);
    const todayRange = getDateRange(0);
    const tomorrowRange = getDateRange(1);

    const baseFilter = {
      clinicId,
      nextVisit: { $gte: yesterdayRange.start, $lte: tomorrowRange.end },
    };

    const followupPatients = await patient
      .find(baseFilter)
      .sort({ nextVisit: 1 })
      .lean();

    const followups = followupPatients
      .map((p) => {
        const nextVisitDate = new Date(p.nextVisit);
        const nextVisitDay = new Date(nextVisitDate);
        nextVisitDay.setHours(0, 0, 0, 0);
        const todayDay = new Date(todayMidnight);
        let status =
          nextVisitDay < todayDay
            ? "overdue"
            : nextVisitDay.toDateString() === todayDay.toDateString()
              ? "today"
              : "tomorrow";
        return { patient: p, nextVisit: nextVisitDate, status };
      })
      .sort((a, b) => {
        const priority = { overdue: 0, today: 1, tomorrow: 2 };
        return (
          priority[a.status] - priority[b.status] || a.nextVisit - b.nextVisit
        );
      });

    const [
      totalPatients,
      overdueCount,
      todayCount,
      tomorrowCount,
      followupRevenue,
    ] = await Promise.all([
      patient.countDocuments({ clinicId }),
      patient.countDocuments({
        clinicId,
        nextVisit: { $lt: todayRange.start },
      }),
      patient.countDocuments({
        clinicId,
        nextVisit: {
          $gte: todayRange.start,
          $lte: todayRange.end,
        },
      }),
      patient.countDocuments({
        clinicId,
        nextVisit: {
          $gte: tomorrowRange.start,
          $lte: tomorrowRange.end,
        },
      }),
      patient.aggregate([
        { $match: { clinicId } },
        { $unwind: "$visits" },
        {
          $match: {
            nextVisit: { $gte: yesterdayRange.start, $lte: tomorrowRange.end },
          },
        },
        { $group: { _id: null, total: { $sum: "$visits.price" } } },
      ]),
    ]);

    res.render("followup", {
      followups,
      stats: {
        totalPatients,
        overdueCount,
        todayCount,
        tomorrowCount,
        followupRevenue: followupRevenue[0]?.total || 0,
      },
    });
  } catch (err) {
    console.error("Followup error:", err);
    res
      .status(500)
      .render("error", { message: "Server error loading followups" });
  }
}
