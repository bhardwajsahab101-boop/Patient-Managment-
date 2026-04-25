import mongoose from "mongoose";
import { patient } from "./models/patient.js";

await mongoose.connect("mongodb://127.0.0.1:27017/Fathersahab");

const today = new Date();
today.setHours(0, 0, 0, 0);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 3); // Overdue
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1); // Upcoming

const data = [
  {
    name: "Abhay (Overdue)",
    phone: "8950817712",
    visits: [
      {
        date: new Date("2024-10-10"),
        notes: "RCT",
        price: 3000,
        nextVisit: yesterday, // Overdue
      },
    ],
  },
  {
    name: "Riya Sharma (Today)",
    phone: "9876543210",
    visits: [
      {
        date: new Date("2024-10-16"),
        notes: "Cleaning",
        price: 500,
        nextVisit: today, // Today
      },
    ],
  },
  {
    name: "Rahul Singh (Upcoming)",
    phone: "8899776655",
    visits: [
      {
        date: new Date("2024-10-15"),
        notes: "Checkup",
        price: 300,
        nextVisit: tomorrow, // Will show as upcoming
      },
    ],
  },
];

await patient.deleteMany({});
await patient.insertMany(data);

console.log("✅ Seeded data with overdue/today/upcoming follow-ups");
process.exit();
