import crypto from 'crypto'
/**
 * Hash a token using SHA256
 * @param {string} token - raw refresh token
 * @returns {string} hashed token
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
 
export  { hashToken };