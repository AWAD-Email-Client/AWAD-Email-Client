/**
 * API Module Exports
 * Central export point for all API modules
 */

// Export all auth API functions
export * as authAPI from "./auth.api";

// Export all mailboxes API functions
export * as mailboxesAPI from "./mailboxes.api";

// Export all emails API functions
export * as emailsAPI from "./emails.api";

// Export axios instance and utilities
export { default as apiClient } from "./axios";
export {
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearTokens,
} from "./axios";

// Re-export types for convenience
export type {
  SendEmailRequest,
  BulkActionRequest,
  SnoozeEmailRequest,
} from "./emails.api";
