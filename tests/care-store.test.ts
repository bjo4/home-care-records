import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createRecord } from "../lib/care-records";
import {
  addCareRecord,
  addExam,
  addMedicationOrder,
  addReminder,
  addVisit,
  clearCareLog,
  clearCareRecords,
  deleteCareRecord,
  deleteExam,
  deleteMedicationOrder,
  deleteReminder,
  deleteVisit,
  emptyCareLogData,
  getCareLog,
  getDueReminders,
  seedDemoCareLog,
  saveCareLog,
  updateCareRecord,
  updateExam,
  updateMedicationOrder,
  updateReminder,
  updateVisit,
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
      "bloodGlucose",
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

test("reminders can be queried, completed, and deleted", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-reminders-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    await addReminder(
      {
        id: "r1",
        type: "量血糖",
        dueAt: "2026-09-20T10:00:00.000Z",
        recurrence: "daily",
        notes: "早餐後",
        completed: false,
        recordedBy: "Warren",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
      filePath,
    );
    await addReminder(
      {
        id: "r2",
        type: "回診",
        dueAt: "2026-09-25T10:00:00.000Z",
        recurrence: "none",
        notes: "",
        completed: false,
        recordedBy: "Warren",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
      filePath,
    );

    const due = getDueReminders(
      await getCareLog(filePath),
      new Date("2026-09-20T08:00:00.000Z"),
      48,
    );
    assert.deepEqual(due.map((reminder) => reminder.id), ["r1"]);

    const completed = await updateReminder(
      "r1",
      (reminder) => ({
        ...reminder,
        completed: true,
        completedAt: "2026-09-20T09:00:00.000Z",
        completedBy: "姐姐",
      }),
      filePath,
    );
    assert.equal(completed?.completedBy, "姐姐");
    assert.deepEqual(
      getDueReminders(await getCareLog(filePath), new Date("2026-09-20T08:00:00.000Z")).map(
        (reminder) => reminder.id,
      ),
      [],
    );
    assert.equal((await deleteReminder("r1", filePath))?.id, "r1");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("medication orders, exams, and visits support CRUD", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-care-plan-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    await addMedicationOrder(
      {
        id: "m1",
        drugName: "心律整錠",
        dose: "1 顆",
        frequency: "每日早上",
        route: "口服",
        scheduleHint: "早餐後",
        startDate: "2026-09-20",
        notes: "",
        precautions: "注意頭暈",
        status: "進行中",
        recordedBy: "Warren",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
      filePath,
    );
    await addExam(
      {
        id: "e1",
        name: "抽血",
        datetime: "2026-09-21T09:00",
        location: "醫院",
        resultSummary: "",
        status: "待做",
        recordedBy: "Warren",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
      filePath,
    );
    await addVisit(
      {
        id: "v1",
        department: "心臟科",
        date: "2026-09-22",
        doctor: "王醫師",
        instructions: "回診追蹤",
        recordedBy: "Warren",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
      filePath,
    );

    assert.equal((await updateMedicationOrder("m1", (order) => ({ ...order, status: "已停" }), filePath))?.status, "已停");
    assert.equal((await updateExam("e1", (exam) => ({ ...exam, status: "完成" }), filePath))?.status, "完成");
    assert.equal((await updateVisit("v1", (visit) => ({ ...visit, instructions: "調整用藥" }), filePath))?.instructions, "調整用藥");

    assert.equal((await deleteMedicationOrder("m1", filePath))?.id, "m1");
    assert.equal((await deleteExam("e1", filePath))?.id, "e1");
    assert.equal((await deleteVisit("v1", filePath))?.id, "v1");
    const data = await getCareLog(filePath);
    assert.equal(data.medicationOrders.length, 0);
    assert.equal(data.exams.length, 0);
    assert.equal(data.visits.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
