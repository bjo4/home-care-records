import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  createRecord,
  getTodayEntries,
  type CareLogData,
  type CareRecord,
  type CareReminder,
  type ExamRecord,
  type LineBinding,
  type LinePendingInput,
  type LineSourceType,
  type VisitRecord,
} from "@/lib/care-records";
import { addCareRecord, getCareLog, getDueReminders, saveCareLog } from "@/lib/care-store";

export type LineEventSource = {
  type?: string;
  userId?: string;
  groupId?: string;
  roomId?: string;
};

export type LineConversation = {
  conversationId: string;
  sourceType: LineSourceType;
  senderUserId?: string;
};

export type LineFlexBubble = {
  type: "bubble";
  body: {
    type: "box";
    layout: "vertical";
    spacing?: string;
    contents: unknown[];
  };
};

export type LineFlexCarousel = {
  type: "carousel";
  contents: LineFlexBubble[];
};

export type LineFlexMessage = {
  type: "flex";
  altText: string;
  contents: LineFlexBubble | LineFlexCarousel;
};

const FLEX_ITEMS_PER_BUBBLE = 8;
const FLEX_MAX_BUBBLES = 10;
const FLEX_ALT_TEXT_MAX = 400;
const AGENDA_HOURS_AHEAD = 7 * 24;

export type UpcomingAgendaItem = {
  datetime: string;
  type: string;
  title: string;
  notes: string;
};

export function verifyLineSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function getLineConversation(source?: LineEventSource): LineConversation | null {
  if (source?.type === "group" && source.groupId) {
    return {
      conversationId: source.groupId,
      sourceType: "group",
      senderUserId: source.userId,
    };
  }
  if (source?.type === "room" && source.roomId) {
    return {
      conversationId: source.roomId,
      sourceType: "room",
      senderUserId: source.userId,
    };
  }
  if (source?.userId) {
    return {
      conversationId: source.userId,
      sourceType: "user",
      senderUserId: source.userId,
    };
  }
  return null;
}

export function isLineMenuCommand(text: string) {
  return ["選單", "記錄", "menu"].includes(text.trim().toLowerCase());
}

export function isTodayRecordsCommand(text: string) {
  return ["紀錄", "今日紀錄", "顯示紀錄"].includes(text.trim());
}

export function isAgendaCommand(text: string) {
  return ["未來行程", "行程", "行程表"].includes(text.trim());
}

export async function createLineBindCode(userId: string, displayName: string) {
  const data = await getCareLog();
  const code = `CL-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date();
  const bindCode = {
    code,
    userId,
    displayName,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
  };
  await saveCareLog({
    ...data,
    lineBindCodes: [
      ...data.lineBindCodes.filter((item) => item.userId !== userId || item.usedAt),
      bindCode,
    ],
  });
  return bindCode;
}

export async function bindLineUser(
  conversationId: string,
  code: string,
  sourceType: LineSourceType = "user",
) {
  const data = await getCareLog();
  const now = new Date();
  const bindCode = data.lineBindCodes.find(
    (item) =>
      !item.usedAt &&
      item.code.toUpperCase() === code.trim().toUpperCase() &&
      new Date(item.expiresAt).getTime() >= now.getTime(),
  );
  if (!bindCode) return null;
  const binding: LineBinding = {
    id: createId(),
    userId: bindCode.userId,
    lineUserId: conversationId,
    sourceType,
    displayName: bindCode.displayName,
    createdAt: now.toISOString(),
  };
  await saveCareLog({
    ...data,
    lineBindings: [
      ...data.lineBindings.filter((item) => item.lineUserId !== conversationId),
      binding,
    ],
    lineBindCodes: data.lineBindCodes.map((item) =>
      item.code === bindCode.code ? { ...item, usedAt: now.toISOString() } : item,
    ),
  });
  return binding;
}

export async function unbindLineConversation(conversationId: string) {
  const data = await getCareLog();
  await saveCareLog({
    ...data,
    lineBindings: data.lineBindings.filter((item) => item.lineUserId !== conversationId),
    linePendingInputs: data.linePendingInputs.filter(
      (item) => item.lineUserId !== conversationId,
    ),
  });
}

export function findLineBinding(
  data: CareLogData,
  conversationId: string,
  fallbackUserId?: string,
) {
  const conversationBinding =
    data.lineBindings.find((item) => item.lineUserId === conversationId) ?? null;
  if (conversationBinding) return conversationBinding;
  if (fallbackUserId && fallbackUserId !== conversationId) {
    return data.lineBindings.find((item) => item.lineUserId === fallbackUserId) ?? null;
  }
  return null;
}

export function getLinePushTargets(data: CareLogData) {
  return [...new Set(data.lineBindings.map((item) => item.lineUserId))];
}

export async function setPendingLineInput(conversationId: string, kind: LinePendingInput["kind"]) {
  const data = await getCareLog();
  await saveCareLog({
    ...data,
    linePendingInputs: [
      ...data.linePendingInputs.filter((item) => item.lineUserId !== conversationId),
      { lineUserId: conversationId, kind, createdAt: new Date().toISOString() },
    ],
  });
}

export async function consumePendingLineInput(conversationId: string) {
  const data = await getCareLog();
  const pending = data.linePendingInputs.find((item) => item.lineUserId === conversationId) ?? null;
  await saveCareLog({
    ...data,
    linePendingInputs: data.linePendingInputs.filter((item) => item.lineUserId !== conversationId),
  });
  return pending;
}

export async function createCareRecordFromLineText(
  conversationId: string,
  text: string,
  fallbackUserId?: string,
) {
  const data = await getCareLog();
  const binding = findLineBinding(data, conversationId, fallbackUserId);
  if (!binding) return { ok: false as const, message: "尚未綁定，請先輸入帳號頁的綁定碼。" };
  const pending = data.linePendingInputs.find((item) => item.lineUserId === conversationId);
  if (!pending) return { ok: false as const, message: "請先從選單選擇要記錄的項目。" };
  const datetime = toLocalInput(new Date());
  const notes = "LINE quick log";

  try {
    if (pending.kind === "temperature") {
      await addCareRecord(createRecord("temperature", { datetime, value: Number(text), site: "耳", recordedBy: binding.displayName, notes }));
    } else if (pending.kind === "bloodPressure") {
      const [bp, pulseText] = text.trim().split(/\s+/);
      const [systolic, diastolic] = bp.split("/").map(Number);
      await addCareRecord(createRecord("bloodPressure", { datetime, systolic, diastolic, pulse: pulseText ? Number(pulseText) : undefined, posture: "坐", recordedBy: binding.displayName, notes }));
    } else if (pending.kind === "bloodGlucose") {
      const [valueText, timing = "其他/未指定"] = text.trim().split(/\s+/);
      await addCareRecord(createRecord("bloodGlucose", { datetime, value: Number(valueText), mealTiming: timing as never, recordedBy: binding.displayName, notes }));
    } else if (pending.kind === "medication") {
      const [drugName, takenText = "是"] = text.trim().split(/\s+/);
      await addCareRecord(createRecord("medication", { datetime, drugName, taken: takenText !== "否", confirmedBy: binding.displayName, notes }));
    }
    await consumePendingLineInput(conversationId);
    return { ok: true as const, message: "已新增紀錄。" };
  } catch {
    return { ok: false as const, message: "格式不正確，請重新輸入。" };
  }
}

export function formatTodayRecordsSummary(data: CareLogData, today = new Date()) {
  const entries = getTodayEntries(data, today);
  if (entries.length === 0) {
    return "今日尚無紀錄";
  }

  const lines = entries.slice(0, 20).map((record) => {
    const flag = record.abnormal ? "⚠ " : "";
    return `• ${flag}${formatRecordTime(record.datetime)} ${recordLabel(record)} ${recordHeadline(record)}（${recordPerson(record)}）`;
  });
  const extra =
    entries.length > 20 ? `\n…還有 ${entries.length - 20} 筆，請到 CareLog 查看完整列表。` : "";
  return `今日紀錄共 ${entries.length} 筆\n${lines.join("\n")}${extra}`;
}

export function buildMenuFlexMessage(): LineFlexMessage {
  return {
    type: "flex",
    altText: "CareLog 選單：快速記錄、今日紀錄與未來行程",
    contents: flexBubble([
      flexTitle("CareLog"),
      flexMuted("選擇要記錄或查看的項目"),
      flexSection("📝 快速記錄", [
        menuButton("🌡️ 體溫", "secondary", "action=quick&type=temperature"),
        menuButton("🩺 血壓", "secondary", "action=quick&type=bloodPressure"),
        menuButton("🩸 血糖", "secondary", "action=quick&type=bloodGlucose"),
        menuButton("💊 吃藥", "secondary", "action=quick&type=medication"),
        menuButton("✅ 今日無異狀", "primary", "action=quick&type=cleanDay"),
      ]),
      flexSection("🔎 查看", [
        menuButton("📋 今日紀錄", "primary", "action=records"),
        menuButton("📅 未來行程", "secondary", "action=agenda"),
      ]),
    ]),
  };
}

export function buildTodayRecordsFlexMessage(data: CareLogData, today = new Date()): LineFlexMessage {
  const entries = getTodayEntries(data, today);
  if (entries.length === 0) {
    return {
      type: "flex",
      altText: "今日尚無紀錄",
      contents: flexBubble([
        flexTitle("今日紀錄"),
        flexMuted("今日尚無紀錄"),
        flexMuted("可用選單快速記錄，或輸入「選單」。"),
      ]),
    };
  }

  const bubbles = chunkForFlex(entries).map((records, index, all) => {
    const extra =
      index === all.length - 1 && entries.length > recordsShownLimit()
        ? entries.length - recordsShownLimit()
        : 0;
    const rows = records.flatMap((record, rowIndex) => [
      ...(rowIndex === 0 ? [] : [flexSeparator()]),
      recordFlexRow(record),
    ]);
    return flexBubble([
      flexTitle(all.length > 1 ? `今日紀錄（${index + 1}/${all.length}）` : "今日紀錄"),
      flexMuted(`共 ${entries.length} 筆`),
      ...rows,
      ...(extra > 0 ? [flexMuted(`…還有 ${extra} 筆，請到 CareLog 查看完整列表。`)] : []),
    ]);
  });

  return {
    type: "flex",
    altText: truncateAlt(formatTodayRecordsSummary(data, today)),
    contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
  };
}

export function getUpcomingAgendaItems(
  data: CareLogData,
  now = new Date(),
  hoursAhead = AGENDA_HOURS_AHEAD,
): UpcomingAgendaItem[] {
  const start = now.getTime();
  const end = start + hoursAhead * 60 * 60 * 1000;
  const items: UpcomingAgendaItem[] = getDueReminders(data, now, hoursAhead).map((reminder) => ({
    datetime: reminder.dueAt,
    type: "提醒",
    title: reminder.type,
    notes: reminder.notes,
  }));

  for (const exam of data.exams) {
    const item = examAgendaItem(exam, start, end);
    if (item) items.push(item);
  }

  for (const visit of data.visits) {
    const item = visitAgendaItem(visit, start, end);
    if (item) items.push(item);
  }

  return items.sort((a, b) => {
    const byTime = agendaTimestamp(a.datetime) - agendaTimestamp(b.datetime);
    return byTime !== 0 ? byTime : a.title.localeCompare(b.title, "zh-Hant");
  });
}

export function formatAgendaSummary(data: CareLogData, now = new Date()) {
  const items = getUpcomingAgendaItems(data, now);
  if (items.length === 0) {
    return "近期沒有行程";
  }

  const lines = items.slice(0, 20).map((item) => {
    const notes = item.notes.trim() ? ` ${item.notes}` : "";
    return `• ${formatAgendaTime(item.datetime)} ${item.type} ${item.title}${notes}`;
  });
  const extra =
    items.length > 20 ? `\n…還有 ${items.length - 20} 筆，請到 CareLog 查看完整列表。` : "";
  return `未來行程共 ${items.length} 筆\n${lines.join("\n")}${extra}`;
}

export function buildAgendaFlexMessage(data: CareLogData, now = new Date()): LineFlexMessage {
  const items = getUpcomingAgendaItems(data, now);
  if (items.length === 0) {
    return {
      type: "flex",
      altText: "近期沒有行程",
      contents: flexBubble([
        flexTitle("未來行程"),
        flexMuted("近期沒有行程"),
        flexMuted("可用選單查看今日紀錄，或到 CareLog 新增提醒、檢查與看診。"),
      ]),
    };
  }

  const bubbles = chunkForFlex(items).map((chunkItems, index, all) => {
    const extra =
      index === all.length - 1 && items.length > recordsShownLimit()
        ? items.length - recordsShownLimit()
        : 0;
    const rows = chunkItems.flatMap((item, rowIndex) => [
      ...(rowIndex === 0 ? [] : [flexSeparator()]),
      agendaFlexRow(item),
    ]);
    return flexBubble([
      flexTitle(all.length > 1 ? `未來行程（${index + 1}/${all.length}）` : "未來行程"),
      flexMuted(`共 ${items.length} 筆（未來 7 天）`),
      ...rows,
      ...(extra > 0 ? [flexMuted(`…還有 ${extra} 筆，請到 CareLog 查看完整列表。`)] : []),
    ]);
  });

  return {
    type: "flex",
    altText: truncateAlt(formatAgendaSummary(data, now)),
    contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
  };
}

export function buildDueRemindersFlexMessage(reminders: CareReminder[]): LineFlexMessage | null {
  if (reminders.length === 0) return null;

  const bubbles = chunkForFlex(reminders).map((items, index, all) => {
    const extra =
      index === all.length - 1 && reminders.length > recordsShownLimit()
        ? reminders.length - recordsShownLimit()
        : 0;
    const rows = items.flatMap((reminder, rowIndex) => [
      ...(rowIndex === 0 ? [] : [flexSeparator()]),
      reminderFlexRow(reminder),
    ]);
    return flexBubble([
      flexTitle(all.length > 1 ? `待辦提醒（${index + 1}/${all.length}）` : "CareLog 提醒"),
      flexMuted(`未來 48 小時有 ${reminders.length} 項待辦`),
      ...rows,
      ...(extra > 0 ? [flexMuted(`…還有 ${extra} 項，請到 CareLog 查看完整列表。`)] : []),
    ]);
  });

  return {
    type: "flex",
    altText: truncateAlt(`CareLog 提醒：未來 48 小時有 ${reminders.length} 項待辦。`),
    contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
  };
}

function recordLabel(record: CareRecord) {
  const labels: Record<CareRecord["type"], string> = {
    temperature: "體溫",
    bloodPressure: "血壓",
    bloodGlucose: "血糖",
    medication: "吃藥",
    symptoms: "症狀",
    weight: "體重",
  };
  return labels[record.type];
}

function recordHeadline(record: CareRecord) {
  switch (record.type) {
    case "temperature":
      return `${record.value.toFixed(1)}°C（${record.site}）`;
    case "bloodPressure":
      return `${record.systolic}/${record.diastolic}${record.pulse ? ` 脈搏${record.pulse}` : ""}`;
    case "bloodGlucose":
      return `${record.value} ${record.mealTiming}`;
    case "medication":
      return `${record.drugName} ${record.taken ? "已吃" : "未吃"}`;
    case "symptoms":
      return record.cleanDay
        ? "今日無異狀"
        : `${record.symptoms.join("、") || "未勾選"} ${record.severity}`;
    case "weight":
      return `${record.value.toFixed(1)}kg（${record.clothing}）`;
  }
}

function recordPerson(record: CareRecord) {
  return record.type === "medication" ? record.confirmedBy : record.recordedBy;
}

function recordFlexRow(record: CareRecord) {
  const flag = record.abnormal ? "⚠ " : "";
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      {
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
          { type: "text", text: formatRecordTime(record.datetime), size: "sm", color: "#0F766E", weight: "bold", flex: 2 },
          { type: "text", text: `${flag}${recordLabel(record)}`, size: "sm", weight: "bold", flex: 2, wrap: true },
          { type: "text", text: recordHeadline(record), size: "sm", wrap: true, flex: 5 },
        ],
      },
      { type: "text", text: recordPerson(record), size: "xs", color: "#888888" },
    ],
  };
}

function agendaFlexRow(item: UpcomingAgendaItem) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      {
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
          { type: "text", text: formatAgendaTime(item.datetime), size: "sm", color: "#0F766E", weight: "bold", flex: 3 },
          { type: "text", text: item.type, size: "sm", weight: "bold", flex: 2, wrap: true },
          { type: "text", text: item.title, size: "sm", wrap: true, flex: 4 },
        ],
      },
      ...(item.notes.trim()
        ? [{ type: "text", text: item.notes, size: "xs", color: "#888888", wrap: true }]
        : []),
    ],
  };
}

function examAgendaItem(exam: ExamRecord, start: number, end: number): UpcomingAgendaItem | null {
  if (inAgendaWindow(exam.datetime, start, end)) {
    return {
      datetime: exam.datetime,
      type: "檢查",
      title: exam.name,
      notes: [exam.location, exam.status].filter(Boolean).join("｜"),
    };
  }
  if (exam.nextDue && inAgendaWindow(exam.nextDue, start, end)) {
    return {
      datetime: exam.nextDue,
      type: "檢查",
      title: exam.name,
      notes: "下次追蹤",
    };
  }
  return null;
}

function visitAgendaItem(visit: VisitRecord, start: number, end: number): UpcomingAgendaItem | null {
  if (inAgendaWindow(visit.date, start, end)) {
    return {
      datetime: visit.date,
      type: "看診",
      title: visitTitle(visit),
      notes: visit.instructions,
    };
  }
  if (visit.followUpDate && inAgendaWindow(visit.followUpDate, start, end)) {
    return {
      datetime: visit.followUpDate,
      type: "回診",
      title: visitTitle(visit),
      notes: visit.instructions,
    };
  }
  return null;
}

function visitTitle(visit: VisitRecord) {
  return visit.doctor ? `${visit.department}｜${visit.doctor}` : visit.department;
}

function inAgendaWindow(value: string, start: number, end: number) {
  const time = agendaTimestamp(value);
  return Number.isFinite(time) && time >= start && time <= end;
}

function agendaTimestamp(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).getTime();
  }
  return new Date(value).getTime();
}

function reminderFlexRow(reminder: CareReminder) {
  const contents: unknown[] = [
    { type: "text", text: reminder.type, weight: "bold", size: "md", wrap: true },
    { type: "text", text: formatReminderTime(reminder.dueAt), size: "sm", color: "#666666" },
  ];
  if (reminder.notes.trim()) {
    contents.push({ type: "text", text: reminder.notes, size: "sm", wrap: true });
  }
  return { type: "box", layout: "vertical", spacing: "xs", contents };
}

function flexSection(title: string, contents: unknown[]) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    contents: [
      { type: "text", text: title, weight: "bold", size: "sm", color: "#0F766E" },
      flexSeparator(),
      ...contents,
    ],
  };
}

function menuButton(label: string, style: "primary" | "secondary", data: string) {
  return {
    type: "button",
    style,
    action: { type: "postback", label, data },
  };
}

function flexBubble(contents: unknown[]): LineFlexBubble {
  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents },
  };
}

function flexTitle(text: string) {
  return { type: "text", text, weight: "bold", size: "lg", wrap: true };
}

function flexMuted(text: string) {
  return { type: "text", text, size: "sm", color: "#666666", wrap: true };
}

function flexSeparator() {
  return { type: "separator" };
}

function chunkForFlex<T>(items: T[]) {
  return chunk(items.slice(0, recordsShownLimit()), FLEX_ITEMS_PER_BUBBLE);
}

function recordsShownLimit() {
  return FLEX_ITEMS_PER_BUBBLE * FLEX_MAX_BUBBLES;
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function truncateAlt(text: string) {
  return text.length <= FLEX_ALT_TEXT_MAX ? text : `${text.slice(0, FLEX_ALT_TEXT_MAX - 3)}...`;
}

function formatRecordTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatReminderTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatAgendaTime(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? randomBytes(16).toString("hex");
}
