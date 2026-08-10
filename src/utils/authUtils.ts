/**
 * Auth & Security Utilities for User Management
 * Implements password hashing (SHA-256 via Web Crypto API) and temporary password generation
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
 * Generates a strong random temporary password for first access or password resets.
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

/**
 * Calls backend API to send credentials email securely.
 */
export async function sendUserCredentialsEmail(params: {
  to: string;
  name: string;
  email: string;
  tempPassword: string;
  isReset?: boolean;
}): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: params.isReset ? "reset_password" : "welcome_credentials",
        to: params.to,
        userName: params.name,
        email: params.email,
        tempPassword: params.tempPassword
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || "Falha ao enviar e-mail pelo servidor.");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error sending email via API:", error);
    // Return gracefully so user creation/reset is not completely blocked if server email service fails
    return {
      success: false,
      message: error?.message || "Não foi possível enviar o e-mail automaticamente."
    };
  }
}
