"use server";

import { redirect } from "next/navigation";

import { authenticateUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const username = formData.get("username")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const result = await authenticateUser(username, password);

  if (!result.ok) {
    redirect(`/login?error=${result.reason}`);
  }

  await setSessionCookie(result.sessionToken);
  redirect("/");
}
