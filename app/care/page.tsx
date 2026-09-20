import { AppFrame } from "@/components/app-frame";
import { getCareLog, getDueReminders } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";
import { Bell, CalendarCheck, ClipboardList, Hospital } from "lucide-react";

export default async function CareHubPage() {
  await requireCurrentUser();
  const data = await getCareLog();
  const due = getDueReminders(data);
  const activeMeds = data.medicationOrders.filter((order) => order.status === "進行中");
  const pendingExams = data.exams.filter((exam) => exam.status !== "完成");
  const upcomingVisits = data.visits.filter((visit) => !visit.followUpDate || visit.followUpDate >= new Date().toISOString().slice(0, 10));

  const items = [
    { href: "/reminders", label: "提醒", helper: `${due.length} 項待辦`, icon: Bell },
    { href: "/meds", label: "醫囑", helper: `${activeMeds.length} 項進行中`, icon: ClipboardList },
    { href: "/exams", label: "檢查", helper: `${pendingExams.length} 項未完成`, icon: CalendarCheck },
    { href: "/visits", label: "看診", helper: `${upcomingVisits.length} 筆紀錄`, icon: Hospital },
  ];

  return (
    <AppFrame active="care" title="照護" description="提醒、醫囑、檢查與看診集中在這裡。">
      <section className="grid gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a key={item.href} href={item.href} className="grid grid-cols-[3rem_1fr] gap-3 rounded-3xl bg-white/95 p-4 shadow-sm">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span>
                <span className="block text-xl font-black">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.helper}</span>
              </span>
            </a>
          );
        })}
        <a href="/history" className="rounded-3xl bg-white/80 p-4 text-center text-sm font-bold text-emerald-800 shadow-sm">
          查看全部照護紀錄
        </a>
      </section>
    </AppFrame>
  );
}
