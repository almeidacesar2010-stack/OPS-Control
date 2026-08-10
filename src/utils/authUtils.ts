import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser } from '../types';

/**
 * Auth & Security Utilities for User Management
 * Implements password hashing (SHA-256 via Web Crypto API) and password generation
 */

const SALT = "opscontrol_sec_salt_2026_v1";

/**
 * Converts any username or display identifier into a 100% valid internal email address for Firebase Auth.
 * e.g., "lucas.viana" -> "lucas.viana@opscontrol.internal"
 * "lucas viana" -> "lucas_viana@opscontrol.internal"
 */
export function getUsernameInternalEmail(username: string): string {
  if (!username) return "user_unknown@opscontrol.internal";
  let clean = username.trim().toLowerCase();
  if (clean.startsWith('@')) clean = clean.slice(1);
  const safeUser = clean.replace(/[^a-z0-9._-]/g, '_');
  return `${safeUser || 'user'}@opscontrol.internal`;
}

/**
 * Searches Firestore users collection for a user matching the provided username or email.
 */
export async function findUserByUsernameOrEmail(input: string): Promise<{ docId: string; data: AppUser } | null> {
  if (!input || !input.trim()) return null;
  const cleanInput = input.trim().toLowerCase().replace(/^@/, '');
  const usersRef = collection(db, 'users');

  // 1. Query exact username
  try {
    const qUsername = query(usersRef, where('username', '==', cleanInput));
    const snapUsername = await getDocs(qUsername);
    if (!snapUsername.empty) {
      return { docId: snapUsername.docs[0].id, data: snapUsername.docs[0].data() as AppUser };
    }
  } catch (err) {
    console.error('Error querying username in Firestore:', err);
  }

  // 2. Query exact email
  try {
    const qEmail = query(usersRef, where('email', '==', cleanInput));
    const snapEmail = await getDocs(qEmail);
    if (!snapEmail.empty) {
      return { docId: snapEmail.docs[0].id, data: snapEmail.docs[0].data() as AppUser };
    }
  } catch (err) {
    console.error('Error querying email in Firestore:', err);
  }

  // 3. Query internal email format
  try {
    const internalEmail = getUsernameInternalEmail(cleanInput);
    const qInternal = query(usersRef, where('email', '==', internalEmail));
    const snapInternal = await getDocs(qInternal);
    if (!snapInternal.empty) {
      return { docId: snapInternal.docs[0].id, data: snapInternal.docs[0].data() as AppUser };
    }
  } catch (err) {
    console.error('Error querying internal email in Firestore:', err);
  }

  // 4. Query legacy @opscontrol.com format
  try {
    const legacyEmail = `${cleanInput}@opscontrol.com`;
    const qLegacy = query(usersRef, where('email', '==', legacyEmail));
    const snapLegacy = await getDocs(qLegacy);
    if (!snapLegacy.empty) {
      return { docId: snapLegacy.docs[0].id, data: snapLegacy.docs[0].data() as AppUser };
    }
  } catch (err) {
    console.error('Error querying legacy email in Firestore:', err);
  }

  // 5. Fallback scan all users in Firestore (case-insensitive match)
  try {
    const snapAll = await getDocs(usersRef);
    for (const userDoc of snapAll.docs) {
      const uData = userDoc.data() as AppUser;
      const uName = (uData.username || '').trim().toLowerCase().replace(/^@/, '');
      const uEmail = (uData.email || '').trim().toLowerCase();
      const rawInputClean = input.trim().toLowerCase().replace(/^@/, '');
      
      if (
        uName === rawInputClean ||
        uEmail === rawInputClean ||
        uEmail === getUsernameInternalEmail(rawInputClean) ||
        (uData.name && uData.name.trim().toLowerCase() === rawInputClean)
      ) {
        return { docId: userDoc.id, data: uData };
      }
    }
  } catch (err) {
    console.error('Error scanning all users in Firestore:', err);
  }

  return null;
}

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
