import { AppFrame } from "@/components/app-frame";
import { HistorySection } from "@/components/care-summary";
import { getCareLog } from "@/lib/care-store";
import { requireCurrentUser } from "@/lib/session";

export default async function HistoryPage() {
  await requireCurrentUser();
  const data = await getCareLog();

  return (
    <AppFrame
      active="care"
      title="歷史紀錄"
      description="先看最近紀錄；需要比較趨勢時再展開圖表。"
    >
      <HistorySection data={data} />
    </AppFrame>
  );
}
