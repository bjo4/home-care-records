import { deleteVisitAction, saveVisitAction } from "@/app/actions";
import { AppFrame } from "@/components/app-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

export default async function VisitsPage() {
  await requireCurrentUser();
  const data = await getCareLog();
  const visits = [...data.visits].sort((a, b) => b.date.localeCompare(a.date));

  return <AppFrame active="care" title="看診" description="整理科別、醫囑與下次回診日期。"><a href="/visits/new" className="flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-4 font-bold text-white">新增看診</a><VisitList visits={visits} /></AppFrame>;
}

export function VisitForm({ user, edit }: { user: string; edit?: Awaited<ReturnType<typeof getCareLog>>["visits"][number] }) {
  return <section className="rounded-3xl bg-white/95 p-4 shadow-sm"><h2 className="text-xl font-black">{edit ? "編輯看診" : "新增看診"}</h2><form action={saveVisitAction} className="mt-4 grid gap-3"><input type="hidden" name="id" value={edit?.id ?? ""} /><input type="hidden" name="recordedBy" value={edit?.recordedBy ?? user} /><input type="hidden" name="createdAt" value={edit?.createdAt ?? ""} /><Field label="科別" htmlFor="department"><Input id="department" name="department" defaultValue={edit?.department ?? ""} required /></Field><Field label="日期" htmlFor="date"><Input id="date" name="date" type="date" defaultValue={edit?.date ?? ""} required /></Field><Field label="醫師（選填）" htmlFor="doctor"><Input id="doctor" name="doctor" defaultValue={edit?.doctor ?? ""} /></Field><Field label="醫囑/重點" htmlFor="instructions"><Textarea id="instructions" name="instructions" defaultValue={edit?.instructions ?? ""} required /></Field><Field label="下次回診（選填）" htmlFor="followUpDate"><Input id="followUpDate" name="followUpDate" type="date" defaultValue={edit?.followUpDate ?? ""} /></Field><Button type="submit" className="rounded-2xl">{edit ? "儲存看診" : "新增看診"}</Button></form></section>;
}

function VisitList({ visits }: { visits: Awaited<ReturnType<typeof getCareLog>>["visits"] }) {
  return <section className="rounded-3xl bg-white/95 p-4 shadow-sm"><h2 className="text-xl font-black">看診列表</h2>{visits.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">尚無看診。</p> : <ol className="mt-3 grid gap-2">{visits.map((visit) => <li key={visit.id} className="rounded-2xl border bg-white p-3"><div className="flex justify-between gap-2"><div><p className="font-bold">{visit.department}</p><p className="text-sm text-muted-foreground">{visit.date}{visit.doctor ? `｜${visit.doctor}` : ""}</p><p className="mt-1 text-sm">{visit.instructions}</p>{visit.followUpDate ? <p className="mt-1 text-sm text-emerald-700">下次：{visit.followUpDate}</p> : null}</div><a className="text-sm font-bold text-emerald-700" href={`/visits/${visit.id}/edit`}>編輯</a></div><form action={deleteVisitAction} className="mt-3"><input type="hidden" name="id" value={visit.id} /><Button type="submit" variant="destructive" className="w-full rounded-2xl">刪除</Button></form></li>)}</ol>}</section>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
