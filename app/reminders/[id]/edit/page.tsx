import { AppFrame } from "@/components/app-frame";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { ReminderForm } from "../../page";
type Props={params:Promise<{id:string}>};
export default async function EditReminderPage({params}:Props){ const user=await requireCurrentUser(); const {id}=await params; const data=await getCareLog(); const edit=data.reminders.find((x)=>x.id===id); if(!edit) notFound(); return <AppFrame active="care" title="編輯提醒" description="更新到期時間、重複與完成狀態。"><ReminderForm user={user.displayName} edit={edit} /></AppFrame>; }
