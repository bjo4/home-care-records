import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureBootstrapUsers } from "@/lib/auth";
import { getCareLog } from "@/lib/care-store";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

type Props = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  await ensureBootstrapUsers();
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/");
  }

  const data = await getCareLog();
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#d1fae5,transparent_32rem),linear-gradient(180deg,#fff7ed_0%,#f8fafc_100%)] px-4 py-8">
      <Card className="w-full max-w-md bg-white/95 shadow-xl">
        <CardHeader>
          <p className="text-sm font-bold text-emerald-700">CareLog</p>
          <CardTitle className="text-3xl font-black">登入居家照顧紀錄</CardTitle>
          <CardDescription>
            請使用個人帳號登入。每筆紀錄會自動使用你的顯示名稱。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {data.users.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              尚未建立使用者。請先在環境變數設定{" "}
              <code className="font-mono">CARELOG_BOOTSTRAP_USERS</code>，再重新啟動。
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {errorMessage(error)}
            </div>
          ) : null}

          <form action={loginAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">帳號</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="warren"
                required
                className="min-h-12"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="min-h-12"
              />
            </div>
            <Button type="submit" size="lg" className="min-h-12">
              登入
            </Button>
          </form>
          <p className="text-xs leading-5 text-muted-foreground">
            連續 5 次失敗會鎖定 10 分鐘。這是私密家庭照護工具，請部署在受保護的網域。
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function errorMessage(error: string) {
  switch (error) {
    case "locked":
      return "登入失敗太多次，帳號暫時鎖定。請稍後再試。";
    case "not_configured":
      return "尚未建立使用者，請先設定 bootstrap 環境變數。";
    default:
      return "帳號或密碼不正確。";
  }
}
