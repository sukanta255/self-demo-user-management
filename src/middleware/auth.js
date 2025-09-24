import jwt from "jsonwebtoken";
 
export const auth = (req, res, next) => {
  let token;
 
  // 1. Check Authorization header
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }
 
  // 2. Fallback to cookie (if access token is stored in cookies)
  if (!token && req.cookies?.["OHA-ACC-T"]) {
    token = req.cookies["OHA-ACC-T"];
  }
 
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
 
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user payload to request
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};