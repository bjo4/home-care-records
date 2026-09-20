import { NextRequest, NextResponse } from "next/server";

import { createRecord } from "@/lib/care-records";
import { addCareRecord, getCareLog } from "@/lib/care-store";
import { bindLineUser, createCareRecordFromLineText, findLineBinding, setPendingLineInput, verifyLineSignature } from "@/lib/line";

type LineEvent = { type: string; replyToken?: string; source?: { userId?: string }; message?: { type: string; text?: string }; postback?: { data?: string } };

export async function POST(request: NextRequest) {
  const body = await request.text();
  const secret = process.env.LINE_CHANNEL_SECRET ?? process.env.CARELOG_LINE_CHANNEL_SECRET ?? "";
  if (!verifyLineSignature(body, request.headers.get("x-line-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const payload = JSON.parse(body) as { events?: LineEvent[] };
  await Promise.all((payload.events ?? []).map(handleEvent));
  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineEvent) {
  const lineUserId = event.source?.userId;
  if (!lineUserId || !event.replyToken) return;
  if (event.type === "follow" || event.type === "join") return reply(event.replyToken, [menuMessage()]);
  if (event.type === "message" && event.message?.type === "text") {
    const text = (event.message.text ?? "").trim();
    if (["選單", "記錄", "menu"].includes(text.toLowerCase())) return reply(event.replyToken, [menuMessage()]);
    if (/^CL-[0-9A-F]{6}$/i.test(text)) {
      const binding = await bindLineUser(lineUserId, text);
      return replyText(event.replyToken, binding ? `已綁定 ${binding.displayName}。輸入「選單」開始記錄。` : "綁定碼無效或已過期，請回 CareLog 帳號頁重新產生。");
    }
    const result = await createCareRecordFromLineText(lineUserId, text);
    return replyText(event.replyToken, result.message);
  }
  if (event.type === "postback" && event.postback?.data) {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get("action");
    const kind = data.get("type") as "temperature" | "bloodPressure" | "bloodGlucose" | "medication" | "cleanDay" | null;
    if (action === "quick" && kind) {
      const careData = await getCareLog();
      const binding = findLineBinding(careData, lineUserId);
      if (!binding) return replyText(event.replyToken, "請先在 CareLog 帳號頁產生 LINE 綁定碼，並傳送綁定碼給我。");
      if (kind === "cleanDay") {
        await addCareRecord(createRecord("symptoms", { datetime: toLocalInput(new Date()), recordedBy: binding.displayName, cleanDay: true, symptoms: [], severity: "無", clinicianNotified: false, soughtCare: false, notes: "LINE 今日無異狀" }));
        return replyText(event.replyToken, "已記錄今日無異狀。");
      }
      await setPendingLineInput(lineUserId, kind);
      return replyText(event.replyToken, promptFor(kind));
    }
  }
}

function menuMessage() {
  return {
    type: "flex",
    altText: "CareLog 快速記錄選單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "CareLog 快速記錄", weight: "bold", size: "lg" },
          { type: "text", text: "選擇要記錄的項目", size: "sm", color: "#666666" },
          button("體溫", "temperature"),
          button("血壓", "bloodPressure"),
          button("血糖", "bloodGlucose"),
          button("吃藥", "medication"),
          button("今日無異狀", "cleanDay"),
        ],
      },
    },
  };
}
function button(label: string, type: string) { return { type: "button", style: type === "cleanDay" ? "primary" : "secondary", action: { type: "postback", label, data: `action=quick&type=${type}` } }; }
function promptFor(kind: string) { const prompts: Record<string, string> = { temperature: "請輸入體溫，例如：36.8", bloodPressure: "請輸入血壓，例如：120/80 72（脈搏可省略）", bloodGlucose: "請輸入血糖，例如：110 飯前", medication: "請輸入藥名與是否已吃，例如：心律整錠 是" }; return prompts[kind] ?? "請輸入數值。"; }
async function replyText(replyToken: string, text: string) { return reply(replyToken, [{ type: "text", text }]); }
async function reply(replyToken: string, messages: unknown[]) { const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? process.env.CARELOG_LINE_CHANNEL_ACCESS_TOKEN; if (!token) return; await fetch("https://api.line.me/v2/bot/message/reply", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ replyToken, messages }) }); }
function toLocalInput(date: Date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16); }
