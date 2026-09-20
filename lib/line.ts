import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  createRecord,
  getTodayEntries,
  type CareLogData,
  type CareRecord,
  type LineBinding,
  type LinePendingInput,
  type LineSourceType,
} from "@/lib/care-records";
import { addCareRecord, getCareLog, saveCareLog } from "@/lib/care-store";

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
    return "今天還沒有紀錄。可用選單快速記錄，或輸入「選單」。";
  }

  const lines = entries.slice(0, 20).map((record) => {
    const flag = record.abnormal ? "⚠ " : "";
    return `• ${flag}${formatRecordTime(record.datetime)} ${recordLabel(record)} ${recordHeadline(record)}（${recordPerson(record)}）`;
  });
  const extra =
    entries.length > 20 ? `\n…還有 ${entries.length - 20} 筆，請到 CareLog 查看完整列表。` : "";
  return `今日紀錄共 ${entries.length} 筆\n${lines.join("\n")}${extra}`;
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
      return `${record.value.toFixed(1)}kg`;
  }
}

function recordPerson(record: CareRecord) {
  return record.type === "medication" ? record.confirmedBy : record.recordedBy;
}

function formatRecordTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? randomBytes(16).toString("hex");
}
