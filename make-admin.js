import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

async function makeAdmin(phone) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const user = await User.findOneAndUpdate(
      { phone },
      { role: "admin", isActive: true },
      { new: true },
    );

    if (!user) {
      console.log("❌ User not found with phone:", phone);
      process.exit(1);
    }

    console.log("✅ User promoted to ADMIN:");
    console.log("   Name :", user.name);
    console.log("   Phone:", user.phone);
    console.log("   Role :", user.role);
    console.log("   Active:", user.isActive);
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Get phone from command line argument
const phone = process.argv[2];

if (!phone) {
  console.log(`
Usage: node make-admin.js <phone-number>

Example:
  node make-admin.js 9876543210

This will promote the user with that phone number to ADMIN.
`);
  process.exit(0);
}

makeAdmin(phone);
