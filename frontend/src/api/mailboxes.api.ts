/**
 * Mailboxes API
 * Handles all mailbox-related API calls
 */

import apiClient from "./axios";
import type { Mailbox } from "../types";

// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Get all mailboxes for the current user
 */
export const fetchMailboxes = async (): Promise<Mailbox[]> => {
  const response = await apiClient.get<ApiResponse<Mailbox[]>>("/mailboxes");
  return response.data.data || [];
};

/**
 * Get a specific mailbox by ID
 */
export const fetchMailboxById = async (mailboxId: string): Promise<Mailbox> => {
  const response = await apiClient.get<ApiResponse<Mailbox>>(
    `/mailboxes/${mailboxId}`
  );
  return response.data.data!;
};

/**
 * Create a new mailbox/label
 */
export const createMailbox = async (data: {
  name: string;
  icon?: string;
}): Promise<Mailbox> => {
  const response = await apiClient.post<ApiResponse<Mailbox>>(
    "/mailboxes",
    data
  );
  return response.data.data!;
};

/**
 * Update mailbox details
 */
export const updateMailbox = async (
  mailboxId: string,
  data: Partial<Mailbox>
): Promise<Mailbox> => {
  const response = await apiClient.patch<ApiResponse<Mailbox>>(
    `/mailboxes/${mailboxId}`,
    data
  );
  return response.data.data!;
};

/**
 * Delete a mailbox
 */
export const deleteMailbox = async (mailboxId: string): Promise<void> => {
  await apiClient.delete(`/mailboxes/${mailboxId}`);
};

/**
 * Get mailbox statistics (total, unread, etc.)
 */
export const fetchMailboxStats = async (
  mailboxId: string
): Promise<{
  total: number;
  unread: number;
  starred: number;
}> => {
  const response = await apiClient.get<
    ApiResponse<{
      total: number;
      unread: number;
      starred: number;
    }>
  >(`/mailboxes/${mailboxId}/stats`);
  return response.data.data!;
};
