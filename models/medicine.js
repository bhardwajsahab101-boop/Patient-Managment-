import mongoose from "mongoose";

const Schema = mongoose.Schema;

const MedicineSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  stock: {
    type: Number,
    default: 0,
    min: 0,
  },

  buyPrice: {
    type: Number,
    min: 0,
  },

  sellPrice: {
    type: Number,
    min: 0,
  },

  clinicId: {
    type: Schema.Types.ObjectId,
    ref: "Clinic",
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
MedicineSchema.index({ clinicId: 1, name: 1 });

const Medicine = mongoose.model("Medicine", MedicineSchema);

export default Medicine;