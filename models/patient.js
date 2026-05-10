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
    required: false,
    trim: true,
    validate: {
      validator: function (v) {
        // Allow empty/undefined when phone is optional
        if (v === undefined || v === null) return true;
        const trimmed = String(v).trim();
        if (trimmed === "") return true;
        return /^\d{10}$/.test(trimmed);
      },
      message: "Enter valid 10-digit phone number",
    },
  },

  address: {
    type: String,
    trim: true,
    maxlength: 500,
  },

  // NOTE: clinicId is the isolation boundary (multi-tenant) for patients.
  // userId is kept for backward compatibility and auditing, but it is not
  // the primary isolation key anymore.
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: false,
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
PatientData.index({ clinicId: 1, createdAt: -1 });
PatientData.index({ clinicId: 1, nextVisit: 1 });
PatientData.index({ clinicId: 1, phone: 1 });
PatientData.index({ clinicId: 1, nextVisit: 1, isActive: 1 });
PatientData.index({ userId: 1, createdAt: -1 });

export { patient };
