import crypto from 'crypto'
// const key = crypto.randomBytes(32); //Need 32 bytes (256 bits) key as we are using AES-256 encryption
// const iv = crypto.randomBytes(16); //Need 16 bytes (128 bits) Initialization vector as default block size is 128 bits
 
// ❌ Old version (invalid key length):
// const AesKey = Buffer.from("J/7042666362+77U1PB80v2oneportfolio5yCIP2YI6tQ=", "base64");
 
// ✅ New version (ensure correct 32-byte key):
const AesKey = crypto.createHash("sha256")
    .update("J/7042666362+77U1PB80v2oneportfolio5yCIP2YI6tQ=") // your original string
    .digest(); // always 32 bytes for AES-256
 
// Your IV was fine (16 bytes after base64 decode)
const AesIV = Buffer.from("gaOr3uvhZEwFeSbRHwlHcg==", "base64");
 
function encrypt(plainString) {
    const cipher = crypto.createCipheriv("aes-256-cbc", AesKey, AesIV);
    let encrypted = Buffer.concat([cipher.update(Buffer.from(plainString, "utf8")), cipher.final()]);
    return encrypted.toString("base64url");
}
 
function decrypt(base64String) {
    const decipher = crypto.createDecipheriv("aes-256-cbc", AesKey, AesIV);
    const deciphered = Buffer.concat([decipher.update(Buffer.from(base64String, "base64url")), decipher.final()]);
    return deciphered.toString("utf8");
}
 
// Its better to pass iv and key in bytes/buffer
var encryptedData = encrypt("9650870742");
console.log(encryptedData);
 
var decryptedData = decrypt(encryptedData);
// e-3j7ZtqH3aEwU6DwT--sw
// buO9qHqmaY2tIfbQ1wLVEQ
// XYbsk__mHRWEw3JFW-szaA
console.log(decryptedData);
 
export {
    encrypt,
    decrypt
};