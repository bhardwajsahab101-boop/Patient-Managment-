import mongoose from "mongoose";

const { Schema } = mongoose;
// he
const ClinicMemberSchema = new Schema(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["ownerstaff", "staff"],
      default: "ownerstaff",
      required: true,
    },
  },
  { timestamps: true },
);

// prevent duplicate memberships
ClinicMemberSchema.index({ clinicId: 1, userId: 1 }, { unique: true });

export default mongoose.model("ClinicMember", ClinicMemberSchema);
