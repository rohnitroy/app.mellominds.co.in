/**
 * Input sanitization and validation helpers.
 * Used across routes to reject malformed, oversized, or dangerous inputs.
 */

// Strip HTML tags and trim whitespace
export const sanitizeStr = (val, maxLen = 255) => {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
};

// Validate email format and length
export const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

// Validate phone — digits, spaces, +, -, () only
export const isValidPhone = (phone) => {
  if (!phone) return true; // optional field
  return /^[+\d\s\-().]{5,20}$/.test(phone.trim());
};

// Validate slug — alphanumeric and hyphens only
export const isValidSlug = (slug) => {
  if (typeof slug !== 'string') return false;
  return /^[a-z0-9-]{1,80}$/.test(slug.trim());
};

// Validate integer in range
export const isValidInt = (val, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = parseInt(val);
  return !isNaN(n) && n >= min && n <= max;
};

// Reject oversized JSON objects (field count guard)
export const isOversizedObject = (obj, maxKeys = 50) => {
  if (typeof obj !== 'object' || obj === null) return false;
  return Object.keys(obj).length > maxKeys;
};

// Express middleware — rejects requests with body larger than limit (belt-and-suspenders)
export const rejectOversizedBody = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 50 * 1024) { // 50kb
    return res.status(413).json({ error: 'Request payload too large.' });
  }
  next();
};
