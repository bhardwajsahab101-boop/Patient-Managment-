import mongoose from "mongoose";

const Schema = mongoose.Schema;

const StockTransactionSchema = new Schema({
  medicineId: {
    type: Schema.Types.ObjectId,
    ref: "Medicine",
    required: true,
  },

  clinicId: {
    type: Schema.Types.ObjectId,
    ref: "Clinic",
    required: true,
  },

  patientId: {
    type: Schema.Types.ObjectId,
    ref: "patient",
  },

  type: {
    type: String,
    enum: ["IN", "OUT"], // IN = add, OUT = remove
    required: true,
  },

  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  previousStock: {
    type: Number,
    required: true,
  },

  newStock: {
    type: Number,
    required: true,
  },

  note: {
    type: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 🔥 Important for fast queries later
StockTransactionSchema.index({ medicineId: 1, createdAt: -1 });

const StockTransaction = mongoose.model(
  "StockTransaction",
  StockTransactionSchema,
);

export default StockTransaction;
