import { NextRequest, NextResponse } from "next/server";

import { createRecord } from "@/lib/care-records";
import { addCareRecord, getCareLog } from "@/lib/care-store";
import {
  bindLineUser,
  buildAgendaFlexMessage,
  buildMenuFlexMessage,
  buildTodayRecordsFlexMessage,
  buildVisitDetailFlexMessage,
  buildVisitRecordsFlexMessage,
  createCareRecordFromLineText,
  findLineBinding,
  getLineConversation,
  isAgendaCommand,
  isLineMenuCommand,
  isTodayRecordsCommand,
  isVisitRecordsCommand,
  setPendingLineInput,
  unbindLineConversation,
  verifyLineSignature,
  type LineEventSource,
} from "@/lib/line";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: LineEventSource;
  message?: { type: string; text?: string };
  postback?: { data?: string };
};

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
  const conversation = getLineConversation(event.source);

  if (event.type === "leave" || event.type === "unfollow") {
    if (conversation) await unbindLineConversation(conversation.conversationId);
    return;
  }

  if (!event.replyToken) return;

  if (event.type === "follow" || event.type === "join") {
    const hint =
      conversation?.sourceType === "group" || conversation?.sourceType === "room"
        ? "把帳號頁的綁定碼貼在這個群，即可綁定家庭群組並接收提醒。"
        : "請先在 CareLog 帳號頁產生綁定碼並傳給我。";
    return reply(event.replyToken, [buildMenuFlexMessage(), { type: "text", text: hint }]);
  }

  if (!conversation) return;

  const { conversationId, sourceType, senderUserId } = conversation;

  if (event.type === "message" && event.message?.type === "text") {
    const text = (event.message.text ?? "").trim();
    if (isLineMenuCommand(text)) return reply(event.replyToken, [buildMenuFlexMessage()]);
    if (isTodayRecordsCommand(text)) {
      return replyTodayRecords(event.replyToken, conversationId, senderUserId);
    }
    if (isAgendaCommand(text)) {
      return replyAgenda(event.replyToken, conversationId, senderUserId);
    }
    if (isVisitRecordsCommand(text)) {
      return replyVisitRecords(event.replyToken, conversationId, senderUserId);
    }
    if (/^CL-[0-9A-F]{6}$/i.test(text)) {
      const binding = await bindLineUser(conversationId, text, sourceType);
      if (!binding) {
        return replyText(event.replyToken, "綁定碼無效或已過期，請回 CareLog 帳號頁重新產生。");
      }
      const target =
        sourceType === "group"
          ? `家庭群組（${binding.displayName}）`
          : sourceType === "room"
            ? `聊天室（${binding.displayName}）`
            : binding.displayName;
      return replyText(event.replyToken, `已綁定 ${target}。輸入「選單」開始記錄，或輸入「今日紀錄」查看摘要。`);
    }
    const result = await createCareRecordFromLineText(conversationId, text, senderUserId);
    if (result.silent) return;
    return replyText(event.replyToken, result.message);
  }

  if (event.type === "postback" && event.postback?.data) {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get("action");
    if (action === "records") {
      return replyTodayRecords(event.replyToken, conversationId, senderUserId);
    }
    if (action === "agenda" || action === "schedule") {
      return replyAgenda(event.replyToken, conversationId, senderUserId);
    }
    if (action === "visits") {
      return replyVisitRecords(event.replyToken, conversationId, senderUserId, parsePage(data.get("page")));
    }
    if (action === "visit") {
      return replyVisitDetail(
        event.replyToken,
        conversationId,
        senderUserId,
        data.get("id"),
        parsePage(data.get("page")),
      );
    }
    const kind = data.get("type") as
      | "temperature"
      | "bloodPressure"
      | "bloodGlucose"
      | "bloodOxygen"
      | "medication"
      | "cleanDay"
      | null;
    if (action === "quick" && kind) {
      const careData = await getCareLog();
      const binding = findLineBinding(careData, conversationId, senderUserId);
      if (!binding) {
        return replyText(
          event.replyToken,
          "請先在 CareLog 帳號頁產生 LINE 綁定碼，並在這個對話傳送綁定碼給我。",
        );
      }
      if (kind === "cleanDay") {
        await addCareRecord(
          createRecord("symptoms", {
            datetime: toLocalInput(new Date()),
            recordedBy: binding.displayName,
            cleanDay: true,
            symptoms: [],
            severity: "無",
            clinicianNotified: false,
            soughtCare: false,
            notes: "LINE 今日無異狀",
          }),
        );
        return replyText(event.replyToken, "已記錄今日無異狀。");
      }
      await setPendingLineInput(conversationId, kind);
      return replyText(event.replyToken, promptFor(kind));
    }
  }
}

async function replyTodayRecords(
  replyToken: string,
  conversationId: string,
  senderUserId?: string,
) {
  const careData = await getCareLog();
  const binding = findLineBinding(careData, conversationId, senderUserId);
  if (!binding) {
    return replyText(replyToken, "請先在 CareLog 帳號頁產生 LINE 綁定碼，並在這個對話傳送綁定碼給我。");
  }
  return reply(replyToken, [buildTodayRecordsFlexMessage(careData)]);
}

async function replyAgenda(
  replyToken: string,
  conversationId: string,
  senderUserId?: string,
) {
  const careData = await getCareLog();
  const binding = findLineBinding(careData, conversationId, senderUserId);
  if (!binding) {
    return replyText(replyToken, "請先在 CareLog 帳號頁產生 LINE 綁定碼，並在這個對話傳送綁定碼給我。");
  }
  return reply(replyToken, [buildAgendaFlexMessage(careData)]);
}

async function replyVisitRecords(
  replyToken: string,
  conversationId: string,
  senderUserId?: string,
  page = 1,
) {
  const careData = await getCareLog();
  const binding = findLineBinding(careData, conversationId, senderUserId);
  if (!binding) {
    return replyText(replyToken, "請先在 CareLog 帳號頁產生 LINE 綁定碼，並在這個對話傳送綁定碼給我。");
  }
  return reply(replyToken, [buildVisitRecordsFlexMessage(careData, page)]);
}

async function replyVisitDetail(
  replyToken: string,
  conversationId: string,
  senderUserId?: string,
  visitId?: string | null,
  page = 1,
) {
  const careData = await getCareLog();
  const binding = findLineBinding(careData, conversationId, senderUserId);
  if (!binding) {
    return replyText(replyToken, "請先在 CareLog 帳號頁產生 LINE 綁定碼，並在這個對話傳送綁定碼給我。");
  }
  const visit = careData.visits.find((item) => item.id === visitId);
  if (!visit) {
    return replyText(replyToken, "找不到這筆看診紀錄。可用選單再開一次看診紀錄。");
  }
  return reply(replyToken, [buildVisitDetailFlexMessage(visit, page)]);
}

function parsePage(value: string | null) {
  const page = Number(value ?? "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function promptFor(kind: string) {
  const prompts: Record<string, string> = {
    temperature: "請輸入體溫，例如：36.8",
    bloodPressure: "請輸入血壓，例如：120/80 72（脈搏可省略）",
    bloodGlucose: "請輸入血糖，例如：110 飯前",
    bloodOxygen: "請輸入血氧，例如：98 或 98 72（脈搏可省略）",
    medication: "請輸入藥名與是否已吃，例如：心律整錠 是",
  };
  return prompts[kind] ?? "請輸入數值。";
}

async function replyText(replyToken: string, text: string) {
  return reply(replyToken, [{ type: "text", text }]);
}

async function reply(replyToken: string, messages: unknown[]) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? process.env.CARELOG_LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ replyToken, messages }),
  });
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
