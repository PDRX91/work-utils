import bcrypt from "bcryptjs";
import { getDb } from "./db.js";
import crypto from "crypto";

const SESSION_DURATION_HOURS = 24; // Sessions last 24 hours

export async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

export async function createSession(userId) {
  const db = await getDb();
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
  );

  await db.run(
    "INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)",
    [sessionId, userId, expiresAt.toISOString()]
  );

  return sessionId;
}

export async function validateSession(sessionId) {
  if (!sessionId) return null;

  const db = await getDb();
  const session = await db.get(
    'SELECT * FROM sessions WHERE session_id = ? AND expires_at > datetime("now")',
    [sessionId]
  );

  return session;
}

export async function deleteSession(sessionId) {
  const db = await getDb();
  await db.run("DELETE FROM sessions WHERE session_id = ?", [sessionId]);
}

export async function initializeUser(password) {
  const db = await getDb();

  // Check if user already exists
  const existingUser = await db.get("SELECT * FROM users LIMIT 1");
  if (existingUser) {
    throw new Error("User already exists");
  }

  const passwordHash = await hashPassword(password);
  const result = await db.run("INSERT INTO users (password_hash) VALUES (?)", [
    passwordHash,
  ]);

  return result.lastID;
}

export async function authenticateUser(password) {
  const db = await getDb();
  const user = await db.get("SELECT * FROM users LIMIT 1");

  if (!user) {
    throw new Error("No user found. Please initialize the system first.");
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error("Invalid password");
  }

  return user.id;
}

export function requireAuth(handler) {
  return async (request) => {
    const sessionId = request.headers.get("x-session-id");

    if (!sessionId) {
      return Response.json({ error: "No session provided" }, { status: 401 });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    return handler(request);
  };
}
