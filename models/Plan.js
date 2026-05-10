import mongoose from "mongoose";

const { Schema } = mongoose;

const PlanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },

    plan: {
      type: String,
      enum: ["starter", "pro"],
      default: "starter",
      index: true,
    },

    trialEndsAt: { type: Date },
    subscriptionEndsAt: { type: Date },

    status: {
      type: String,
      enum: ["active", "expired", "pending"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Plan", PlanSchema);
