import { NextRequest, NextResponse } from "next/server";
import { getCareLog, getDueReminders } from "@/lib/care-store";
import { getLinePushTargets } from "@/lib/line";

export async function POST(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = process.env.CARELOG_CRON_TOKEN ?? process.env.CARELOG_REMINDER_TOKEN;
  if (!token || bearer !== token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await getCareLog();
  const due = getDueReminders(data, new Date(), 48);
  const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? process.env.CARELOG_LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelToken) return NextResponse.json({ pushed: 0, due: due.length, skipped: "missing LINE token" });
  let pushed = 0;
  for (const to of getLinePushTargets(data)) {
    if (due.length === 0) continue;
    await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { authorization: `Bearer ${channelToken}`, "content-type": "application/json" }, body: JSON.stringify({ to, messages: [{ type: "text", text: `CareLog 提醒：未來 48 小時有 ${due.length} 項待辦。` }] }) });
    pushed += 1;
  }
  return NextResponse.json({ pushed, due: due.length });
}
