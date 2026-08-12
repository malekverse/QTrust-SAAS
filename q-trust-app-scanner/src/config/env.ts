/**
 * Environment configuration for Q-Trust App Scanner
 * 
 * In production, these values should come from environment variables
 * For now, we'll use hardcoded values that can be overridden in setup
 */

export const ENV = {
  // Backend API URL
  API_BASE_URL: 'https://q-trust.vercel.app',
  
  // Scanner device token - THIS IS THE ACTUAL TOKEN VALUE
  SCANNER_TOKEN: 'Zt9Qh2FwLk7mR3cN1bX6pE8Vd5SgJ0aT4yWqH9uU3rM2nC7kF5sD1vP8gB4hY6',
  
  // API Endpoints
  ENDPOINTS: {
    CHECK_IN: '/api/attendance/check-in',
  },
  
  // Request header names
  HEADERS: {
    SCANNER_TOKEN_NAME: 'x-scanner-token', // This is the header NAME
  },
} as const;

export default ENV;
