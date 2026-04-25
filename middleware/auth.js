import User from "../models/User.js";

export const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).send("Login required");
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).send("User not found");
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).send("Authentication error");
  }
};
