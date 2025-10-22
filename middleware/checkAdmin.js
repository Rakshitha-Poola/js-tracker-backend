import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { User } from '../models/userModel.js';

dotenv.config();

export const checkAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: Invalid token format" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const email = decoded.email;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check admin role
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("checkAdmin error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
