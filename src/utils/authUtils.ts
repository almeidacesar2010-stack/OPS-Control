/**
 * Auth & Security Utilities for User Management
 * Implements password hashing (SHA-256 via Web Crypto API) and password generation
 */

const SALT = "opscontrol_sec_salt_2026_v1";

/**
 * Generates a SHA-256 hash for a given password string.
 * Ensures passwords are never stored in plain text.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compares a plain text password with a stored hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  const computedHash = await hashPassword(password);
  return computedHash === hash;
}

/**
 * Generates a strong random password for first access or password resets.
 * E.g. "xK9#mQ2!pL"
 */
export function generateTempPassword(length: number = 10): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*";

  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = "";
  // Ensure at least one char from each group
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));

  for (let i = password.length; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the generated password
  return password.split("").sort(() => 0.5 - Math.random()).join("");
}
