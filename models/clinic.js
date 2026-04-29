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
  address: {
    type: String,
  },
  phone: {
    type: String,
    match: [/^\d{10}$/, "Invalid phone number"],
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
