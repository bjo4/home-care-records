import { AppFrame } from "@/components/app-frame";
import { requireCurrentUser } from "@/lib/session";
import { VisitForm } from "../page";
export default async function NewVisitPage(){ const user=await requireCurrentUser(); return <AppFrame active="care" title="新增看診" description="記錄科別、醫囑與下次回診。"><VisitForm user={user.displayName} /></AppFrame>; }
