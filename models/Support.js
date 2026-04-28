import mongoose from "mongoose";

const Schema = mongoose.Schema;

const SupportSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userPhone: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  status: {
    type: String,
    enum: ["open", "resolved"],
    default: "open",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Support = mongoose.model("Support", SupportSchema);
export default Support;
