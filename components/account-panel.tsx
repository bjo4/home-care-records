import {
  changePasswordAction,
  createApiTokenAction,
  clearDataAction,
  logoutAction,
  revokeApiTokenAction,
  seedDemoDataAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiToken, UserAccount } from "@/lib/care-records";
import type { ReactNode } from "react";

export function AccountPanel({
  user,
  status,
  newToken,
  tokens,
}: {
  user: UserAccount;
  status?: string;
  newToken?: string;
  tokens: ApiToken[];
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
        <h2 className="text-xl font-black">API Token / MCP</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          建立後只顯示一次，請立即複製保存。
        </p>
        {newToken ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-bold text-amber-900">新的 token（只顯示一次）</p>
            <code className="mt-2 block break-all rounded-xl bg-white p-2 font-mono text-xs">
              {newToken}
            </code>
          </div>
        ) : null}
        <form action={createApiTokenAction} className="mt-4 grid gap-2">
          <Field label="Token 名稱" htmlFor="label">
            <Input id="label" name="label" placeholder="Cursor / Claude" required />
          </Field>
          <Button type="submit" className="min-h-12 rounded-2xl">
            建立 token
          </Button>
        </form>
        <div className="mt-4 grid gap-2">
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無 token。</p>
          ) : (
            tokens.map((token) => (
              <div key={token.id} className="rounded-2xl border bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{token.label}</p>
                    <p className="text-xs text-muted-foreground">
                      prefix {token.prefix} · 建立 {formatDate(token.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      最後使用：{token.lastUsedAt ? formatDate(token.lastUsedAt) : "尚未使用"}
                    </p>
                    {token.revokedAt ? (
                      <p className="text-xs font-bold text-red-700">已撤銷</p>
                    ) : null}
                  </div>
                  {!token.revokedAt ? (
                    <form action={revokeApiTokenAction}>
                      <input type="hidden" name="tokenId" value={token.id} />
                      <Button type="submit" variant="destructive" className="rounded-2xl">
                        撤銷
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
