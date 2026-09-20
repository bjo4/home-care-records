import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getUserBySessionToken } from "@/lib/auth";
import { getCareLog, getDueReminders } from "@/lib/care-store";

export async function GET(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = process.env.CARELOG_REMINDER_TOKEN;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionUser = await getUserBySessionToken(sessionToken);
  const bearerAllowed = Boolean(token && bearer && bearer === token);

  if (!sessionUser && !bearerAllowed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await getCareLog();
  const reminders = getDueReminders(data, new Date(), 48);

  return NextResponse.json({
    windowHours: 48,
    reminders,
  });
}
