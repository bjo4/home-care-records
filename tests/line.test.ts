import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { bootstrapUsersIfEmpty } from "../lib/auth";
import { createRecord, type VisitRecord } from "../lib/care-records";
import { addCareRecord, emptyCareLogData, getCareLog, saveCareLog } from "../lib/care-store";
import {
  bindLineUser,
  buildAgendaFlexMessage,
  buildDueRemindersFlexMessage,
  buildMenuFlexMessage,
  buildTodayRecordsFlexMessage,
  buildVisitDetailFlexMessage,
  buildVisitRecordsFlexMessage,
  createCareRecordFromLineText,
  createLineBindCode,
  findLineBinding,
  formatTodayRecordsSummary,
  getLineConversation,
  getLinePushTargets,
  isAgendaCommand,
  isLineMenuCommand,
  isTodayRecordsCommand,
  isVisitRecordsCommand,
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

    await setPendingLineInput("line-user-1", "bloodOxygen");
    const oxygenResult = await createCareRecordFromLineText("line-user-1", "98 72");
    assert.equal(oxygenResult.ok, true);

    const saved = await getCareLog(filePath);
    const last = saved.records.at(-1);
    assert.equal(last?.type, "bloodOxygen");
    assert.equal(last && last.type === "bloodOxygen" ? last.value : undefined, 98);
    assert.equal(last && last.type === "bloodOxygen" ? last.pulse : undefined, 72);
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

test("line pending blood oxygen parses value-only, optional pulse, and rejects junk", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-spo2-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const code = await createLineBindCode(data.users[0].id, data.users[0].displayName);
    await bindLineUser("line-user-spo2", code.code);

    await setPendingLineInput("line-user-spo2", "bloodOxygen");
    const valueOnly = await createCareRecordFromLineText("line-user-spo2", "98.5");
    assert.equal(valueOnly.ok, true);
    const afterValueOnly = await getCareLog(filePath);
    const first = afterValueOnly.records.at(-1);
    assert.equal(first?.type, "bloodOxygen");
    assert.equal(first && first.type === "bloodOxygen" ? first.value : undefined, 98.5);
    assert.equal(first && first.type === "bloodOxygen" ? first.pulse : undefined, undefined);
    assert.equal(first?.abnormal, false);

    await setPendingLineInput("line-user-spo2", "bloodOxygen");
    const invalid = await createCareRecordFromLineText("line-user-spo2", "abc");
    assert.equal(invalid.ok, false);
    assert.match(invalid.message, /格式不正確/);
    assert.equal((await getCareLog(filePath)).linePendingInputs.length, 1);

    await setPendingLineInput("line-user-spo2", "bloodOxygen");
    const low = await createCareRecordFromLineText("line-user-spo2", "94");
    assert.equal(low.ok, true);
    const last = (await getCareLog(filePath)).records.at(-1);
    assert.equal(last && last.type === "bloodOxygen" ? last.abnormal : undefined, true);
  } finally {
    if (previousDataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previousDataFile;
    await rm(dir, { recursive: true, force: true });
  }
});

test("line text without pending or binding is silent instead of nagging", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-silent-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const code = await createLineBindCode(data.users[0].id, data.users[0].displayName);
    await bindLineUser("Cfamily-group", code.code, "group");

    const unbound = await createCareRecordFromLineText("Cunbound-group", "今晚吃什麼");
    assert.equal(unbound.ok, false);
    assert.equal(unbound.silent, true);

    const noPending = await createCareRecordFromLineText("Cfamily-group", "今晚吃什麼", "Usender");
    assert.equal(noPending.ok, false);
    assert.equal(noPending.silent, true);

    const saved = await getCareLog(filePath);
    assert.equal(saved.records.length, 0);
    assert.equal(saved.linePendingInputs.length, 0);
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

test("menu flex uses emoji labels and includes 未來行程與看診紀錄 under 查看", () => {
  const menu = buildMenuFlexMessage();
  assert.equal(menu.type, "flex");
  assert.match(menu.altText, /CareLog/);
  assert.match(menu.altText, /快速記錄|今日紀錄|未來行程|看診紀錄|選單/);

  const texts = collectFlexTexts(menu);
  assert.equal(texts.some((text) => text.includes("快速記錄")), true);
  assert.equal(texts.some((text) => text.includes("查看")), true);
  assert.equal(texts.includes("顯示紀錄"), false);

  const buttons = collectFlexButtons(menu);
  assert.deepEqual(
    buttons
      .filter((button) => button.data.startsWith("action=quick"))
      .map((button) => ({ label: button.label, data: button.data, style: button.style })),
    [
      { label: "🌡️ 體溫", data: "action=quick&type=temperature", style: "secondary" },
      { label: "🩺 血壓", data: "action=quick&type=bloodPressure", style: "secondary" },
      { label: "🩸 血糖", data: "action=quick&type=bloodGlucose", style: "secondary" },
      { label: "🫁 血氧", data: "action=quick&type=bloodOxygen", style: "secondary" },
      { label: "💊 吃藥", data: "action=quick&type=medication", style: "secondary" },
      { label: "✅ 今日無異狀", data: "action=quick&type=cleanDay", style: "primary" },
    ],
  );

  const recordButtons = buttons.filter((button) => button.data === "action=records");
  assert.equal(recordButtons.length, 1);
  assert.equal(recordButtons[0]?.label, "📋 今日紀錄");

  const agendaButtons = buttons.filter((button) => button.data === "action=agenda");
  assert.equal(agendaButtons.length, 1);
  assert.equal(agendaButtons[0]?.label, "📅 未來行程");

  const visitButtons = buttons.filter((button) => button.data === "action=visits");
  assert.equal(visitButtons.length, 1);
  assert.equal(visitButtons[0]?.label, "🏥 看診紀錄");
  assert.equal(buttons.some((button) => button.label === "顯示紀錄"), false);
  assert.equal(collectFlexSeparators(menu) >= 1, true);
});

test("agenda commands accept 未來行程 aliases", () => {
  assert.equal(isAgendaCommand("未來行程"), true);
  assert.equal(isAgendaCommand("行程"), true);
  assert.equal(isAgendaCommand("行程表"), true);
  assert.equal(isAgendaCommand("今日紀錄"), false);
  assert.equal(isAgendaCommand("選單"), false);
});

test("visit commands accept 看診 and 看診紀錄", () => {
  assert.equal(isVisitRecordsCommand("看診"), true);
  assert.equal(isVisitRecordsCommand("看診紀錄"), true);
  assert.equal(isVisitRecordsCommand(" 看診紀錄 "), true);
  assert.equal(isVisitRecordsCommand("今日紀錄"), false);
  assert.equal(isVisitRecordsCommand("未來行程"), false);
  assert.equal(isVisitRecordsCommand("選單"), false);
  assert.equal(isTodayRecordsCommand("看診"), false);
  assert.equal(isAgendaCommand("看診紀錄"), false);
});

test("agenda flex empty state says 近期沒有行程", () => {
  const flex = buildAgendaFlexMessage(emptyCareLogData(), new Date("2026-09-20T12:00:00+08:00"));
  assert.equal(flex.type, "flex");
  assert.equal(flex.contents.type, "bubble");
  assert.match(flex.altText, /近期沒有行程/);
  assert.equal(collectFlexTexts(flex).includes("近期沒有行程"), true);
});

test("agenda flex lists reminders, exams, and visits for the next 7 days", () => {
  const data = {
    ...emptyCareLogData(),
    reminders: [
      {
        id: "r-soon",
        type: "量血糖" as const,
        dueAt: "2026-09-21T18:00",
        recurrence: "none" as const,
        notes: "晚餐前",
        completed: false,
        recordedBy: "Warren",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
      {
        id: "r-done",
        type: "吃藥" as const,
        dueAt: "2026-09-21T07:10",
        recurrence: "daily" as const,
        notes: "已完成不應出現",
        completed: true,
        recordedBy: "姐姐",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
      {
        id: "r-later",
        type: "回診" as const,
        dueAt: "2026-10-05T10:00",
        recurrence: "none" as const,
        notes: "超過 7 天",
        completed: false,
        recordedBy: "Warren",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
    ],
    exams: [
      {
        id: "e1",
        name: "胸部 X 光",
        datetime: "2026-09-22T09:30",
        location: "台大醫院",
        resultSummary: "",
        status: "待做" as const,
        recordedBy: "Warren",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
    ],
    visits: [
      {
        id: "v1",
        department: "心臟內科",
        date: "2026-08-01",
        doctor: "林醫師",
        instructions: "持續追蹤心律",
        followUpDate: "2026-09-24",
        recordedBy: "姐姐",
        createdAt: "2026-09-20T08:00:00.000Z",
      },
    ],
  };

  const flex = buildAgendaFlexMessage(data, new Date("2026-09-20T12:00:00+08:00"));
  assert.equal(flex.type, "flex");
  assert.equal(flex.contents.type, "bubble");
  assert.match(flex.altText, /未來行程共 3 筆/);
  const texts = collectFlexTexts(flex);
  assert.equal(texts.some((text) => text.includes("未來行程")), true);
  assert.equal(texts.some((text) => text.includes("提醒") && texts.some((item) => item.includes("量血糖"))), true);
  assert.equal(texts.some((text) => text.includes("量血糖")), true);
  assert.equal(texts.some((text) => text.includes("晚餐前")), true);
  assert.equal(texts.some((text) => text.includes("檢查") && texts.some((item) => item.includes("胸部 X 光"))), true);
  assert.equal(texts.some((text) => text.includes("胸部 X 光")), true);
  assert.equal(texts.some((text) => text.includes("回診") || text.includes("看診")), true);
  assert.equal(texts.some((text) => text.includes("心臟內科")), true);
  assert.equal(texts.some((text) => text.includes("已完成不應出現")), false);
  assert.equal(texts.some((text) => text.includes("超過 7 天")), false);
  assert.equal(texts.some((text) => /\d{2}:\d{2}|\d{2}\/\d{2}/.test(text)), true);

  const joined = texts.join("\n");
  const glucoseAt = joined.indexOf("量血糖");
  const examAt = joined.indexOf("胸部 X 光");
  const visitAt = joined.indexOf("心臟內科");
  assert.equal(glucoseAt >= 0 && examAt > glucoseAt && visitAt > examAt, true);
});

test("agenda flex uses a carousel when there are many items", () => {
  const data = {
    ...emptyCareLogData(),
    reminders: Array.from({ length: 12 }, (_, index) => ({
      id: `r${index}`,
      type: "其他" as const,
      dueAt: `2026-09-2${String(1 + (index % 6))}T${String(index).padStart(2, "0")}:00`,
      recurrence: "none" as const,
      notes: `行程 ${index + 1}`,
      completed: false,
      recordedBy: "Warren",
      createdAt: "2026-09-20T08:00:00.000Z",
    })),
  };

  const flex = buildAgendaFlexMessage(data, new Date("2026-09-20T12:00:00+08:00"));
  assert.equal(flex.type, "flex");
  assert.equal(flex.contents.type, "carousel");
  assert.equal(Array.isArray(flex.contents.contents), true);
  assert.equal((flex.contents.contents as unknown[]).length > 1, true);
  assert.equal(
    (flex.contents.contents as { type: string }[]).every((item) => item.type === "bubble"),
    true,
  );
});

test("visit list flex empty state is friendly", () => {
  const flex = buildVisitRecordsFlexMessage(emptyCareLogData());
  assert.equal(flex.type, "flex");
  assert.equal(flex.contents.type, "bubble");
  assert.match(flex.altText, /看診/);
  const texts = collectFlexTexts(flex);
  assert.equal(texts.some((text) => text.includes("看診紀錄")), true);
  assert.equal(texts.some((text) => /尚無|目前沒有/.test(text)), true);
});

test("visit list flex shows past and future visits newest first", () => {
  const data = {
    ...emptyCareLogData(),
    visits: [
      sampleVisit({
        id: "v-old",
        department: "家醫科",
        date: "2026-08-01",
        doctor: "陳醫師",
        instructions: "舊的回診",
      }),
      sampleVisit({
        id: "v-future",
        department: "心臟內科",
        date: "2026-10-05",
        doctor: "林醫師",
        instructions: "追蹤心律",
        followUpDate: "2026-11-01",
      }),
      sampleVisit({
        id: "v-recent",
        department: "神經內科",
        date: "2026-09-18",
        instructions: "調整用藥",
      }),
    ],
  };

  const flex = buildVisitRecordsFlexMessage(data);
  assert.equal(flex.type, "flex");
  assert.equal(flex.contents.type, "bubble");
  assert.match(flex.altText, /看診紀錄共 3 筆/);

  const texts = collectFlexTexts(flex);
  assert.equal(texts.some((text) => text.includes("看診紀錄")), true);
  assert.equal(texts.some((text) => text.includes("心臟內科")), true);
  assert.equal(texts.some((text) => text.includes("神經內科")), true);
  assert.equal(texts.some((text) => text.includes("家醫科")), true);
  assert.equal(texts.some((text) => text.includes("林醫師") || text.includes("追蹤心律")), true);

  const joined = texts.join("\n");
  const futureAt = joined.indexOf("心臟內科");
  const recentAt = joined.indexOf("神經內科");
  const oldAt = joined.indexOf("家醫科");
  assert.equal(futureAt >= 0 && recentAt > futureAt && oldAt > recentAt, true);

  const rowActions = collectFlexPostbacks(flex).filter(
    (item) => new URLSearchParams(item.data).get("action") === "visit",
  );
  assert.deepEqual(
    rowActions.map((item) => new URLSearchParams(item.data).get("id")),
    ["v-future", "v-recent", "v-old"],
  );
  assert.equal(rowActions.every((item) => new URLSearchParams(item.data).get("page") === "1"), true);
});

test("visit list flex paginates 8 items with prev and next postbacks", () => {
  const visits = Array.from({ length: 10 }, (_, index) =>
    sampleVisit({
      id: `v${index}`,
      department: `第${index + 1}科`,
      date: `2026-09-${String(21 - index).padStart(2, "0")}`,
      instructions: `摘要 ${index + 1}`,
    }),
  );
  const data = { ...emptyCareLogData(), visits };

  const page1 = buildVisitRecordsFlexMessage(data, 1);
  const page1Texts = collectFlexTexts(page1);
  assert.equal(page1Texts.some((text) => text.includes("第1科")), true);
  assert.equal(page1Texts.some((text) => text.includes("第8科")), true);
  assert.equal(page1Texts.some((text) => text.includes("第9科")), false);
  assert.match(page1Texts.join("\n"), /1\/2|看診紀錄（1\/2）/);

  const page1Buttons = collectFlexButtons(page1);
  assert.equal(page1Buttons.some((button) => button.label.includes("上一頁")), false);
  const next = page1Buttons.find((button) => button.label.includes("下一頁"));
  assert.equal(next?.data, "action=visits&page=2");

  const page2 = buildVisitRecordsFlexMessage(data, 2);
  const page2Texts = collectFlexTexts(page2);
  assert.equal(page2Texts.some((text) => text.includes("第9科")), true);
  assert.equal(page2Texts.some((text) => text.includes("第10科")), true);
  assert.equal(page2Texts.some((text) => text.includes("第1科")), false);
  const prev = collectFlexButtons(page2).find((button) => button.label.includes("上一頁"));
  assert.equal(prev?.data, "action=visits&page=1");
  assert.equal(
    collectFlexButtons(page2).some((button) => button.label.includes("下一頁")),
    false,
  );

  const overflow = buildVisitRecordsFlexMessage(data, 99);
  assert.equal(collectFlexTexts(overflow).some((text) => text.includes("第9科")), true);
});

test("visit detail flex mirrors stored fields and omits empty ones", () => {
  const full = sampleVisit({
    id: "v-full",
    department: "心臟內科",
    date: "2026-09-18",
    doctor: "林醫師",
    instructions: "持續追蹤心律，必要時調整藥量。",
    followUpDate: "2026-10-02",
    recordedBy: "姐姐",
    lastEditedBy: "Warren",
    lastEditedAt: "2026-09-19T10:00:00.000Z",
  });
  const flex = buildVisitDetailFlexMessage(full, 2);
  assert.equal(flex.type, "flex");
  assert.equal(flex.contents.type, "bubble");
  assert.match(flex.altText, /心臟內科|看診/);

  const texts = collectFlexTexts(flex);
  assert.equal(texts.some((text) => text.includes("心臟內科")), true);
  assert.equal(texts.some((text) => text.includes("林醫師")), true);
  assert.equal(texts.some((text) => text.includes("持續追蹤心律")), true);
  assert.equal(texts.some((text) => text.includes("2026") || text.includes("09") || text.includes("18")), true);
  assert.equal(texts.some((text) => text.includes("10") && (text.includes("02") || text.includes("2"))), true);
  assert.equal(texts.some((text) => text.includes("姐姐")), true);
  assert.equal(texts.some((text) => text.includes("Warren")), true);
  assert.equal(texts.some((text) => text.includes("undefined")), false);

  const back = collectFlexButtons(flex).find((button) => button.data.includes("action=visits"));
  assert.equal(back?.data, "action=visits&page=2");

  const sparse = buildVisitDetailFlexMessage(
    sampleVisit({
      id: "v-sparse",
      department: "家醫科",
      date: "2026-08-01",
      instructions: "追蹤血壓",
    }),
  );
  const sparseTexts = collectFlexTexts(sparse);
  assert.equal(sparseTexts.some((text) => text.includes("家醫科")), true);
  assert.equal(sparseTexts.some((text) => text.includes("追蹤血壓")), true);
  assert.equal(sparseTexts.some((text) => text.includes("醫師") && sparseTexts.some((item) => item.includes("林"))), false);
  assert.equal(sparseTexts.includes("undefined"), false);
  assert.equal(sparseTexts.includes(""), false);
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
      createRecord("bloodOxygen", {
        datetime: "2026-09-20T07:50",
        value: 97,
        pulse: 74,
        recordedBy: "姐姐",
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
    assert.match(summary, /今日紀錄共 6 筆/);
    assert.match(summary, /體溫 36\.8°C/);
    assert.match(summary, /血壓 124\/78/);
    assert.match(summary, /血糖 104 飯前/);
    assert.match(summary, /血氧 97%/);
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
    assert.match(flex.altText, /今日紀錄共 7 筆/);
    assert.equal(texts.includes("今日紀錄"), true);
    assert.equal(texts.some((text) => text.includes("體溫") && texts.some((item) => item.includes("36.8"))), true);
    assert.equal(texts.some((text) => /36\.8°C/.test(text) || text.includes("36.8")), true);
    assert.equal(texts.some((text) => text.includes("血壓") || text.includes("124/78")), true);
    assert.equal(texts.some((text) => text.includes("124/78")), true);
    assert.equal(texts.some((text) => text.includes("血糖") && texts.some((item) => item.includes("104"))), true);
    assert.equal(texts.some((text) => text.includes("104") && text.includes("飯前")), true);
    assert.equal(texts.some((text) => text.includes("血氧") && texts.some((item) => item.includes("97"))), true);
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

function sampleVisit(visit: Partial<VisitRecord> & Pick<VisitRecord, "id" | "department" | "date" | "instructions">) {
  return {
    recordedBy: "Warren",
    createdAt: "2026-09-20T08:00:00.000Z",
    ...visit,
  };
}

function collectFlexPostbacks(node: unknown): { label?: string; data: string }[] {
  if (!node || typeof node !== "object") return [];
  const value = node as Record<string, unknown>;
  const actions: { label?: string; data: string }[] = [];
  const action = value.action;
  if (
    action &&
    typeof action === "object" &&
    (action as { type?: unknown }).type === "postback" &&
    typeof (action as { data?: unknown }).data === "string"
  ) {
    actions.push({
      label: typeof (action as { label?: unknown }).label === "string"
        ? (action as { label: string }).label
        : undefined,
      data: (action as { data: string }).data,
    });
  }
  for (const child of walkFlexChildren(value)) actions.push(...collectFlexPostbacks(child));
  return actions;
}

function collectFlexTexts(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const value = node as Record<string, unknown>;
  const texts = typeof value.text === "string" ? [value.text] : [];
  if (typeof value.altText === "string") texts.push(value.altText);
  for (const child of walkFlexChildren(value)) texts.push(...collectFlexTexts(child));
  return texts;
}

function collectFlexButtons(node: unknown): { label: string; data: string; style?: string }[] {
  if (!node || typeof node !== "object") return [];
  const value = node as Record<string, unknown>;
  const buttons: { label: string; data: string; style?: string }[] = [];
  const action = value.action;
  if (
    value.type === "button" &&
    action &&
    typeof action === "object" &&
    typeof (action as { label?: unknown }).label === "string" &&
    typeof (action as { data?: unknown }).data === "string"
  ) {
    buttons.push({
      label: (action as { label: string }).label,
      data: (action as { data: string }).data,
      style: typeof value.style === "string" ? value.style : undefined,
    });
  }
  for (const child of walkFlexChildren(value)) buttons.push(...collectFlexButtons(child));
  return buttons;
}

function collectFlexSeparators(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  const value = node as Record<string, unknown>;
  let count = value.type === "separator" ? 1 : 0;
  for (const child of walkFlexChildren(value)) count += collectFlexSeparators(child);
  return count;
}

function walkFlexChildren(value: Record<string, unknown>): unknown[] {
  const children: unknown[] = [];
  for (const child of ["contents", "header", "hero", "body", "footer"] as const) {
    const next = value[child];
    if (Array.isArray(next)) children.push(...next);
    else if (next) children.push(next);
  }
  return children;
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
