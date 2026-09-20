import { AppFrame, PrimaryLink } from "@/components/app-frame";
import { TodaySummary, VitalCharts } from "@/components/care-summary";
import { QuickCleanDayForm } from "@/components/record-forms";
import { getTodayEntries } from "@/lib/care-records";
import { getCareLog, getDueReminders } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await requireCurrentUser();
  const data = await getCareLog();
  const todayEntries = getTodayEntries(data);
  const dueReminders = getDueReminders(data, new Date(), 48);
  const activeMeds = data.medicationOrders.filter((order) => order.status === "進行中");
  const nowInput = toDateTimeLocalInput(new Date());

  return (
    <AppFrame
      active="today"
      title="今天照顧狀態"
      description="先看有沒有警示，再選一個最常用動作。"
      actions={
        <>
          <PrimaryLink href="/add">記一筆</PrimaryLink>
          <PrimaryLink href="/care">照護入口</PrimaryLink>
        </>
      }
    >
      <TodaySummary data={data} todayEntries={todayEntries} />
      <HomeCareStrip reminders={dueReminders} activeMeds={activeMeds} />
      <VitalCharts data={data} />
      <QuickCleanDayForm caregiver={user.displayName} nowInput={nowInput} />
    </AppFrame>
  );
}

function HomeCareStrip({
  reminders,
  activeMeds,
}: {
  reminders: Awaited<ReturnType<typeof getCareLog>>["reminders"];
  activeMeds: Awaited<ReturnType<typeof getCareLog>>["medicationOrders"];
}) {
  return (
    <section className="grid gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
      <div>
        <p className="text-sm font-bold">即將到期／今日待辦</p>
        <p className="mt-1 text-2xl font-black">{reminders.length} 項提醒</p>
      </div>
      {reminders.slice(0, 3).map((reminder) => (
        <a key={reminder.id} href="/reminders" className="rounded-2xl bg-white/80 p-3 text-sm">
          <strong>{reminder.type}</strong>
          <span className="ml-2 text-muted-foreground">
            {new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(reminder.dueAt))}
          </span>
        </a>
      ))}
      <a href="/meds" className="rounded-2xl bg-white/80 p-3 text-sm">
        進行中醫囑：<strong>{activeMeds.length}</strong> 項
      </a>
    </section>
  );
}

function toDateTimeLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}
