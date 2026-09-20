import { AppFrame } from "@/components/app-frame";
import { requireCurrentUser } from "@/lib/session";
import { ReminderForm } from "../page";
export default async function NewReminderPage(){ const user=await requireCurrentUser(); return <AppFrame active="care" title="新增提醒" description="設定到期時間與重複規則。"><ReminderForm user={user.displayName} /></AppFrame>; }
