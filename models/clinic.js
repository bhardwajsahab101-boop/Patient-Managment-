import mongoose from "mongoose";

const Schema = mongoose.Schema;

const ClinicSchema = new Schema({
  name: {
    type: String,
    required: true,
  },

  location: {
    type: String,
  },

  ownerId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Clinic = mongoose.model("Clinic", ClinicSchema);
export default Clinic;