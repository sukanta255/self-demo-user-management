import express from "express";
import dotenv from "dotenv";
dotenv.config();
import http from "http";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { TranscribeStreamingClient } from "@aws-sdk/client-transcribe-streaming";
 
import "./src/config/redisClient.js";
import { socketConnection } from "./src/socket.js";
import route from "./src/app.js";
 
const app = express();
const server = http.createServer(app);
const io = new Server(server);
 
// Allowed origins (comma-separated in env)
const allowedOrigins = process.env.NEXT_HOST
  ? process.env.NEXT_HOST.split(",")
  : [];
 
const PORT = process.env.PORT || 3000;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
 
// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       } else {
//         return callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true,
//   })
// );
 

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || [];
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use(helmet());
app.use(cookieParser());
app.use(express.json());

 
const transcribeClient = new TranscribeStreamingClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
 
socketConnection(io, transcribeClient);
 
app.use("/api", route);
 
app.get("/", (req, res) => {
  res.json({message:"Start Server"})
});
 
app.use((error, req, res, next) => {
  const errorStatus = error.status || 500;
  const errorMessage = error.message || "Something went wrong";
 
  return res.status(errorStatus).json({
    success: false,
    status: errorStatus,
    message: errorMessage,
    stack: error.stack,
  });
});
 
server.listen(PORT, () => {
  console.log(`Server is running on port : ${PORT}`);
});
