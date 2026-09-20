import { AppFrame } from "@/components/app-frame";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { VisitForm } from "../../page";
type Props={params:Promise<{id:string}>};
export default async function EditVisitPage({params}:Props){ const user=await requireCurrentUser(); const {id}=await params; const data=await getCareLog(); const edit=data.visits.find((x)=>x.id===id); if(!edit) notFound(); return <AppFrame active="care" title="編輯看診" description="更新醫囑與追蹤日期。"><VisitForm user={user.displayName} edit={edit} /></AppFrame>; }
