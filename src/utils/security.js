// src/utils/security.js
// Cryptographic utilities and brute-force protection for BulSU POS

const SALT = "bulsu_pos_secure_salt_v1_2026";

/**
 * Computes SHA-256 hash of a PIN with salt using the Web Crypto API
 * @param {string} pin 
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function hashPin(pin) {
  if (!pin) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(String(pin).trim() + ":" + SALT);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifies a PIN against a stored value (supports both hashed and legacy plaintext for seamless upgrade)
 * @param {string} inputPin 
 * @param {string} storedValue 
 * @returns {Promise<{ valid: boolean, needsUpgrade: boolean }>}
 */
export async function verifyPin(inputPin, storedValue) {
  if (!inputPin || !storedValue) return { valid: false, needsUpgrade: false };

  const cleanInput = String(inputPin).trim();
  const cleanStored = String(storedValue).trim();

  // 1. Check if storedValue is already a 64-character SHA-256 hex hash
  if (cleanStored.length === 64 && /^[0-9a-fA-F]+$/.test(cleanStored)) {
    const inputHash = await hashPin(cleanInput);
    return { valid: inputHash.toLowerCase() === cleanStored.toLowerCase(), needsUpgrade: false };
  }

  // 2. Legacy plaintext comparison (for backward compatibility)
  if (cleanInput === cleanStored) {
    return { valid: true, needsUpgrade: true };
  }

  return { valid: false, needsUpgrade: false };
}

// ==========================================
// Brute-Force Rate Limiting & Account Lockout
// ==========================================

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds lockout

/**
 * Gets the current lockout status for an authentication scope (e.g., 'admin', 'cashier')
 * @param {string} scope 
 * @returns {{ isLocked: boolean, remainingSeconds: number, attemptsLeft: number }}
 */
export function getLockoutStatus(scope) {
  try {
    const key = `bulsu_lockout_${scope}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };

    const data = JSON.parse(raw);
    const now = Date.now();

    if (data.lockedUntil && data.lockedUntil > now) {
      const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, attemptsLeft: 0 };
    }

    // Lockout expired, reset attempts
    if (data.lockedUntil && data.lockedUntil <= now) {
      sessionStorage.removeItem(key);
      return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };
    }

    const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - (data.count || 0));
    return { isLocked: false, remainingSeconds: 0, attemptsLeft };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };
  }
}

/**
 * Records a failed attempt. If exceeding MAX_FAILED_ATTEMPTS, locks out the user.
 * @param {string} scope 
 * @returns {{ isLocked: boolean, remainingSeconds: number, attemptsLeft: number }}
 */
export function recordFailedAttempt(scope) {
  try {
    const key = `bulsu_lockout_${scope}`;
    const current = getLockoutStatus(scope);
    const newCount = (MAX_FAILED_ATTEMPTS - current.attemptsLeft) + 1;

    if (newCount >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      sessionStorage.setItem(key, JSON.stringify({ count: newCount, lockedUntil }));
      return { isLocked: true, remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000), attemptsLeft: 0 };
    }

    sessionStorage.setItem(key, JSON.stringify({ count: newCount, lockedUntil: null }));
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS - newCount };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: 1 };
  }
}

/**
 * Clears failed attempts upon successful login.
 * @param {string} scope 
 */
export function clearFailedAttempts(scope) {
  try {
    sessionStorage.removeItem(`bulsu_lockout_${scope}`);
  } catch {
    // Ignore error
  }
}
