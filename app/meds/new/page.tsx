import { AppFrame } from "@/components/app-frame";
import { requireCurrentUser } from "@/lib/session";
import { MedForm } from "../page";
export default async function NewMedPage(){ const user=await requireCurrentUser(); return <AppFrame active="care" title="新增醫囑" description="新增目前進行中的用藥醫囑。"><MedForm user={user.displayName} /></AppFrame>; }
