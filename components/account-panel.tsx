import {
  changePasswordAction,
  clearDataAction,
  logoutAction,
  seedDemoDataAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserAccount } from "@/lib/care-records";
import type { ReactNode } from "react";

export function AccountPanel({
  user,
  status,
}: {
  user: UserAccount;
  status?: string;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
        <p className="text-sm font-semibold">目前登入</p>
        <h2 className="mt-1 text-3xl font-black">{user.displayName}</h2>
        <p className="mt-1 text-sm text-emerald-800">
          新增紀錄時會自動使用這個名字。
        </p>
        <form action={logoutAction} className="mt-4">
          <Button type="submit" variant="outline" className="min-h-12 w-full rounded-2xl bg-white">
            登出
          </Button>
        </form>
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
        <h2 className="text-xl font-black">修改密碼</h2>
        {status ? (
          <p
            className={`mt-3 rounded-2xl p-3 text-sm font-medium ${
              status === "changed"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {passwordMessage(status)}
          </p>
        ) : null}
        <form action={changePasswordAction} className="mt-4 grid gap-3">
          <Field label="目前密碼" htmlFor="currentPassword">
            <Input id="currentPassword" name="currentPassword" type="password" required />
          </Field>
          <Field label="新密碼（至少 8 碼）" htmlFor="nextPassword">
            <Input id="nextPassword" name="nextPassword" type="password" minLength={8} required />
          </Field>
          <Field label="再次輸入新密碼" htmlFor="confirmPassword">
            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
          </Field>
          <Button type="submit" variant="secondary" className="min-h-12 rounded-2xl">
            更新密碼
          </Button>
        </form>
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
        <h2 className="text-xl font-black">資料工具</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Demo 只在沒有紀錄時載入；清空只會清照護紀錄，保留帳號。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <form action={seedDemoDataAction}>
            <Button type="submit" variant="outline" className="min-h-12 w-full rounded-2xl">
              載入 demo
            </Button>
          </form>
          <form action={clearDataAction}>
            <Button type="submit" variant="destructive" className="min-h-12 w-full rounded-2xl">
              清空紀錄
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function passwordMessage(status: string) {
  const messages: Record<string, string> = {
    changed: "密碼已更新。",
    "confirm-mismatch": "兩次新密碼不一致。",
    invalid_current: "目前密碼不正確。",
    too_short: "新密碼至少需要 8 碼。",
    not_found: "找不到目前使用者。",
  };

  return messages[status] ?? "密碼未更新，請再試一次。";
}
