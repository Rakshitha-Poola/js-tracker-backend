import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./utils/db.js";
import authRoute from "./routes/authRoute.js";
import topicRoute from "./routes/topicRoute.js";
import adminRoute from "./routes/adminRoute.js";
import cors from "cors";

dotenv.config();

const app = express();

// CORS setup
app.use(
  cors({
    origin: [
      "https://js-tracker-fullstack.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true, // if you are using cookies or credentials
  })
);

// Add COOP and COEP headers to fix window.postMessage issue
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

app.use(express.json());
app.use("/api/auth", authRoute);
app.use("/api/topic", topicRoute);
app.use("/api/admin", adminRoute);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  connectDB();
  console.log(`Server started on port ${port}`);
});
