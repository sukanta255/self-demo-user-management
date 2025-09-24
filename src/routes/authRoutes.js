import express from "express";
import { logout, profile, refresh, verifyApi } from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";

const authRouter = express.Router();
authRouter.get("/",(req,res)=>{
res.json({"message":"sumit"})
});
authRouter.post("/verifyApi", (req, res, next) => {
  console.log("🔥 /verifyApi hit");
  next(); // call the actual controller
}, verifyApi);

authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/profile",auth, profile);

export default authRouter;