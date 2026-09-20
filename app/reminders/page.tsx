import {
  completeReminderAction,
  deleteReminderAction,
  saveReminderAction,
} from "@/app/actions";
import { AppFrame } from "@/components/app-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCareLog, getDueReminders } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

const reminderTypes = ["吃藥", "量體溫", "量血壓", "量血糖", "回診", "檢查", "禁食", "其他"];
const recurrences = [
  ["none", "不重複"],
  ["daily", "每天"],
  ["weekly", "每週"],
  ["custom", "自訂"],
];

export default async function RemindersPage() {
  await requireCurrentUser();
  const data = await getCareLog();
  const due = getDueReminders(data);
  const all = [...data.reminders].sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <AppFrame active="care" title="提醒" description="今日待辦與未來 48 小時到期提醒。">
      <section className="rounded-3xl bg-white/95 p-4 shadow-sm">
        <h2 className="text-xl font-black">即將到期</h2>
        <ReminderList reminders={due} empty="未來 48 小時沒有待辦提醒。" />
      </section>
      <a href="/reminders/new" className="flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-4 font-bold text-white">
        新增提醒
      </a>
      <section className="rounded-3xl bg-white/95 p-4 shadow-sm">
        <h2 className="text-xl font-black">所有提醒</h2>
        <ReminderList reminders={all} empty="尚無提醒。" showActions />
      </section>
    </AppFrame>
  );
}

export function ReminderForm({ user, edit }: { user: string; edit?: Awaited<ReturnType<typeof getCareLog>>["reminders"][number] }) {
  return (
    <section className="rounded-3xl bg-white/95 p-4 shadow-sm">
      <h2 className="text-xl font-black">{edit ? "編輯提醒" : "新增提醒"}</h2>
      <form action={saveReminderAction} className="mt-4 grid gap-3">
        <input type="hidden" name="id" value={edit?.id ?? ""} />
        <input type="hidden" name="recordedBy" value={edit?.recordedBy ?? user} />
        <input type="hidden" name="createdAt" value={edit?.createdAt ?? ""} />
        <Field label="類型" htmlFor="type">
          <Select id="type" name="type" options={reminderTypes} defaultValue={edit?.type ?? "吃藥"} />
        </Field>
        <Field label="到期時間" htmlFor="dueAt">
          <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={edit?.dueAt ?? ""} required />
        </Field>
        <Field label="重複" htmlFor="recurrence">
          <Select id="recurrence" name="recurrence" options={recurrences.map((item) => item[0])} labels={Object.fromEntries(recurrences)} defaultValue={edit?.recurrence ?? "none"} />
        </Field>
        <Field label="備註" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={edit?.notes ?? ""} />
        </Field>
        <Button type="submit" className="rounded-2xl">{edit ? "儲存提醒" : "新增提醒"}</Button>
      </form>
    </section>
  );
}

function ReminderList({ reminders, empty, showActions = false }: { reminders: Awaited<ReturnType<typeof getCareLog>>["reminders"]; empty: string; showActions?: boolean }) {
  if (reminders.length === 0) return <p className="mt-3 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="mt-3 grid gap-2">
      {reminders.map((reminder) => (
        <li key={reminder.id} className={`rounded-2xl border p-3 ${reminder.completed ? "bg-muted/40" : "bg-white"}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold">{reminder.type}</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(reminder.dueAt)} · {reminder.completed ? "已完成" : "待辦"}</p>
              {reminder.notes ? <p className="mt-1 text-sm">{reminder.notes}</p> : null}
            </div>
            {showActions ? <a className="text-sm font-bold text-emerald-700" href={`/reminders/${reminder.id}/edit`}>編輯</a> : null}
          </div>
          {showActions ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {!reminder.completed ? (
                <form action={completeReminderAction}>
                  <input type="hidden" name="id" value={reminder.id} />
                  <Button type="submit" variant="secondary" className="w-full rounded-2xl">完成</Button>
                </form>
              ) : <span />}
              <form action={deleteReminderAction}>
                <input type="hidden" name="id" value={reminder.id} />
                <Button type="submit" variant="destructive" className="w-full rounded-2xl">刪除</Button>
              </form>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function Select({ id, name, options, labels, defaultValue }: { id: string; name: string; options: string[]; labels?: Record<string, string>; defaultValue?: string }) {
  return <select id={id} name={name} defaultValue={defaultValue} className="min-h-12 rounded-xl border bg-white px-3">{options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}</select>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
