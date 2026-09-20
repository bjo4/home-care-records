import { AppFrame, PrimaryLink } from "@/components/app-frame";
import { TodaySummary } from "@/components/care-summary";
import { QuickCleanDayForm } from "@/components/record-forms";
import { getTodayEntries } from "@/lib/care-records";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await requireCurrentUser();
  const data = await getCareLog();
  const todayEntries = getTodayEntries(data);
  const nowInput = toDateTimeLocalInput(new Date());

  return (
    <AppFrame
      active="today"
      title="今天照顧狀態"
      description="先看有沒有警示，再選一個最常用動作。"
      actions={<PrimaryLink href="/add">去記錄</PrimaryLink>}
    >
      <TodaySummary data={data} todayEntries={todayEntries} />
      <QuickCleanDayForm caregiver={user.displayName} nowInput={nowInput} />
    </AppFrame>
  );
}

function toDateTimeLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}
