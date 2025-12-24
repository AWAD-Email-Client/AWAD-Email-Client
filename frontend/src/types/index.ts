export interface User {
  id: string;
  email: string;
  name: string;
  googleId?: string;
}

export interface AuthResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface GoogleAuthRequest {
  credential: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface Mailbox {
  id: string;
  name: string;
  userId: string;
  icon: string;
  unreadCount: number;
}

export interface EmailAddress {
  name: string;
  email: string;
}

export interface Attachment {
  id?: string;
  name: string;
  size: string;
  type: string;
}

export type EmailStatus = string; // Allow any custom Kanban column status

export interface Email {
  id: string;
  mailboxId: string;
  userId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  body: string;
  preview: string;
  isRead: boolean;
  isStarred: boolean;
  timestamp: string;
  attachments: Attachment[];
  status: EmailStatus;
  snoozeUntil: string | null;
  summary: string | null;
  gmailLink: string | null;
}

export interface ApiError {
  success: boolean;
  message: string;
  code?: string;
}
