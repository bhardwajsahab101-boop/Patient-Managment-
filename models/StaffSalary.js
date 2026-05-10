import mongoose from "mongoose";

const { Schema } = mongoose;

const StaffSalarySchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    staffUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Monthly salary in rupees (or your currency unit)
    monthlySalary: {
      type: Number,
      required: true,
      min: 0,
    },

    // Validity range for the monthly salary
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

StaffSalarySchema.index({ clinicId: 1, staffUserId: 1, startDate: -1 });

export default mongoose.model("StaffSalary", StaffSalarySchema);
