/*
  Temporary utility for analytics tenant isolation audit.
  Not used by runtime.

  Verifies how the app-derived clinicId (from query string / context) behaves
  when matched against patient.clinicId (ObjectId).
*/

import mongoose from "mongoose";

const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://bhardwajsahab101_db:Ayush%402007@ayush.6fbxsrf.mongodb.net/Fathersahab?retryWrites=true&w=majority";

const run = async () => {
  await mongoose.connect(uri);

  const patients = mongoose.connection.db.collection("patients");

  // Find one clinicId value in DB
  const sample = await patients
    .find({ clinicId: { $exists: true, $ne: null } })
    .project({ clinicId: 1 })
    .limit(1)
    .toArray();

  if (!sample[0]) {
    console.log("No sample patient found");
    return;
  }

  const clinicIdObj = sample[0].clinicId;
  const clinicIdStr = String(clinicIdObj);

  const countObjectId = await patients.countDocuments({
    clinicId: clinicIdObj,
  });
  const countString = await patients.countDocuments({ clinicId: clinicIdStr });
  const countNewObjectId = await patients.countDocuments({
    clinicId: new mongoose.Types.ObjectId(clinicIdStr),
  });

  console.log(
    JSON.stringify(
      {
        sampleClinicId: clinicIdObj,
        sampleClinicIdAsString: clinicIdStr,
        counts: {
          objectIdQuery: countObjectId,
          stringQuery: countString,
          objectIdCastQuery: countNewObjectId,
        },
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
