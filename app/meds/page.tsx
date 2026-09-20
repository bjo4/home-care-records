import { deleteMedicationOrderAction, saveMedicationOrderAction, stopMedicationOrderAction } from "@/app/actions";
import { AppFrame } from "@/components/app-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

type Props = { searchParams?: Promise<{ edit?: string }> };

export default async function MedsPage({ searchParams }: Props) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const data = await getCareLog();
  const edit = data.medicationOrders.find((order) => order.id === params?.edit);
  const active = data.medicationOrders.filter((order) => order.status === "進行中");
  const stopped = data.medicationOrders.filter((order) => order.status === "已停");

  return (
    <AppFrame active="today" title="用藥醫囑" description="保存目前進行中的用藥與停用紀錄。">
      <MedForm user={user.displayName} edit={edit} />
      <MedList title="進行中" orders={active} />
      <MedList title="已停" orders={stopped} />
    </AppFrame>
  );
}

function MedForm({ user, edit }: { user: string; edit?: Awaited<ReturnType<typeof getCareLog>>["medicationOrders"][number] }) {
  return (
    <section className="rounded-3xl bg-white/95 p-4 shadow-sm">
      <h2 className="text-xl font-black">{edit ? "編輯醫囑" : "新增醫囑"}</h2>
      <form action={saveMedicationOrderAction} className="mt-4 grid gap-3">
        <input type="hidden" name="id" value={edit?.id ?? ""} />
        <input type="hidden" name="recordedBy" value={edit?.recordedBy ?? user} />
        <input type="hidden" name="createdAt" value={edit?.createdAt ?? ""} />
        <Field label="藥名" htmlFor="drugName"><Input id="drugName" name="drugName" defaultValue={edit?.drugName ?? ""} required /></Field>
        <Field label="劑量" htmlFor="dose"><Input id="dose" name="dose" defaultValue={edit?.dose ?? ""} required /></Field>
        <Field label="頻率" htmlFor="frequency"><Input id="frequency" name="frequency" defaultValue={edit?.frequency ?? ""} required /></Field>
        <Field label="途徑" htmlFor="route"><Select id="route" name="route" options={["口服", "點滴", "其他"]} defaultValue={edit?.route ?? "口服"} /></Field>
        <Field label="何時吃" htmlFor="scheduleHint"><Input id="scheduleHint" name="scheduleHint" defaultValue={edit?.scheduleHint ?? ""} required /></Field>
        <Field label="開始日" htmlFor="startDate"><Input id="startDate" name="startDate" type="date" defaultValue={edit?.startDate ?? ""} required /></Field>
        <Field label="停用日（選填）" htmlFor="stopDate"><Input id="stopDate" name="stopDate" type="date" defaultValue={edit?.stopDate ?? ""} /></Field>
        <Field label="狀態" htmlFor="status"><Select id="status" name="status" options={["進行中", "已停"]} defaultValue={edit?.status ?? "進行中"} /></Field>
        <Field label="注意事項" htmlFor="precautions"><Textarea id="precautions" name="precautions" defaultValue={edit?.precautions ?? ""} /></Field>
        <Field label="備註" htmlFor="notes"><Textarea id="notes" name="notes" defaultValue={edit?.notes ?? ""} /></Field>
        <Button type="submit" className="rounded-2xl">{edit ? "儲存醫囑" : "新增醫囑"}</Button>
      </form>
    </section>
  );
}

function MedList({ title, orders }: { title: string; orders: Awaited<ReturnType<typeof getCareLog>>["medicationOrders"] }) {
  return (
    <section className="rounded-3xl bg-white/95 p-4 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      {orders.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">尚無資料。</p> : <ol className="mt-3 grid gap-2">{orders.map((order) => <li key={order.id} className="rounded-2xl border bg-white p-3"><div className="flex justify-between gap-2"><div><p className="font-bold">{order.drugName} · {order.dose}</p><p className="text-sm text-muted-foreground">{order.frequency}｜{order.route}｜{order.scheduleHint}</p>{order.precautions ? <p className="mt-1 text-sm">{order.precautions}</p> : null}</div><a className="text-sm font-bold text-emerald-700" href={`/meds?edit=${order.id}`}>編輯</a></div><div className="mt-3 grid grid-cols-2 gap-2">{order.status === "進行中" ? <form action={stopMedicationOrderAction}><input type="hidden" name="id" value={order.id} /><Button type="submit" variant="secondary" className="w-full rounded-2xl">停用</Button></form> : <span />}<form action={deleteMedicationOrderAction}><input type="hidden" name="id" value={order.id} /><Button type="submit" variant="destructive" className="w-full rounded-2xl">刪除</Button></form></div></li>)}</ol>}
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
function Select({ id, name, options, defaultValue }: { id: string; name: string; options: string[]; defaultValue?: string }) { return <select id={id} name={name} defaultValue={defaultValue} className="min-h-12 rounded-xl border bg-white px-3">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
