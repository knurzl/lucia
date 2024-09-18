import type {
  RegisteredDatabaseSessionAttributes,
  RegisteredDatabaseUserAttributes,
  UserId
} from "./index.js";

export interface Adapter {
  getSessionAndUser(
    sessionId: string,
    schema?: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]>;
  getUserSessions(userId: UserId, schema?: string): Promise<DatabaseSession[]>;
  setSession(session: DatabaseSession, schema?: string): Promise<void>;
  updateSessionExpiration(sessionId: string, expiresAt: Date, schema?: string): Promise<void>;
  deleteSession(sessionId: string, schema?: string): Promise<void>;
  deleteUserSessions(userId: UserId, schema?: string): Promise<void>;
  deleteExpiredSessions(schema?: string): Promise<void>;
}

export interface DatabaseUser {
  id: UserId;
  attributes: RegisteredDatabaseUserAttributes;
}

export interface DatabaseSession {
  userId: UserId;
  expiresAt: Date;
  id: string;
  attributes: RegisteredDatabaseSessionAttributes;
}
