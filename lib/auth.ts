import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

import type { AuthSession, CareLogData, UserAccount } from "./care-records";
import { getCareLog, saveCareLog } from "./care-store";
export { SESSION_COOKIE_NAME } from "./auth-constants";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SESSION_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000;

export type BootstrapUser = {
  username: string;
  password: string;
  displayName: string;
};

export type AuthResult =
  | {
      ok: true;
      user: UserAccount;
      sessionToken: string;
    }
  | {
      ok: false;
      reason: "invalid" | "locked" | "not_configured";
      lockedUntil?: string;
    };

export function parseBootstrapUsers(spec: string): BootstrapUser[] {
  return spec
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [username, password, ...displayNameParts] = entry.split(":");
      const displayName = displayNameParts.join(":");

      if (!username?.trim() || !password || !displayName.trim()) {
        throw new Error(
          "CARELOG_BOOTSTRAP_USERS must use username:password:DisplayName entries",
        );
      }

      return {
        username: username.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
      };
    });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptKey(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, n, r, p, saltText, keyText] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !saltText || !keyText) {
    return false;
  }

  const key = Buffer.from(keyText, "base64url");
  const derived = await scryptKey(
    password,
    Buffer.from(saltText, "base64url"),
    key.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    },
  );

  return key.length === derived.length && timingSafeEqual(key, derived);
}

export async function bootstrapUsersIfEmpty(spec: string, filePath?: string) {
  const users = parseBootstrapUsers(spec);
  const data = await getCareLog(filePath);

  if (data.users.length > 0) {
    return false;
  }

  const now = new Date().toISOString();
  const nextUsers: UserAccount[] = [];

  for (const user of users) {
    nextUsers.push({
      id: createId(),
      username: user.username,
      displayName: user.displayName,
      passwordHash: await hashPassword(user.password),
      createdAt: now,
      updatedAt: now,
    });
  }

  await saveCareLog({ ...data, users: nextUsers }, filePath);
  return true;
}

export async function ensureBootstrapUsers(filePath?: string) {
  const data = await getCareLog(filePath);

  if (data.users.length > 0) {
    return false;
  }

  const spec = process.env.CARELOG_BOOTSTRAP_USERS;

  if (!spec) {
    return false;
  }

  return bootstrapUsersIfEmpty(spec, filePath);
}

export async function authenticateUser(
  username: string,
  password: string,
  filePath?: string,
  now = new Date(),
): Promise<AuthResult> {
  await ensureBootstrapUsers(filePath);

  const data = pruneExpiredSessions(await getCareLog(filePath), now);
  const normalizedUsername = username.trim().toLowerCase();
  const lockout = getLockout(data, normalizedUsername, now);

  if (lockout.locked) {
    return { ok: false, reason: "locked", lockedUntil: lockout.lockedUntil };
  }

  const user = data.users.find(
    (candidate) => candidate.username === normalizedUsername,
  );

  if (!user) {
    await saveFailedAttempt(data, normalizedUsername, filePath, now);
    return { ok: false, reason: data.users.length === 0 ? "not_configured" : "invalid" };
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    await saveFailedAttempt(data, normalizedUsername, filePath, now);
    return { ok: false, reason: "invalid" };
  }

  const session = makeSession(user.id, now);
  const next = {
    ...data,
    sessions: [...data.sessions, session.record],
    loginAttempts: data.loginAttempts.filter(
      (attempt) => attempt.username !== normalizedUsername,
    ),
  };

  await saveCareLog(next, filePath);

  return { ok: true, user, sessionToken: session.token };
}

export async function createSession(
  userId: string,
  filePath?: string,
  now = new Date(),
) {
  const data = pruneExpiredSessions(await getCareLog(filePath), now);
  const session = makeSession(userId, now);

  await saveCareLog(
    {
      ...data,
      sessions: [...data.sessions, session.record],
    },
    filePath,
  );

  return session.token;
}

export async function getUserBySessionToken(
  token?: string,
  filePath?: string,
  now = new Date(),
) {
  if (!token) {
    return null;
  }

  await ensureBootstrapUsers(filePath);

  const data = pruneExpiredSessions(await getCareLog(filePath), now);
  const tokenHash = hashSessionToken(token);
  const session = data.sessions.find(
    (candidate) =>
      candidate.tokenHash === tokenHash &&
      new Date(candidate.expiresAt).getTime() > now.getTime(),
  );

  if (!session) {
    return null;
  }

  return data.users.find((user) => user.id === session.userId) ?? null;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
  filePath?: string,
) {
  if (nextPassword.length < 8) {
    return { ok: false, reason: "too_short" as const };
  }

  const data = await getCareLog(filePath);
  const user = data.users.find((candidate) => candidate.id === userId);

  if (!user) {
    return { ok: false, reason: "not_found" as const };
  }

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return { ok: false, reason: "invalid_current" as const };
  }

  const now = new Date().toISOString();
  const updatedUser = {
    ...user,
    passwordHash: await hashPassword(nextPassword),
    updatedAt: now,
  };

  await saveCareLog(
    {
      ...data,
      users: data.users.map((candidate) =>
        candidate.id === user.id ? updatedUser : candidate,
      ),
    },
    filePath,
  );

  return { ok: true as const };
}

export async function deleteSession(token?: string, filePath?: string) {
  if (!token) {
    return;
  }

  const data = await getCareLog(filePath);
  const tokenHash = hashSessionToken(token);

  await saveCareLog(
    {
      ...data,
      sessions: data.sessions.filter((session) => session.tokenHash !== tokenHash),
    },
    filePath,
  );
}

function makeSession(userId: string, now: Date) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const record: AuthSession = {
    id: createId(),
    userId,
    tokenHash: hashSessionToken(token),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  return { token, record };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getLockout(data: CareLogData, username: string, now: Date) {
  const recent = data.loginAttempts.filter(
    (attempt) =>
      attempt.username === username &&
      now.getTime() - new Date(attempt.failedAt).getTime() <= LOCKOUT_WINDOW_MS,
  );

  if (recent.length < MAX_FAILED_ATTEMPTS) {
    return { locked: false as const };
  }

  const newest = recent.reduce((latest, attempt) =>
    new Date(attempt.failedAt) > new Date(latest.failedAt) ? attempt : latest,
  );
  const lockedUntil = new Date(
    new Date(newest.failedAt).getTime() + LOCKOUT_DURATION_MS,
  );

  return lockedUntil.getTime() > now.getTime()
    ? { locked: true as const, lockedUntil: lockedUntil.toISOString() }
    : { locked: false as const };
}

async function saveFailedAttempt(
  data: CareLogData,
  username: string,
  filePath: string | undefined,
  now: Date,
) {
  const cutoff = now.getTime() - LOCKOUT_WINDOW_MS;
  await saveCareLog(
    {
      ...data,
      loginAttempts: [
        ...data.loginAttempts.filter(
          (attempt) => new Date(attempt.failedAt).getTime() >= cutoff,
        ),
        { username, failedAt: now.toISOString() },
      ],
    },
    filePath,
  );
}

function pruneExpiredSessions(data: CareLogData, now: Date) {
  return {
    ...data,
    sessions: data.sessions.filter(
      (session) => new Date(session.expiresAt).getTime() > now.getTime(),
    ),
  };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? randomBytes(16).toString("hex");
}

function scryptKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });
}
