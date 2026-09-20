import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { bootstrapUsersIfEmpty } from "../lib/auth";
import { getCareLog } from "../lib/care-store";
import {
  bindLineUser,
  createCareRecordFromLineText,
  createLineBindCode,
  setPendingLineInput,
  verifyLineSignature,
} from "../lib/line";

test("line signature verification uses channel secret hmac sha256", () => {
  const body = JSON.stringify({ events: [] });
  const secret = "line-secret";
  const signature = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyLineSignature(body, signature, secret), true);
  assert.equal(verifyLineSignature(body, "bad", secret), false);
});

test("line bind code maps line user and text input creates care record", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const code = await createLineBindCode(data.users[0].id, data.users[0].displayName);

    const binding = await bindLineUser("line-user-1", code.code);
    assert.equal(binding?.displayName, "Warren");

    await setPendingLineInput("line-user-1", "bloodGlucose");
    const result = await createCareRecordFromLineText("line-user-1", "110 飯前");
    assert.equal(result.ok, true);

    const saved = await getCareLog(filePath);
    assert.equal(saved.records.at(-1)?.type, "bloodGlucose");
  } finally {
    if (previousDataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previousDataFile;
    await rm(dir, { recursive: true, force: true });
  }
});
