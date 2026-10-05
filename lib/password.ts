import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const defaultPassword = "change-me";
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hex] = encoded.split("$");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(hex ?? "")) return false;
  const key = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}
export function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 12 && value.length <= 128 && value.trim() !== defaultPassword;
}
