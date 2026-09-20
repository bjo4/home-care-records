import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  createRecord,
  type CareLogData,
  type LineBinding,
  type LinePendingInput,
} from "@/lib/care-records";
import { addCareRecord, getCareLog, saveCareLog } from "@/lib/care-store";

export function verifyLineSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
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

export async function bindLineUser(lineUserId: string, code: string) {
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
    lineUserId,
    displayName: bindCode.displayName,
    createdAt: now.toISOString(),
  };
  await saveCareLog({
    ...data,
    lineBindings: [
      ...data.lineBindings.filter((item) => item.lineUserId !== lineUserId),
      binding,
    ],
    lineBindCodes: data.lineBindCodes.map((item) =>
      item.code === bindCode.code ? { ...item, usedAt: now.toISOString() } : item,
    ),
  });
  return binding;
}

export function findLineBinding(data: CareLogData, lineUserId: string) {
  return data.lineBindings.find((item) => item.lineUserId === lineUserId) ?? null;
}

export async function setPendingLineInput(lineUserId: string, kind: LinePendingInput["kind"]) {
  const data = await getCareLog();
  await saveCareLog({
    ...data,
    linePendingInputs: [
      ...data.linePendingInputs.filter((item) => item.lineUserId !== lineUserId),
      { lineUserId, kind, createdAt: new Date().toISOString() },
    ],
  });
}

export async function consumePendingLineInput(lineUserId: string) {
  const data = await getCareLog();
  const pending = data.linePendingInputs.find((item) => item.lineUserId === lineUserId) ?? null;
  await saveCareLog({
    ...data,
    linePendingInputs: data.linePendingInputs.filter((item) => item.lineUserId !== lineUserId),
  });
  return pending;
}

export async function createCareRecordFromLineText(
  lineUserId: string,
  text: string,
) {
  const data = await getCareLog();
  const binding = findLineBinding(data, lineUserId);
  if (!binding) return { ok: false as const, message: "尚未綁定，請先輸入帳號頁的綁定碼。" };
  const pending = data.linePendingInputs.find((item) => item.lineUserId === lineUserId);
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
    await consumePendingLineInput(lineUserId);
    return { ok: true as const, message: "已新增紀錄。" };
  } catch {
    return { ok: false as const, message: "格式不正確，請重新輸入。" };
  }
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? randomBytes(16).toString("hex");
}
