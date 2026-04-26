import mongoose from "mongoose";

const Schema = mongoose.Schema;

const MedicineSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  category: {
    type: String,
    trim: true,
    default: "Tablet",
  },

  dosage: {
    type: String,
    trim: true,
  },

  manufacturer: {
    type: String,
    trim: true,
  },

  batchNumber: {
    type: String,
    trim: true,
  },

  expiryDate: {
    type: Date,
  },

  description: {
    type: String,
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

  isActive: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  patientId: {
    type: Schema.Types.ObjectId,
    ref: "Patient",
  },
});

// Index for faster queries
MedicineSchema.index({ clinicId: 1, name: 1 });

const Medicine = mongoose.model("Medicine", MedicineSchema);

export default Medicine;
