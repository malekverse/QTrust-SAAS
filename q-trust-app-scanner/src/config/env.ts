/**
 * Environment configuration for Q-Trust App Scanner
 *
 * SECURITY: no credentials belong in this file. The scanner token is
 * entered on the device during setup and lives only in the platform
 * keystore (expo-secure-store). A device with no token fails loudly.
 */

export const ENV = {
  // Default backend API URL (overridable in setup/settings)
  API_BASE_URL: 'https://q-trust.vercel.app',

  // API Endpoints
  ENDPOINTS: {
    CHECK_IN: '/api/attendance/check-in',
    HEARTBEAT: '/api/scanner/heartbeat',
  },

  // Request header names
  HEADERS: {
    SCANNER_TOKEN_NAME: 'x-scanner-token',
    DEVICE_ID_NAME: 'x-device-id',
  },
} as const;

export default ENV;
