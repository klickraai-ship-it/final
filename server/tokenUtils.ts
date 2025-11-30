import crypto from 'crypto';

/**
 * HMAC Token Utilities for Email Tracking System
 * 
 * Provides secure token generation and validation using HMAC-SHA256 signatures.
 * All tokens are base64url encoded and include expiry timestamps.
 */

// Get tracking secret from environment or generate a random one
let TRACKING_SECRET = process.env.TRACKING_SECRET;

if (!TRACKING_SECRET) {
  // Generate a random secret for development
  TRACKING_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn(
    '⚠️  WARNING: TRACKING_SECRET environment variable not set. ' +
    'Using randomly generated secret. Tokens will be invalid after server restart. ' +
    'Set TRACKING_SECRET in production!'
  );
}

/**
 * Generate HMAC-SHA256 signature for given data
 * 
 * @param data - String data to sign
 * @param secret - Secret key for HMAC
 * @returns Hex-encoded HMAC signature
 */
export function generateHMACSignature(data: string, secret: string = TRACKING_SECRET!): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * Encode token data and signature to base64url format
 * 
 * Base64url encoding is URL-safe (no +, /, or = characters that need escaping)
 * 
 * @param data - Token data string (e.g., "campaignId:subscriberId:expiresAt")
 * @param signature - HMAC signature hex string
 * @returns Base64url encoded token
 */
export function encodeToken(data: string, signature: string): string {
  const tokenString = `${data}:${signature}`;
  
  // Convert to base64url (URL-safe base64)
  return Buffer.from(tokenString, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode base64url token to extract data and signature
 * 
 * @param token - Base64url encoded token
 * @returns Object with data and signature, or null if malformed
 */
export function decodeToken(token: string): { data: string; signature: string } | null {
  try {
    // Convert from base64url to base64
    let base64 = token
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // Decode from base64
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    
    // Split into data and signature (signature is last part after final colon)
    const lastColonIndex = decoded.lastIndexOf(':');
    if (lastColonIndex === -1) {
      return null;
    }
    
    const data = decoded.substring(0, lastColonIndex);
    const signature = decoded.substring(lastColonIndex + 1);
    
    return { data, signature };
  } catch (error) {
    // Token is malformed or not valid base64
    return null;
  }
}

/**
 * Validate HMAC signature for given data
 * 
 * @param data - Original data that was signed
 * @param signature - HMAC signature to validate
 * @param secret - Secret key for HMAC
 * @returns True if signature is valid, false otherwise
 */
export function validateHMACSignature(
  data: string,
  signature: string,
  secret: string = TRACKING_SECRET!
): boolean {
  const expectedSignature = generateHMACSignature(data, secret);
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    // Signatures have different lengths or invalid hex
    return false;
  }
}

/**
 * Check if token has expired
 * 
 * @param expiresAt - Expiry timestamp in milliseconds
 * @returns True if token has expired, false otherwise
 */
export function checkTokenExpiry(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

/**
 * Generate expiry timestamp for tokens (1 year from now)
 * 
 * @returns Timestamp in milliseconds, 1 year in the future
 */
export function generateExpiryTimestamp(): number {
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  return Date.now() + oneYearInMs;
}

/**
 * Get the tracking secret (for testing purposes)
 * 
 * @returns Current tracking secret
 */
export function getTrackingSecret(): string {
  return TRACKING_SECRET!;
}

/**
 * Set the tracking secret (for testing purposes)
 * 
 * @param secret - New tracking secret
 */
export function setTrackingSecret(secret: string): void {
  TRACKING_SECRET = secret;
}


/**
 * Validate a complete token (decode, verify signature, check expiry)
 * 
 * This is the main validation function that should be used for all token validation.
 * It performs all necessary checks and returns null if any validation fails.
 * 
 * @param token - Base64url encoded token
 * @param secret - Secret key for HMAC validation (optional, uses default)
 * @returns Validated token data string, or null if invalid/expired
 */
export function validateToken(token: string, secret: string = TRACKING_SECRET!): string | null {
  // Step 1: Decode the token
  const decoded = decodeToken(token);
  if (!decoded) {
    return null; // Malformed token
  }
  
  const { data, signature } = decoded;
  
  // Step 2: Validate HMAC signature
  if (!validateHMACSignature(data, signature, secret)) {
    return null; // Invalid signature
  }
  
  // Step 3: Extract expiry timestamp from data
  // Data format is typically: "field1:field2:...:expiresAt"
  const parts = data.split(':');
  const expiresAtStr = parts[parts.length - 1];
  const expiresAt = parseInt(expiresAtStr, 10);
  
  if (isNaN(expiresAt)) {
    return null; // Invalid expiry timestamp
  }
  
  // Step 4: Check if token has expired
  if (checkTokenExpiry(expiresAt)) {
    return null; // Token expired
  }
  
  // Token is valid
  return data;
}

/**
 * Generate a complete token with data and signature
 * 
 * This is a helper function that combines data generation, signing, and encoding.
 * Note: Data fields should not contain colons as they are used as separators.
 * If fields contain colons, they will be URL-encoded.
 * 
 * @param dataFields - Array of data fields to include in token
 * @param secret - Secret key for HMAC (optional, uses default)
 * @returns Base64url encoded token
 */
export function generateToken(dataFields: string[], secret: string = TRACKING_SECRET!): string {
  // URL-encode fields to handle special characters including colons
  const encodedFields = dataFields.map(field => encodeURIComponent(field));
  
  // Add expiry timestamp as last field
  const expiresAt = generateExpiryTimestamp();
  const allFields = [...encodedFields, expiresAt.toString()];
  
  // Join fields with colon separator
  const data = allFields.join(':');
  
  // Generate HMAC signature
  const signature = generateHMACSignature(data, secret);
  
  // Encode token
  return encodeToken(data, signature);
}
