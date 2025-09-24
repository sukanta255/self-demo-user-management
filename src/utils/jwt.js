import jwt from "jsonwebtoken";
 
// for secret token: https://generate-secret.vercel.app/32
// for refresh token: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
 
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
 
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};
 
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
 
export {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
};