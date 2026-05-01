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

  // Extended clinic details for branding
  email: {
    type: String,
    match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
  },
  doctorName: {
    type: String,
  },
  logo: {
    type: String, // URL or path to clinic logo
  },
  signature: {
    type: String, // URL or path to doctor's signature image
  },

  // Print settings for prescriptions
  printSettings: {
    showLogo: {
      type: Boolean,
      default: true,
    },
    showAddress: {
      type: Boolean,
      default: true,
    },
    showSignature: {
      type: Boolean,
      default: true,
    },
    showClinicName: {
      type: Boolean,
      default: true,
    },
    showNextVisitDate: {
      type: Boolean,
      default: true,
    },
    showMedicineInstructions: {
      type: Boolean,
      default: true,
    },
    defaultFooterMessage: {
      type: String,
      default: "Get well soon!",
    },
    paperSize: {
      type: String,
      enum: ["A4", "A5"],
      default: "A5",
    },
    autoPrint: {
      type: Boolean,
      default: false,
    },
  },

  // Notification settings
  notificationSettings: {
    whatsappReminders: {
      type: Boolean,
      default: true,
    },
    appointmentReminderHours: {
      type: Number,
      default: 24, // hours before appointment
    },
    followupReminders: {
      type: Boolean,
      default: true,
    },
    smsReminders: {
      type: Boolean,
      default: false,
    },
  },

  // Inventory alert settings
  inventorySettings: {
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    expiryAlertDays: {
      type: Number,
      default: 30, // days before expiry to alert
    },
    autoStockDeduction: {
      type: Boolean,
      default: true,
    },
  },

  // Billing/Subscription (for future use)
  subscriptionStatus: {
    type: String,
    enum: ["active", "expired", "trial"],
    default: "active",
  },
  plan: {
    type: String,
    default: "Pro",
  },
  subscriptionEndsAt: {
    type: Date,
  },

  // Security
  lastLogin: {
    type: Date,
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

// Index for faster queries
ClinicSchema.index({ ownerId: 1 });

const Clinic = mongoose.model("Clinic", ClinicSchema);
export default Clinic;
