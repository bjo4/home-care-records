import { deleteExamAction, saveExamAction } from "@/app/actions";
import { AppFrame } from "@/components/app-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

export default async function ExamsPage() {
  await requireCurrentUser();
  const data = await getCareLog();
  const exams = [...data.exams].sort((a, b) => b.datetime.localeCompare(a.datetime));

  return <AppFrame active="care" title="檢查" description="記錄檢查安排、結果摘要與下次追蹤。"><a href="/exams/new" className="flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-4 font-bold text-white">新增檢查</a><ExamList exams={exams} /></AppFrame>;
}

export function ExamForm({ user, edit }: { user: string; edit?: Awaited<ReturnType<typeof getCareLog>>["exams"][number] }) {
  return <section className="rounded-3xl bg-white/95 p-4 shadow-sm"><h2 className="text-xl font-black">{edit ? "編輯檢查" : "新增檢查"}</h2><form action={saveExamAction} className="mt-4 grid gap-3"><input type="hidden" name="id" value={edit?.id ?? ""} /><input type="hidden" name="recordedBy" value={edit?.recordedBy ?? user} /><input type="hidden" name="createdAt" value={edit?.createdAt ?? ""} /><Field label="檢查名稱" htmlFor="name"><Input id="name" name="name" defaultValue={edit?.name ?? ""} required /></Field><Field label="時間" htmlFor="datetime"><Input id="datetime" name="datetime" type="datetime-local" defaultValue={edit?.datetime ?? ""} required /></Field><Field label="地點/醫院" htmlFor="location"><Input id="location" name="location" defaultValue={edit?.location ?? ""} /></Field><Field label="狀態" htmlFor="status"><Select id="status" name="status" options={["待做", "完成", "待報告"]} defaultValue={edit?.status ?? "待做"} /></Field><Field label="結果摘要" htmlFor="resultSummary"><Textarea id="resultSummary" name="resultSummary" defaultValue={edit?.resultSummary ?? ""} /></Field><Field label="下次追蹤（選填）" htmlFor="nextDue"><Input id="nextDue" name="nextDue" type="date" defaultValue={edit?.nextDue ?? ""} /></Field><Button type="submit" className="rounded-2xl">{edit ? "儲存檢查" : "新增檢查"}</Button></form></section>;
}

function ExamList({ exams }: { exams: Awaited<ReturnType<typeof getCareLog>>["exams"] }) {
  return <section className="rounded-3xl bg-white/95 p-4 shadow-sm"><h2 className="text-xl font-black">檢查列表</h2>{exams.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">尚無檢查。</p> : <ol className="mt-3 grid gap-2">{exams.map((exam) => <li key={exam.id} className="rounded-2xl border bg-white p-3"><div className="flex justify-between gap-2"><div><p className="font-bold">{exam.name}</p><p className="text-sm text-muted-foreground">{exam.status}｜{formatDateTime(exam.datetime)}｜{exam.location || "未填地點"}</p>{exam.resultSummary ? <p className="mt-1 text-sm">{exam.resultSummary}</p> : null}</div><a className="text-sm font-bold text-emerald-700" href={`/exams/${exam.id}/edit`}>編輯</a></div><form action={deleteExamAction} className="mt-3"><input type="hidden" name="id" value={exam.id} /><Button type="submit" variant="destructive" className="w-full rounded-2xl">刪除</Button></form></li>)}</ol>}</section>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
function Select({ id, name, options, defaultValue }: { id: string; name: string; options: string[]; defaultValue?: string }) { return <select id={id} name={name} defaultValue={defaultValue} className="min-h-12 rounded-xl border bg-white px-3">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
