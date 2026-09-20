import { AppFrame } from "@/components/app-frame";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { MedForm } from "../../page";
type Props={params:Promise<{id:string}>};
export default async function EditMedPage({params}:Props){ const user=await requireCurrentUser(); const {id}=await params; const data=await getCareLog(); const edit=data.medicationOrders.find((x)=>x.id===id); if(!edit) notFound(); return <AppFrame active="care" title="編輯醫囑" description="調整劑量、頻率、狀態與注意事項。"><MedForm user={user.displayName} edit={edit} /></AppFrame>; }
