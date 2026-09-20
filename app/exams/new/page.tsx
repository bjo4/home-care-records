import { AppFrame } from "@/components/app-frame";
import { requireCurrentUser } from "@/lib/session";
import { ExamForm } from "../page";
export default async function NewExamPage(){ const user=await requireCurrentUser(); return <AppFrame active="care" title="新增檢查" description="記錄檢查時間、地點與狀態。"><ExamForm user={user.displayName} /></AppFrame>; }
