import mongoose from "mongoose";
import User from "./models/User.js";
import Plan from "./models/Plan.js";
import dotenv from "dotenv";

dotenv.config();

async function fixProUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all active users with subscriptionEndsAt but no Plan document
    const activeUsers = await User.find({
      isActive: true,
      subscriptionEndsAt: { $exists: true, $ne: null }
    }).lean();

    console.log(`Found ${activeUsers.length} active users with subscriptions`);

    let fixedCount = 0;
    for (const user of activeUsers) {
      // Check if Plan document exists
      let planDoc = await Plan.findOne({ userId: user._id });
      
      if (!planDoc) {
        // Create Plan document
        planDoc = new Plan({
          userId: user._id,
          plan: "starter", // Default to starter
          status: "active",
          subscriptionEndsAt: user.subscriptionEndsAt
        });
        await planDoc.save();
        console.log(`📝 Created Plan for user: ${user.name} (${user.phone})`);
        fixedCount++;
      } else if (!planDoc.subscriptionEndsAt && user.subscriptionEndsAt) {
        // Update Plan with subscriptionEndsAt
        planDoc.subscriptionEndsAt = user.subscriptionEndsAt;
        planDoc.status = "active";
        await planDoc.save();
        console.log(`🔄 Updated Plan for user: ${user.name} (${user.phone})`);
        fixedCount++;
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} users`);
    console.log("📊 Summary:");
    
    // Show all plans
    const allPlans = await Plan.find({}).lean();
    const proCount = allPlans.filter(p => p.plan === "pro").length;
    const starterCount = allPlans.filter(p => p.plan === "starter").length;
    
    console.log(`   - Pro plans: ${proCount}`);
    console.log(`   - Starter plans: ${starterCount}`);
    console.log(`   - Total plans: ${allPlans.length}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

fixProUsers();