import { AppFrame } from "@/components/app-frame";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { ExamForm } from "../../page";
type Props={params:Promise<{id:string}>};
export default async function EditExamPage({params}:Props){ const user=await requireCurrentUser(); const {id}=await params; const data=await getCareLog(); const edit=data.exams.find((x)=>x.id===id); if(!edit) notFound(); return <AppFrame active="care" title="編輯檢查" description="更新檢查狀態與結果摘要。"><ExamForm user={user.displayName} edit={edit} /></AppFrame>; }
