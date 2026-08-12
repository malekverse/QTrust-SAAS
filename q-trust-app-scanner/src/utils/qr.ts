/**
 * QR code utility functions
 */

/**
 * Extract UUID from QR code data
 * Handles both raw UUIDs and URLs containing UUIDs
 */
export function extractQrUuid(qrData: string): string {
  // If it's already a clean UUID-like string
  if (!qrData.includes('/') && !qrData.includes('?')) {
    return qrData.trim();
  }
  
  // Try to extract from URL path
  if (qrData.includes('/')) {
    try {
      const url = new URL(qrData);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1];
      }
    } catch {
      // Not a valid URL, try simple split
      const parts = qrData.split('/');
      return parts[parts.length - 1] || qrData;
    }
  }
  
  // Try to extract from query string
  if (qrData.includes('?')) {
    try {
      const url = new URL(qrData);
      const uuid = url.searchParams.get('uuid') || 
                   url.searchParams.get('id') || 
                   url.searchParams.get('code');
      if (uuid) return uuid;
    } catch {
      // Not a valid URL
    }
  }
  
  return qrData.trim();
}

/**
 * Validate if a string looks like a valid QR UUID
 */
export function isValidQrUuid(uuid: string): boolean {
  // Basic validation - not empty and reasonable length
  if (!uuid || uuid.length < 8 || uuid.length > 128) {
    return false;
  }
  
  // Should only contain alphanumeric characters, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9\-_]+$/;
  return validPattern.test(uuid);
}

/**
 * Generate a simple hash for QR data (for deduplication)
 */
export function hashQrData(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

