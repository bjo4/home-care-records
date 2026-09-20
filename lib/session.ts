import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  deleteSession,
  getUserBySessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return getUserBySessionToken(token);
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.CARELOG_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  await deleteSession(token);
  cookieStore.delete(SESSION_COOKIE_NAME);
}
