import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { bootstrapUsersIfEmpty } from "../lib/auth";
import { createRecord } from "../lib/care-records";
import { addCareRecord, emptyCareLogData, getCareLog, saveCareLog } from "../lib/care-store";
import {
  bindLineUser,
  buildDueRemindersFlexMessage,
  buildTodayRecordsFlexMessage,
  createCareRecordFromLineText,
  createLineBindCode,
  findLineBinding,
  formatTodayRecordsSummary,
  getLineConversation,
  getLinePushTargets,
  isLineMenuCommand,
  isTodayRecordsCommand,
  setPendingLineInput,
  unbindLineConversation,
  verifyLineSignature,
} from "../lib/line";

test("line signature verification uses channel secret hmac sha256", () => {
  const body = JSON.stringify({ events: [] });
  const secret = "line-secret";
  const signature = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyLineSignature(body, signature, secret), true);
  assert.equal(verifyLineSignature(body, "bad", secret), false);
});

test("line conversation prefers group or room id over sender userId", () => {
  assert.deepEqual(
    getLineConversation({ type: "group", groupId: "Cgroup", userId: "Usender" }),
    { conversationId: "Cgroup", sourceType: "group", senderUserId: "Usender" },
  );
  assert.deepEqual(
    getLineConversation({ type: "room", roomId: "Rroom", userId: "Usender" }),
    { conversationId: "Rroom", sourceType: "room", senderUserId: "Usender" },
  );
  assert.deepEqual(
    getLineConversation({ type: "user", userId: "Uone" }),
    { conversationId: "Uone", sourceType: "user", senderUserId: "Uone" },
  );
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
    assert.equal(binding?.sourceType, "user");

    await setPendingLineInput("line-user-1", "bloodGlucose");
    const result = await createCareRecordFromLineText("line-user-1", "110 飯前");
    assert.equal(result.ok, true);

    const saved = await getCareLog(filePath);
    assert.equal(saved.records.at(-1)?.type, "bloodGlucose");
    assert.deepEqual(getLinePushTargets(saved), ["line-user-1"]);
  } finally {
    if (previousDataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previousDataFile;
    await rm(dir, { recursive: true, force: true });
  }
});

test("group bind code stores groupId and group pending creates a record", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-group-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const code = await createLineBindCode(data.users[0].id, data.users[0].displayName);

    const binding = await bindLineUser("Cfamily-group", code.code, "group");
    assert.equal(binding?.lineUserId, "Cfamily-group");
    assert.equal(binding?.sourceType, "group");

    await setPendingLineInput("Cfamily-group", "temperature");
    const result = await createCareRecordFromLineText("Cfamily-group", "36.8", "Uunbound-sender");
    assert.equal(result.ok, true);

    const saved = await getCareLog(filePath);
    assert.equal(saved.records.at(-1)?.type, "temperature");
    assert.equal(saved.linePendingInputs.length, 0);
    assert.deepEqual(getLinePushTargets(saved), ["Cfamily-group"]);
  } finally {
    if (previousDataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previousDataFile;
    await rm(dir, { recursive: true, force: true });
  }
});

test("group quick-log falls back to sender user binding when group is unbound", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-fallback-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const code = await createLineBindCode(data.users[0].id, data.users[0].displayName);
    await bindLineUser("Uwarren", code.code, "user");

    const resolved = findLineBinding(await getCareLog(filePath), "Cunbound-group", "Uwarren");
    assert.equal(resolved?.lineUserId, "Uwarren");
    assert.equal(findLineBinding(await getCareLog(filePath), "Cunbound-group")?.lineUserId, undefined);

    await setPendingLineInput("Cunbound-group", "medication");
    const result = await createCareRecordFromLineText("Cunbound-group", "心律整錠 是", "Uwarren");
    assert.equal(result.ok, true);

    const saved = await getCareLog(filePath);
    const last = saved.records.at(-1);
    assert.equal(last?.type, "medication");
    assert.equal(last && last.type === "medication" ? last.confirmedBy : "", "Warren");
  } finally {
    if (previousDataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previousDataFile;
    await rm(dir, { recursive: true, force: true });
  }
});

test("group binding is preferred over sender user binding", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-prefer-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await bootstrapUsersIfEmpty(
      "warren:alpha:Warren,vickie:bravo:姐姐",
      filePath,
    );
    const data = await getCareLog(filePath);
    const warrenCode = await createLineBindCode(data.users[0].id, data.users[0].displayName);
    await bindLineUser("Uwarren", warrenCode.code, "user");
    const groupCode = await createLineBindCode(data.users[1].id, data.users[1].displayName);
    await bindLineUser("Cfamily-group", groupCode.code, "group");

    const resolved = findLineBinding(await getCareLog(filePath), "Cfamily-group", "Uwarren");
    assert.equal(resolved?.sourceType, "group");
    assert.equal(resolved?.displayName, "姐姐");
  } finally {
    if (previousDataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previousDataFile;
    await rm(dir, { recursive: true, force: true });
  }
});

test("leave unbinds a group conversation without removing 1:1 binding", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-leave-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const userCode = await createLineBindCode(data.users[0].id, data.users[0].displayName);
    await bindLineUser("Uwarren", userCode.code, "user");
    const groupCode = await createLineBindCode(data.users[0].id, data.users[0].displayName);
    await bindLineUser("Cfamily-group", groupCode.code, "group");
    await setPendingLineInput("Cfamily-group", "temperature");

    await unbindLineConversation("Cfamily-group");
    const saved = await getCareLog(filePath);
    assert.equal(saved.lineBindings.some((item) => item.lineUserId === "Cfamily-group"), false);
    assert.equal(saved.lineBindings.some((item) => item.lineUserId === "Uwarren"), true);
    assert.equal(saved.linePendingInputs.length, 0);
  } finally {
    if (previousDataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previousDataFile;
    await rm(dir, { recursive: true, force: true });
  }
});

test("today records commands and summary cover vitals, meds, and symptoms", async () => {
  assert.equal(isTodayRecordsCommand("顯示紀錄"), true);
  assert.equal(isTodayRecordsCommand("今日紀錄"), true);
  assert.equal(isTodayRecordsCommand("紀錄"), true);
  assert.equal(isTodayRecordsCommand("記錄"), false);
  assert.equal(isLineMenuCommand("記錄"), true);

  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-today-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await addCareRecord(
      createRecord("temperature", {
        datetime: "2026-09-20T07:30",
        value: 36.8,
        site: "耳",
        recordedBy: "Warren",
      }),
      filePath,
    );
    await addCareRecord(
      createRecord("bloodPressure", {
        datetime: "2026-09-20T07:35",
        systolic: 124,
        diastolic: 78,
        pulse: 82,
        posture: "坐",
        recordedBy: "爸爸",
      }),
      filePath,
    );
    await addCareRecord(
      createRecord("bloodGlucose", {
        datetime: "2026-09-20T07:45",
        value: 104,
        mealTiming: "飯前",
        recordedBy: "Warren",
      }),
      filePath,
    );
    await addCareRecord(
      createRecord("medication", {
        datetime: "2026-09-20T07:10",
        drugName: "心律整錠",
        taken: true,
        confirmedBy: "Warren",
      }),
      filePath,
    );
    await addCareRecord(
      createRecord("symptoms", {
        datetime: "2026-09-20T20:30",
        recordedBy: "María",
        cleanDay: true,
        symptoms: [],
        severity: "無",
        clinicianNotified: false,
        soughtCare: false,
      }),
      filePath,
    );

    const summary = formatTodayRecordsSummary(
      await getCareLog(filePath),
      new Date("2026-09-20T12:00:00+08:00"),
    );
    assert.match(summary, /今日紀錄共 5 筆/);
    assert.match(summary, /體溫 36\.8°C/);
    assert.match(summary, /血壓 124\/78/);
    assert.match(summary, /血糖 104 飯前/);
    assert.match(summary, /吃藥 心律整錠 已吃/);
    assert.match(summary, /症狀 今日無異狀/);

    await addCareRecord(
      createRecord("weight", {
        datetime: "2026-09-20T21:00",
        value: 62.3,
        clothing: "輕",
        recordedBy: "姐姐",
      }),
      filePath,
    );

    const flex = buildTodayRecordsFlexMessage(
      await getCareLog(filePath),
      new Date("2026-09-20T12:00:00+08:00"),
    );
    assert.equal(flex.type, "flex");
    assert.equal(flex.contents.type, "bubble");
    const texts = collectFlexTexts(flex);
    assert.match(flex.altText, /今日紀錄共 6 筆/);
    assert.equal(texts.includes("今日紀錄"), true);
    assert.equal(texts.some((text) => text.includes("體溫") && texts.some((item) => item.includes("36.8"))), true);
    assert.equal(texts.some((text) => /36\.8°C/.test(text) || text.includes("36.8")), true);
    assert.equal(texts.some((text) => text.includes("血壓") || text.includes("124/78")), true);
    assert.equal(texts.some((text) => text.includes("124/78")), true);
    assert.equal(texts.some((text) => text.includes("血糖") && texts.some((item) => item.includes("104"))), true);
    assert.equal(texts.some((text) => text.includes("104") && text.includes("飯前")), true);
    assert.equal(texts.some((text) => text.includes("心律整錠")), true);
    assert.equal(texts.some((text) => text.includes("今日無異狀")), true);
    assert.equal(texts.some((text) => text.includes("62.3") && text.includes("kg")), true);
    assert.equal(texts.some((text) => /\d{2}:\d{2}/.test(text)), true);
  } finally {
    if (previousDataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previousDataFile;
    await rm(dir, { recursive: true, force: true });
  }
});

test("today records flex empty state is a card, not plain text", async () => {
  const flex = buildTodayRecordsFlexMessage(emptyCareLogData(), new Date("2026-09-20T12:00:00+08:00"));
  assert.equal(flex.type, "flex");
  assert.equal(flex.contents.type, "bubble");
  assert.match(flex.altText, /今日尚無紀錄/);
  assert.equal(collectFlexTexts(flex).includes("今日尚無紀錄"), true);
});

test("today records flex uses a carousel when there are many items", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-flex-many-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    for (let hour = 0; hour < 12; hour += 1) {
      await addCareRecord(
        createRecord("temperature", {
          datetime: `2026-09-20T${String(hour).padStart(2, "0")}:00`,
          value: 36.5 + hour / 10,
          site: "耳",
          recordedBy: "Warren",
        }),
        filePath,
      );
    }

    const flex = buildTodayRecordsFlexMessage(
      await getCareLog(filePath),
      new Date("2026-09-20T12:00:00+08:00"),
    );
    assert.equal(flex.type, "flex");
    assert.equal(flex.contents.type, "carousel");
    assert.equal(Array.isArray(flex.contents.contents), true);
    assert.equal((flex.contents.contents as unknown[]).length > 1, true);
    assert.equal((flex.contents.contents as { type: string }[]).every((item) => item.type === "bubble"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("due reminder flex lists titles and times, and skips empty push", () => {
  assert.equal(buildDueRemindersFlexMessage([]), null);

  const flex = buildDueRemindersFlexMessage([
    {
      id: "r1",
      type: "量血糖",
      dueAt: "2026-09-20T18:00",
      recurrence: "none",
      notes: "晚餐前",
      completed: false,
      recordedBy: "Warren",
      createdAt: "2026-09-20T08:00:00.000Z",
    },
    {
      id: "r2",
      type: "吃藥",
      dueAt: "2026-09-21T07:10",
      recurrence: "daily",
      notes: "",
      completed: false,
      recordedBy: "姐姐",
      createdAt: "2026-09-20T08:00:00.000Z",
    },
  ]);
  assert.equal(flex?.type, "flex");
  assert.equal(flex?.contents.type, "bubble");
  assert.match(flex?.altText ?? "", /未來 48 小時有 2 項待辦/);
  const texts = collectFlexTexts(flex);
  assert.equal(texts.includes("量血糖"), true);
  assert.equal(texts.includes("吃藥"), true);
  assert.equal(texts.some((text) => text.includes("晚餐前")), true);
  assert.equal(texts.some((text) => /\d{2}:\d{2}/.test(text)), true);
});

test("due reminder flex uses a carousel when there are many items", () => {
  const reminders = Array.from({ length: 12 }, (_, index) => ({
    id: `r${index}`,
    type: "其他" as const,
    dueAt: `2026-09-20T${String(index).padStart(2, "0")}:00`,
    recurrence: "none" as const,
    notes: `待辦 ${index + 1}`,
    completed: false,
    recordedBy: "Warren",
    createdAt: "2026-09-20T08:00:00.000Z",
  }));
  const flex = buildDueRemindersFlexMessage(reminders);
  assert.equal(flex?.type, "flex");
  assert.equal(flex?.contents.type, "carousel");
  assert.equal((flex?.contents.contents as unknown[]).length > 1, true);
});

function collectFlexTexts(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const value = node as Record<string, unknown>;
  const texts = typeof value.text === "string" ? [value.text] : [];
  if (typeof value.altText === "string") texts.push(value.altText);
  for (const child of ["contents", "header", "hero", "body", "footer"] as const) {
    const next = value[child];
    if (Array.isArray(next)) {
      for (const item of next) texts.push(...collectFlexTexts(item));
    } else if (next) {
      texts.push(...collectFlexTexts(next));
    }
  }
  return texts;
}

test("legacy line bindings without sourceType normalize to user", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-legacy-"));
  const filePath = path.join(dir, "carelog.json");

  try {
    await saveCareLog(
      {
        ...emptyCareLogData(),
        lineBindings: [
          {
            id: "b1",
            userId: "u1",
            lineUserId: "Ulegacy",
            displayName: "Warren",
            createdAt: "2026-09-20T08:00:00.000Z",
          } as never,
        ],
      },
      filePath,
    );

    const data = await getCareLog(filePath);
    assert.equal(data.lineBindings[0]?.sourceType, "user");
    assert.equal(data.lineBindings[0]?.lineUserId, "Ulegacy");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
