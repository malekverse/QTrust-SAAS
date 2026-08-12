/**
 * API exports
 */

export { default as apiClient, isNetworkError, type ApiError } from './client';
export { 
  checkIn, 
  mockCheckIn, 
  performCheckIn,
  type CheckInRequest,
  type CheckInResponse,
} from './attendance';

