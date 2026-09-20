import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  authenticateUser,
  bootstrapUsersIfEmpty,
  changePassword,
  createApiToken,
  getUserBySessionToken,
  hashPassword,
  parseBootstrapUsers,
  revokeApiToken,
  verifyApiToken,
  verifyPassword,
} from "../lib/auth";
import { getCareLog } from "../lib/care-store";

test("bootstrap parser accepts username:password:DisplayName entries", () => {
  assert.deepEqual(
    parseBootstrapUsers("warren:secret:Warren,vickie:p@ss:姐姐,fanlee:pw:爸爸,maria:hola:María"),
    [
      { username: "warren", password: "secret", displayName: "Warren" },
      { username: "vickie", password: "p@ss", displayName: "姐姐" },
      { username: "fanlee", password: "pw", displayName: "爸爸" },
      { username: "maria", password: "hola", displayName: "María" },
    ],
  );
});

test("passwords are scrypt hashed and verifiable without plaintext storage", async () => {
  const hash = await hashPassword("correct horse battery staple");

  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.includes("correct horse"), false);
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
});

test("bootstrap creates users only when no users exist", async () => {
  const { filePath, cleanup } = await tempCareLog();

  try {
    const created = await bootstrapUsersIfEmpty(
      "warren:alpha:Warren,vickie:beta:姐姐",
      filePath,
    );

    assert.equal(created, true);
    let data = await getCareLog(filePath);
    assert.deepEqual(
      data.users.map((user) => [user.username, user.displayName]),
      [
        ["warren", "Warren"],
        ["vickie", "姐姐"],
      ],
    );
    assert.equal(data.users[0].passwordHash.includes("alpha"), false);

    const second = await bootstrapUsersIfEmpty("fanlee:gamma:爸爸", filePath);
    data = await getCareLog(filePath);

    assert.equal(second, false);
    assert.deepEqual(data.users.map((user) => user.username), ["warren", "vickie"]);
  } finally {
    await cleanup();
  }
});

test("authenticate creates a session for valid password and rejects invalid attempts", async () => {
  const { filePath, cleanup } = await tempCareLog();

  try {
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);

    const rejected = await authenticateUser("warren", "bad", filePath);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, "invalid");

    const accepted = await authenticateUser("warren", "alpha", filePath);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.user.displayName, "Warren");
    assert.match(accepted.sessionToken, /^[a-f0-9]{64}$/);

    const user = await getUserBySessionToken(accepted.sessionToken, filePath);
    assert.equal(user?.username, "warren");
  } finally {
    await cleanup();
  }
});

test("failed login rate limit locks a username for a short window", async () => {
  const { filePath, cleanup } = await tempCareLog();
  const now = new Date("2026-09-20T04:00:00Z");

  try {
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);

    for (let index = 0; index < 5; index += 1) {
      const result = await authenticateUser("warren", "bad", filePath, now);
      assert.equal(result.ok, false);
    }

    const locked = await authenticateUser("warren", "alpha", filePath, now);
    assert.equal(locked.ok, false);
    assert.equal(locked.reason, "locked");

    const afterLockout = await authenticateUser(
      "warren",
      "alpha",
      filePath,
      new Date("2026-09-20T04:11:00Z"),
    );
    assert.equal(afterLockout.ok, true);
  } finally {
    await cleanup();
  }
});

test("logged-in users can change password with the current password", async () => {
  const { filePath, cleanup } = await tempCareLog();

  try {
    await bootstrapUsersIfEmpty("maria:hola:María", filePath);
    const login = await authenticateUser("maria", "hola", filePath);
    assert.equal(login.ok, true);

    const changed = await changePassword(
      login.user.id,
      "hola",
      "nuevo-secreto",
      filePath,
    );
    assert.equal(changed.ok, true);

    assert.equal((await authenticateUser("maria", "hola", filePath)).ok, false);
    assert.equal(
      (await authenticateUser("maria", "nuevo-secreto", filePath)).ok,
      true,
    );
  } finally {
    await cleanup();
  }
});

test("api tokens are shown once, hashed, verified, and revoked", async () => {
  const { filePath, cleanup } = await tempCareLog();

  try {
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const user = data.users[0];
    const created = await createApiToken(user.id, "Cursor MCP", filePath);

    assert.match(created.token, /^clr_/);
    assert.equal(created.record.prefix, created.token.slice(0, 12));
    assert.equal(created.record.tokenHash.includes(created.token), false);

    const verified = await verifyApiToken(created.token, filePath);
    assert.equal(verified?.user.username, "warren");

    const afterUse = await getCareLog(filePath);
    assert.equal(Boolean(afterUse.apiTokens[0].lastUsedAt), true);

    await revokeApiToken(user.id, created.record.id, filePath);
    assert.equal(await verifyApiToken(created.token, filePath), null);
  } finally {
    await cleanup();
  }
});

async function tempCareLog() {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-auth-"));
  const filePath = path.join(dir, "carelog.json");

  return {
    filePath,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
