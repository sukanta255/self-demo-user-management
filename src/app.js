import express from "express";
import authRouter from "./routes/authRoutes.js";

const route = express.Router();

route.use("/auth", authRouter);

export default route;
