import {
  changePasswordAction,
  clearDataAction,
  logoutAction,
  seedDemoDataAction,
} from "@/app/actions";
import { HistorySection, TodaySummary } from "@/components/care-summary";
import { RecordForms } from "@/components/record-forms";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTodayEntries } from "@/lib/care-records";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

type Props = {
  searchParams?: Promise<{
    password?: string;
  }>;
};

export default async function Home({ searchParams }: Props) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const data = await getCareLog();
  const todayEntries = getTodayEntries(data);
  const nowInput = toDateTimeLocalInput(new Date());

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_32rem),linear-gradient(180deg,#fff7ed_0%,#f8fafc_45%,#ecfeff_100%)]">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-4 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur md:grid-cols-[1fr_24rem] md:items-end">
          <div className="grid gap-3">
            <p className="text-sm font-bold text-emerald-700">CareLog / home-care-records</p>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                居家照顧紀錄
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Warren 家庭用的私密照護日誌：體溫、血壓、吃藥、警訊症狀、體重集中記錄，
                讓疲累的照顧者用手機也能快速交班。
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <a className={buttonVariants({ size: "lg" })} href="#quick-add">
                快速新增
              </a>
              <a
                className={buttonVariants({ variant: "outline", size: "lg" })}
                href="#history"
              >
                看歷史趨勢
              </a>
            </nav>
          </div>
          <div className="grid gap-3">
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
              <p className="text-sm font-semibold">目前登入</p>
              <h2 className="mt-1 text-2xl font-black">{user.displayName}</h2>
              <p className="text-sm text-emerald-800">
                記錄人/確認人已鎖定為此帳號。
              </p>
              <form action={logoutAction} className="mt-3">
                <Button type="submit" variant="outline" className="min-h-11 w-full bg-white">
                  登出
                </Button>
              </form>
            </section>
            <div className="grid grid-cols-2 gap-2">
              <form action={seedDemoDataAction}>
                <Button type="submit" variant="outline" className="min-h-11 w-full">
                  載入 demo
                </Button>
              </form>
              <form action={clearDataAction}>
                <Button type="submit" variant="destructive" className="min-h-11 w-full">
                  清空資料
                </Button>
              </form>
            </div>
            <ChangePasswordPanel status={params?.password} />
          </div>
        </header>

        <TodaySummary data={data} todayEntries={todayEntries} />
        <RecordForms caregiver={user.displayName} nowInput={nowInput} />
        <HistorySection data={data} />

        <footer className="pb-6 text-center text-xs text-muted-foreground">
          異常門檻僅作家庭照護提醒，不取代醫療判斷；請依醫囑或照護團隊建議處理。
        </footer>
      </div>
    </main>
  );
}

function ChangePasswordPanel({ status }: { status?: string }) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
      <h2 className="font-bold">修改密碼</h2>
      {status ? (
        <p className={`mt-2 rounded-xl p-2 text-xs ${status === "changed" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {passwordMessage(status)}
        </p>
      ) : null}
      <form action={changePasswordAction} className="mt-3 grid gap-2">
        <div className="grid gap-1">
          <Label htmlFor="currentPassword">目前密碼</Label>
          <Input id="currentPassword" name="currentPassword" type="password" required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="nextPassword">新密碼（至少 8 碼）</Label>
          <Input id="nextPassword" name="nextPassword" type="password" minLength={8} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="confirmPassword">再次輸入新密碼</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
        </div>
        <Button type="submit" variant="secondary" className="min-h-10">
          更新密碼
        </Button>
      </form>
    </section>
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

function toDateTimeLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}
