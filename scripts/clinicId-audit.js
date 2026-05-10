import mongoose from "mongoose";

const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://bhardwajsahab101_db:Ayush%402007@ayush.6fbxsrf.mongodb.net/Fathersahab?retryWrites=true&w=majority";

function safeStringify(v) {
  return JSON.stringify(
    v,
    (_k, val) => {
      if (val && typeof val === "object" && val._bsontype)
        return val.toString();
      return val;
    },
    2,
  );
}

const run = async () => {
  await mongoose.connect(uri, { dbName: "Fathersahab" });
  const col = mongoose.connection.db.collection("patients");

  const missingClinicId = await col.countDocuments({
    clinicId: { $exists: false },
  });
  const nullClinicId = await col.countDocuments({ clinicId: null });

  const typeDist = await col
    .aggregate([
      { $group: { _id: { $type: "$clinicId" }, c: { $sum: 1 } } },
      { $sort: { c: -1 } },
    ])
    .toArray();

  const stringClinicId = await col.countDocuments({
    clinicId: { $type: "string" },
  });
  const objectIdClinicId = await col.countDocuments({
    clinicId: { $type: "objectId" },
  });

  const sampleWithClinicId = await col
    .find({ clinicId: { $exists: true, $ne: null } })
    .limit(1)
    .toArray();

  const sample = sampleWithClinicId[0] || null;
  const sampleClinicId = sample?.clinicId || null;
  const sampleClinicIdStr = sampleClinicId ? String(sampleClinicId) : null;

  let objectIdQueryCount = null;
  let stringQueryCount = null;
  if (sampleClinicIdStr) {
    const ObjectId = mongoose.Types.ObjectId;
    let obj;
    try {
      obj = new ObjectId(sampleClinicIdStr);
    } catch {
      obj = null;
    }

    if (obj) objectIdQueryCount = await col.countDocuments({ clinicId: obj });
    stringQueryCount = await col.countDocuments({
      clinicId: sampleClinicIdStr,
    });
  }

  const topSamples = await col
    .find({ clinicId: { $exists: true, $ne: null } })
    .project({ name: 1, clinicId: 1, userId: 1, createdAt: 1, visits: 1 })
    .limit(3)
    .toArray();

  console.log("=== Patient clinicId audit ===");
  console.log(
    safeStringify({
      counts: {
        missingClinicId,
        nullClinicId,
        clinicIdString: stringClinicId,
        clinicIdObjectId: objectIdClinicId,
      },
      typeDistribution: typeDist,
      samplePatient: sample
        ? {
            _id: sample._id,
            clinicId: sample.clinicId,
            clinicIdAsString: String(sample.clinicId),
            userId: sample.userId,
            createdAt: sample.createdAt,
          }
        : null,
      queryBehaviorSample: sampleClinicIdStr
        ? {
            clinicIdString: sampleClinicIdStr,
            countByObjectId: objectIdQueryCount,
            countByString: stringQueryCount,
          }
        : null,
      topSamples,
    }),
  );

  // Recommend root cause signals based on observed types.
  const hasAnyString = typeDist.some((t) => t._id === "string" && t.c > 0);
  const hasAnyObjectId = typeDist.some((t) => t._id === "objectId" && t.c > 0);

  console.log("=== Root-cause signals ===");
  console.log(
    safeStringify({
      interpretation: {
        missingClinicId,
        nullClinicId,
        hasAnyString,
        hasAnyObjectId,
      },
      likely_causes: [
        ...(missingClinicId > 0 || nullClinicId > 0
          ? [
              "Legacy/migrated patient docs missing clinicId (analytics may go empty for strict clinicId filters)",
            ]
          : []),
        ...(hasAnyString && hasAnyObjectId
          ? [
              "clinicId stored inconsistently (string vs ObjectId) causing $match misses when using the wrong type",
            ]
          : []),
        ...(hasAnyObjectId && !hasAnyString
          ? [
              "clinicId is consistently ObjectId; empty analytics likely due to controller using wrong boundary (userId) or missing clinicContext (clinicId null)",
            ]
          : []),
      ],
      controller_fix_hints: {
        keepClinicIdAsObjectIdInQueries: hasAnyObjectId,
        avoidUserIdAsTenantBoundary: true,
      },
    }),
  );

  await mongoose.disconnect();
};

run().catch((e) => {
  console.error("clinicId-audit failed:", e);
  process.exit(1);
});
