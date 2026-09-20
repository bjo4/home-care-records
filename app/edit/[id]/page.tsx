import { AppFrame } from "@/components/app-frame";
import { EditRecordForm } from "@/components/edit-record-form";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditRecordPage({ params }: Props) {
  await requireCurrentUser();
  const { id } = await params;
  const data = await getCareLog();
  const record = data.records.find((item) => item.id === id);

  if (!record) {
    notFound();
  }

  return (
    <AppFrame
      active="history"
      title="編輯紀錄"
      description="保留原記錄人；儲存後會標示最後修改者。"
    >
      <EditRecordForm record={record} />
    </AppFrame>
  );
}
