/**
 * Password hashing utility using Web Crypto API.
 * Strategy: SHA-256 with a per-user salt.
 * The salt is stored alongside the hash in the format: `salt:hash`.
 * Migration: When a user logs in with a plaintext password (legacy),
 * we re-hash it and update the stored value transparently.
 */

const ENCODER = new TextEncoder();

export const generateSalt = (): string => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
};

const sha256 = async (password: string, salt: string): Promise<string> => {
  const data = ENCODER.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = generateSalt();
  const hash = await sha256(password, salt);
  return `${salt}:${hash}`;
};

export const verifyPassword = async (
  inputPassword: string,
  storedPassword: string
): Promise<{ valid: boolean; needsRehash: boolean }> => {
  if (!storedPassword.includes(':')) {
    const valid = inputPassword === storedPassword;
    return { valid, needsRehash: valid };
  }

  const [salt, storedHash] = storedPassword.split(':');
  if (!salt || !storedHash) {
    const valid = inputPassword === storedPassword;
    return { valid, needsRehash: valid };
  }

  const inputHash = await sha256(inputPassword, salt);
  return { valid: inputHash === storedHash, needsRehash: false };
};

export const isLegacyPassword = (storedPassword: string): boolean => {
  return !!storedPassword && !storedPassword.includes(':');
};
