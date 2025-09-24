import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { hashToken } from "../utils/hash.js";
import { redisClient, setHash } from "../config/redisClient.js";
import { encrypt } from '../utils/encryption.js';
import axios from "axios";
import mysqlConnection from "../config/mysql.js";


// helpers
function tryVerifyRefresh(rawToken) {
  try {
    return verifyRefreshToken(rawToken);
  } catch {
    return null;
  }
}

const isInterimMobile = (m) =>
  typeof m === "string" && m.length === 11 && m.startsWith("1");

// ------------------- VERIFY API -------------------

const verifyApi = async (req, res) => {
  try {
    let { mobileNo } = req.body;
    const rawToken = req.cookies["OHA-REF-T"];

    const REFRESH_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
    const REFRESH_MAX_AGE_SEC = Math.floor(REFRESH_MAX_AGE_MS / 1000);

    const decoded = rawToken ? tryVerifyRefresh(rawToken) : null;
    const cookieMobile = decoded?.mobileNo || null;

    // Prevent session hijacking (real mobile mismatch)
    if (
      cookieMobile &&
      !isInterimMobile(cookieMobile) &&
      mobileNo &&
      !isInterimMobile(mobileNo) &&
      cookieMobile !== mobileNo
    ) {
      return res.status(409).json({
        error:
          "Different real mobile not allowed in active session. Please logout first.",
        currentMobile: cookieMobile,
        requestedMobile: mobileNo,
      });
    }

    // Decide identity
    if (!mobileNo) {
      mobileNo =
        cookieMobile ||
        ("1" + String(Math.floor(Math.random() * 1e10)).padStart(10, "0"));
    } else if (cookieMobile) {
      if (!isInterimMobile(cookieMobile)) {
        mobileNo = cookieMobile; // lock to real
      } else if (!isInterimMobile(mobileNo)) {
        // interim -> real
      } else {
        mobileNo = cookieMobile; // both interim, keep cookie
      }
    }

    // If cookie already matches identity → just issue access token
    if (cookieMobile && cookieMobile === mobileNo) {
      const accessToken = generateAccessToken({ mobileNo });
      return res
        .status(200)
        .json({ accessToken, interim: isInterimMobile(mobileNo) });
    }

    // Upgrade interim -> real
    if (
      cookieMobile &&
      isInterimMobile(cookieMobile) &&
      !isInterimMobile(mobileNo)
    ) {
      const oldHashed = hashToken(rawToken);

      // Delete sessions from MySQL (equivalent of prisma.userSession.deleteMany)
      await new Promise((resolve, reject) => {
        const query = "DELETE FROM USER_SESSIONS WHERE mobileNo = ? AND refreshToken = ?";
        mysqlConnection.query(query, [cookieMobile, oldHashed], (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      const oldEnc = `ENC=${encrypt(
        `CLIENT_ID=1&USER_ID=2&MOBILE_NO=${cookieMobile}`
      )}`;
      await redisClient.del(`user:${oldEnc}:rt:${oldHashed}`);

      res.clearCookie("OHA-REF-T", {
        httpOnly: false,
        secure: true,
        sameSite: "none",
        path: "/",
      });

      res.clearCookie("OHA-IS-LOGGEDIN", {
        httpOnly: false,
        secure: true,
        sameSite: "none",
        path: "/",
      });
    }

    // Lookup OHA_USER_ID (real users only)
    let ohaUserId = null;
    if (!isInterimMobile(mobileNo)) {
      const response = await axios.post(
        `${process.env.URL}v1/find_user_by_no`,
        { phone: mobileNo },
        { headers: { "Content-Type": "application/json" } }
      );

      const user = response.data;

      if (user && user.unique_id) ohaUserId = user.unique_id;
    }

    // Create new refresh token + session
    const payload = { mobileNo };
    const refreshToken = generateRefreshToken(payload);
    const hashedRefreshToken = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_MS);

    const deviceInfo = req.headers["user-agent"] || "Unknown Device";
    const ipAddress =
      (req.headers["x-forwarded-for"] || "").split(",")[0]?.trim() ||
      req.ip ||
      null;

    const enc = `ENC=${encrypt(
      `CLIENT_ID=1&USER_ID=2&MOBILE_NO=${mobileNo}`
    )}`;
    const encKey = `user:${enc}`;

    // Insert new session into MySQL (equivalent to prisma.userSession.create)
    await new Promise((resolve, reject) => {
      const query =
        "INSERT INTO USER_SESSIONS (mobileNo, refreshToken, expiresAt, deviceInfo, ipAddress, queryString, ohaUserId) VALUES (?, ?, ?, ?, ?, ?, ?)";
      mysqlConnection.query(
        query,
        [
          mobileNo,
          hashedRefreshToken,
          expiresAt,
          deviceInfo,
          ipAddress,
          encKey,
          ohaUserId,
        ],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });

    await setHash(
      `${encKey}:rt:${hashedRefreshToken}`,
      "user-session:refreshtoken",
      expiresAt.toISOString(),
      REFRESH_MAX_AGE_SEC
    );

    res.cookie("OHA-REF-T", refreshToken, {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: REFRESH_MAX_AGE_MS,
    });

    res.cookie("OHA-IS-LOGGEDIN", (!isInterimMobile(mobileNo)).toString(), {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: REFRESH_MAX_AGE_MS,
    });

    const accessToken = generateAccessToken({ mobileNo });

    return res.status(200).json({
      accessToken,
      interim: isInterimMobile(mobileNo),
      upgraded:
        cookieMobile &&
        isInterimMobile(cookieMobile) &&
        !isInterimMobile(mobileNo),
    });
  } catch (err) {
    console.error(
      "verifyApi error:",
      err.response?.data || err.message || err
    );
    return res.status(500).json({ error: "Server error" });
  }
};

// ------------------- REFRESH TOKEN -------------------
const refresh = async (req, res) => {
  try {
    const rawToken = req.cookies["OHA-REF-T"];
    if (!rawToken) return res.status(401).json({ error: "No refresh token" });

    const decoded = tryVerifyRefresh(rawToken);
    if (!decoded?.mobileNo) {
      return res.status(403).json({ error: "Invalid or expired refresh token" });
    }

    const mobileNo = decoded.mobileNo;
    const hashedRefreshToken = hashToken(rawToken);
    const enc = `ENC=${encrypt(`CLIENT_ID=1&USER_ID=2&MOBILE_NO=${mobileNo}`)}`;
    const redisKey = `user:${enc}:rt:${hashedRefreshToken}`;

    const exists = await redisClient.exists(redisKey);
    if (!exists) {
      return res.status(403).json({ error: "Invalid or expired refresh token" });
    }

    const accessToken = generateAccessToken({ mobileNo });
    return res.json({ accessToken });
  } catch (err) {
    console.error("refresh error:", err);
    return res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};

// ------------------- LOGOUT -------------------
const logout = async (req, res) => {
  try {
    const rawToken = req.cookies["OHA-REF-T"];

    if (rawToken) {
      const decoded = tryVerifyRefresh(rawToken);
      if (decoded?.mobileNo) {
        const mobileNo = decoded.mobileNo;
        const hashedToken = hashToken(rawToken);

        // Delete DB session (equivalent of prisma.userSession.deleteMany)
        await new Promise((resolve, reject) => {
          const query = "DELETE FROM USER_SESSIONS WHERE mobileNo = ? AND refreshToken = ?";
          mysqlConnection.query(query, [mobileNo, hashedToken], (err, results) => {
            if (err) return reject(err);
            resolve(results);
          });
        });

        // Delete Redis per-token key
        const enc = `ENC=${encrypt(
          `CLIENT_ID=1&USER_ID=2&MOBILE_NO=${mobileNo}`
        )}`;
        const encKey = `user:${enc}`;
        await redisClient.del(`${encKey}:rt:${hashedToken}`);
      }
    }

    // Clear cookies
    res.clearCookie("OHA-REF-T", {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    res.clearCookie("OHA-IS-LOGGEDIN", {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      path: "/",
    });

    return res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

const profile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: no user found" });
    }
    const response = await axios.post(
        `${process.env.URL}v1/find_user_by_no`,
        { phone: req.user.mobileNo },
        { headers: { "Content-Type": "application/json" } }
      );

    res.json(response.data);
  } catch (error) {
    console.error("profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export { verifyApi, refresh, logout, profile };
