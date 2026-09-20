import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createRecord } from "../lib/care-records";
import {
  addCareRecord,
  clearCareLog,
  clearCareRecords,
  deleteCareRecord,
  emptyCareLogData,
  getCareLog,
  seedDemoCareLog,
  saveCareLog,
  updateCareRecord,
} from "../lib/care-store";
import { bootstrapUsersIfEmpty } from "../lib/auth";

test("file store starts empty, persists added records, and can clear", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-store-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    const empty = await getCareLog(filePath);
    assert.deepEqual(empty, emptyCareLogData());

    const record = createRecord("temperature", {
      datetime: "2026-09-20T07:30",
      value: 36.9,
      site: "耳",
      recordedBy: "Warren",
      notes: "",
    });

    await addCareRecord(record, filePath);
    const saved = await getCareLog(filePath);

    assert.equal(saved.records.length, 1);
    assert.equal(saved.records[0].type, "temperature");
    assert.equal(saved.records[0].recordedBy, "Warren");

    await clearCareLog(filePath);
    assert.deepEqual(await getCareLog(filePath), emptyCareLogData());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("demo seed writes all MVP record types only when store is empty", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-demo-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    const seeded = await seedDemoCareLog(filePath);
    const types = new Set(seeded.records.map((record) => record.type));

    assert.deepEqual([...types].sort(), [
      "bloodPressure",
      "medication",
      "symptoms",
      "temperature",
      "weight",
    ]);

    await addCareRecord(
      createRecord("weight", {
        datetime: "2026-09-21T07:30",
        value: 61,
        clothing: "輕",
        recordedBy: "爸爸",
        notes: "",
      }),
      filePath,
    );

    const notReplaced = await seedDemoCareLog(filePath);
    assert.equal(notReplaced.records.length, seeded.records.length + 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("demo seed preserves users when adding sample records", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-demo-users-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const seeded = await seedDemoCareLog(filePath);

    assert.equal(seeded.records.length > 0, true);
    assert.deepEqual(seeded.users.map((user) => user.username), ["warren"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("clearing care records preserves family user accounts", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-clear-records-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    await addCareRecord(
      createRecord("temperature", {
        datetime: "2026-09-20T07:30",
        value: 36.9,
        site: "耳",
        recordedBy: "Warren",
        notes: "",
      }),
      filePath,
    );

    const cleared = await clearCareRecords(filePath);

    assert.equal(cleared.records.length, 0);
    assert.deepEqual(cleared.users.map((user) => user.username), ["warren"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("records can be updated and deleted", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-edit-records-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    const record = await addCareRecord(
      createRecord("temperature", {
        datetime: "2026-09-20T07:30",
        value: 36.9,
        site: "耳",
        recordedBy: "Warren",
        notes: "",
      }),
      filePath,
    );

    const updated = await updateCareRecord(
      record.id,
      (current) => ({
        ...current,
        notes: "重測確認",
        lastEditedBy: "姐姐",
        lastEditedAt: "2026-09-20T08:00:00.000Z",
      }),
      filePath,
    );

    assert.equal(updated?.notes, "重測確認");
    assert.equal(updated?.lastEditedBy, "姐姐");
    assert.equal((await getCareLog(filePath)).records.length, 1);

    const deleted = await deleteCareRecord(record.id, filePath);
    assert.equal(deleted?.id, record.id);
    assert.equal((await getCareLog(filePath)).records.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("legacy usernames sister and dad migrate to vickie and fanlee", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-user-migration-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    const now = "2026-09-20T08:00:00.000Z";
    await saveCareLog(
      {
        ...emptyCareLogData(),
        users: [
          {
            id: "u1",
            username: "sister",
            displayName: "姐姐",
            passwordHash: "scrypt$legacy",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "u2",
            username: "dad",
            displayName: "爸爸",
            passwordHash: "scrypt$legacy",
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      filePath,
    );

    const data = await getCareLog(filePath);
    assert.deepEqual(data.users.map((user) => user.username), [
      "vickie",
      "fanlee",
    ]);
    assert.deepEqual(data.users.map((user) => user.displayName), ["姐姐", "爸爸"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
