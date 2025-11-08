import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const SCRYPT_KEYLEN = 64;

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = await scryptAsync(password, salt);
  const hashBuffer = Buffer.from(hash, "hex");
  if (hashBuffer.length !== derived.length) return false;
  return timingSafeEqual(hashBuffer, derived);
}
