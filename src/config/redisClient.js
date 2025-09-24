import {createClient} from "redis"
 
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    tls: process.env.REDIS_SCHEME === "tls" ? {} : undefined, // FIX
  },
  password: process.env.REDIS_PASSWORD !== "null" ? process.env.REDIS_PASSWORD : undefined,
});
 
// Connect client
(async () => {
  try {
    await redisClient.connect();
    console.log("✅ Redis Client Connected:", process.env.REDIS_HOST);
  } catch (err) {
    console.error("❌ Redis Client Connection Error:", err);
  }
})();
 
const PROJECT_PREFIX = process.env.REDIS_PREFIX || "";
const prefixedKey = (key) => `${PROJECT_PREFIX}${key}`;
 
const setHash = async (key, field, value, expirySec) => {
  await redisClient.hSet(prefixedKey(key), field, JSON.stringify(value));
  if (expirySec) {
    await redisClient.expire(prefixedKey(key), expirySec);
  }
};
 
const getHash = async (key, field) => {
  const val = await redisClient.hGet(prefixedKey(key), field);
  return val ? JSON.parse(val) : null;
};
 
const getAllHash = async (key) => {
  const data = await redisClient.hGetAll(prefixedKey(key));
  const parsed = {};
  for (const f in data) {
    parsed[f] = JSON.parse(data[f]);
  }
  return parsed;
};
 
const delKey = async (key) => {
  return redisClient.del(prefixedKey(key));
};
 
export  {
  redisClient,
  setHash,
  getHash,
  getAllHash,
  delKey,
};