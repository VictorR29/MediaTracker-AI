import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, isLegacyPassword } from '../password';

describe('password utilities', () => {
  describe('hashPassword', () => {
    it('returns salt:hash format', async () => {
      const result = await hashPassword('mypassword');
      expect(result).toContain(':');
      const parts = result.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBe(32); // 16 bytes = 32 hex chars
      expect(parts[1].length).toBe(64); // SHA-256 = 64 hex chars
    });

    it('produces different salts for the same password', async () => {
      const hash1 = await hashPassword('mypassword');
      const hash2 = await hashPassword('mypassword');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('returns valid=true, needsRehash=false for hashed password', async () => {
      const hashed = await hashPassword('testpass');
      const result = await verifyPassword('testpass', hashed);
      expect(result.valid).toBe(true);
      expect(result.needsRehash).toBe(false);
    });

    it('returns valid=true, needsRehash=true for legacy plaintext', async () => {
      const result = await verifyPassword('plaintext', 'plaintext');
      expect(result.valid).toBe(true);
      expect(result.needsRehash).toBe(true);
    });

    it('returns valid=false for wrong password', async () => {
      const hashed = await hashPassword('correctpass');
      const result = await verifyPassword('wrongpass', hashed);
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for wrong plaintext password', async () => {
      const result = await verifyPassword('wrong', 'correct');
      expect(result.valid).toBe(false);
      expect(result.needsRehash).toBe(false); // Only true when valid AND legacy
    });
  });

  describe('isLegacyPassword', () => {
    it('returns true for plaintext (no colon)', () => {
      expect(isLegacyPassword('plaintext')).toBe(true);
    });

    it('returns false for hashed (contains colon)', () => {
      expect(isLegacyPassword('abc123:def456')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isLegacyPassword('')).toBe(false);
    });
  });
});
