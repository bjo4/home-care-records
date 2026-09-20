import {
  changePasswordAction,
  createApiTokenAction,
  clearDataAction,
  createLineBindCodeAction,
  logoutAction,
  revokeApiTokenAction,
  seedDemoDataAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiToken, LineBinding, UserAccount } from "@/lib/care-records";
import type { ReactNode } from "react";

export function AccountPanel({
  user,
  status,
  newToken,
  tokens,
  lineCode,
  lineBindings,
}: {
  user: UserAccount;
  status?: string;
  newToken?: string;
  tokens: ApiToken[];
  lineCode?: string;
  lineBindings: LineBinding[];
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
        <h2 className="text-xl font-black">LINE 綁定</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          用 care-station 官方帳號傳送綁定碼，之後可接收提醒與快速記錄。把 OA 拉進家庭群，在群裡傳綁定碼即可綁群組。
        </p>
        {lineCode ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-bold text-amber-900">請在 LINE 傳送此綁定碼（15 分鐘內有效）</p>
            <code className="mt-2 block rounded-xl bg-white p-3 text-center font-mono text-xl font-black">
              {lineCode}
            </code>
          </div>
        ) : null}
        <form action={createLineBindCodeAction} className="mt-4">
          <Button type="submit" className="min-h-12 w-full rounded-2xl">
            產生 LINE 綁定碼
          </Button>
        </form>
        <div className="mt-4 grid gap-2">
          {lineBindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚未綁定 LINE。</p>
          ) : (
            lineBindings.map((binding) => (
              <div key={binding.id} className="rounded-2xl border bg-white p-3 text-sm">
                <p className="font-bold">{binding.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  LINE {sourceTypeLabel(binding.sourceType)}：{binding.lineUserId.slice(0, 8)}... · {formatDate(binding.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
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
        <div className="mt-4 rounded-2xl border bg-stone-50 p-3 text-sm">
          <h3 className="font-black">MCP 連線方式</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>建立 token 並複製 `clr_...`。</li>
            <li>貼到 Cursor / Claude Desktop MCP 設定。</li>
            <li>測試 `tools/list`，確認能看到 CareLog tools。</li>
          </ol>
          <p className="mt-3 font-semibold">MCP URL</p>
          <code className="mt-1 block break-all rounded-xl bg-white p-2 font-mono text-xs">
            https://care.kuroshimae.cc/api/mcp
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            Alias：<code>https://care.kuroshimae.cc/mcp</code>
          </p>
          <p className="mt-3 font-semibold">Auth header</p>
          <code className="mt-1 block break-all rounded-xl bg-white p-2 font-mono text-xs">
            Authorization: Bearer &lt;token&gt;
          </code>
          <p className="mt-3 font-semibold">Cursor / Claude Desktop 設定範例</p>
          <pre className="mt-1 overflow-x-auto rounded-xl bg-white p-3 text-xs">
{`{
  "mcpServers": {
    "carelog": {
      "url": "https://care.kuroshimae.cc/api/mcp",
      "headers": {
        "Authorization": "Bearer clr_your_token_here"
      }
    }
  }
}`}
          </pre>
        </div>
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

function sourceTypeLabel(sourceType: LineBinding["sourceType"]) {
  if (sourceType === "group") return "群組";
  if (sourceType === "room") return "聊天室";
  return "個人";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
