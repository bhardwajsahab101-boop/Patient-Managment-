import mongoose from "mongoose";

const Schema = mongoose.Schema;

const PatientData = new Schema({
  name: {
    type: String,
    required: true,
  },

  age: {
    type: Number,
    min: 0,
    max: 120,
  },

  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
  },

  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{10}$/, "Enter valid 10-digit phone number"],
  },

  address: {
    type: String,
    trim: true,
    maxlength: 500,
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  clinicId: {
    type: Schema.Types.ObjectId,
    ref: "Clinic",
    required: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  nextVisit: {
    type: Date,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  // Payment tracking fields
  totalPayment: {
    type: Number,
    default: 0,
    min: 0,
  },

  paidPayment: {
    type: Number,
    default: 0,
    min: 0,
  },

  pendingPayment: {
    type: Number,
    default: 0,
  },

  paymentStatus: {
    type: String,
    enum: ["Paid", "Pending", "Partial"],
    default: "Paid",
  },

  visits: [
    {
      date: { type: Date, default: Date.now },

      notes: String,

      price: {
        type: Number,
        min: 0,
      },

      // Per-visit payment tracking
      paidAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      paymentDate: {
        type: Date,
      },

      paymentMethod: {
        type: String,
        enum: ["Cash", "Card", "UPI", "Online", "Other"],
      },

      nextVisit: Date,

      medicines: [
        {
          medicineId: { type: Schema.Types.ObjectId, ref: "Medicine" },
          name: String,
          dosage: String,
          quantity: { type: Number, default: 1 },
          duration: String,
          instructions: String,
        },
      ],
    },
  ],
});

const patient = mongoose.model("patient", PatientData);

// Indexes for faster queries
PatientData.index({ userId: 1, clinicId: 1 });
PatientData.index({ userId: 1, clinicId: 1, nextVisit: 1 });
PatientData.index({ userId: 1, phone: 1 });
PatientData.index({ userId: 1, nextVisit: 1, isActive: 1 });
PatientData.index({ userId: 1, createdAt: -1 });

export { patient };
