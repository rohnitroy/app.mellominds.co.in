/**
 * Encryption utilities for sensitive data protection
 * Uses AES-256-GCM with per-user derived keys
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Get master secret from environment
const getMasterSecret = () => {
  const secret = process.env.ENCRYPTION_MASTER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_MASTER_SECRET must be at least 32 characters');
  }
  return secret;
};

// Derive a unique encryption key for each user
export const deriveUserKey = (userId) => {
  const masterSecret = getMasterSecret();
  const salt = crypto.createHash('sha256').update(`user_${userId}_salt`).digest();
  return crypto.pbkdf2Sync(masterSecret, salt, 100000, 32, 'sha256');
};

// Encrypt sensitive data
export const encryptSensitiveData = (plaintext, userId) => {
  if (!plaintext || plaintext === null || plaintext === undefined) {
    return null;
  }
  
  try {
    const key = deriveUserKey(userId);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from(`user_${userId}`)); // Additional authenticated data
    
    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Return: iv + tag + encrypted (all hex encoded)
    return iv.toString('hex') + tag.toString('hex') + encrypted;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt sensitive data');
  }
};

// Decrypt sensitive data
export const decryptSensitiveData = (ciphertext, userId) => {
  if (!ciphertext || ciphertext === null || ciphertext === undefined) {
    return null;
  }
  
  try {
    const key = deriveUserKey(userId);
    
    // Extract iv, tag, and encrypted data
    const iv = Buffer.from(ciphertext.slice(0, IV_LENGTH * 2), 'hex');
    const tag = Buffer.from(ciphertext.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2), 'hex');
    const encrypted = ciphertext.slice((IV_LENGTH + TAG_LENGTH) * 2);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from(`user_${userId}`));
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt sensitive data');
  }
};

// Encrypt JSONB objects (for form_responses, note_content, etc.)
export const encryptJSONB = (jsonData, userId) => {
  if (!jsonData) return null;
  const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
  return encryptSensitiveData(jsonString, userId);
};

// Decrypt JSONB objects
export const decryptJSONB = (encryptedData, userId) => {
  if (!encryptedData) return null;
  try {
    const decrypted = decryptSensitiveData(encryptedData, userId);
    return decrypted ? JSON.parse(decrypted) : null;
  } catch (error) {
    console.error('JSON decryption error:', error.message);
    return null;
  }
};

// Utility to encrypt multiple fields in an object
export const encryptFields = (obj, fieldsToEncrypt, userId) => {
  const result = { ...obj };
  for (const field of fieldsToEncrypt) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = encryptSensitiveData(result[field], userId);
    }
  }
  return result;
};

// Utility to decrypt multiple fields in an object
export const decryptFields = (obj, fieldsToDecrypt, userId) => {
  const result = { ...obj };
  for (const field of fieldsToDecrypt) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = decryptSensitiveData(result[field], userId);
    }
  }
  return result;
};