import { User } from "../models/userModel.js";
import { Progress } from "../models/progressModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --------------------- REGISTER ---------------------
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required*" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // ⚙️ Set role dynamically (first user can be admin, others normal)
    let role = "user";
    if (email === process.env.ADMIN_EMAIL) {
      role = "admin";
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();

    // 🔹 Create empty Progress document for new user
    const newProgress = new Progress({ userId: newUser._id, topics: [] });
    await newProgress.save();

    // 🔹 JWT includes role and email
    const token = jwt.sign(
      { email: newUser.email, role: newUser.role },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );

    console.log("✅ User registered successfully");
    return res.status(200).json({
      message: "User registered successfully",
      token,
      user: { name: newUser.name, email: newUser.email, role: newUser.role },
    });
  } catch (error) {
    console.log("❌ Error in register controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --------------------- LOGIN ---------------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required*" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not registered" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );

    console.log("✅ Login successful");
    return res.status(200).json({
      message: "Login successful",
      token,
      user: { name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.log("❌ Error in login controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --------------------- GOOGLE LOGIN ---------------------
export const google = async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      // ⚙️ Assign role automatically if it's the admin email
      const role = email === process.env.ADMIN_EMAIL ? "admin" : "user";

      user = await User.create({ name, email, googleId: sub, role });

      // 🔹 Create empty Progress document for new Google user
      const newProgress = new Progress({ userId: user._id, topics: [] });
      await newProgress.save();
    }

    const newToken = jwt.sign(
      { email: user.email, role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );

    console.log("✅ Google login successful");
    return res.status(200).json({
      message: "User logged in successfully",
      token: newToken,
      user: { name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.log("❌ Error in google Controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

