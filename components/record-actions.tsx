"use client";

import { deleteRecordAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function RecordActions({
  recordId,
  recordLabel,
}: {
  recordId: string;
  recordLabel: string;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <a
        href={`/edit/${recordId}`}
        className="flex min-h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800"
      >
        編輯
      </a>
      <form action={deleteRecordAction}>
        <input type="hidden" name="recordId" value={recordId} />
        <Button
          type="submit"
          variant="destructive"
          className="min-h-11 w-full rounded-2xl"
          onClick={(event) => {
            if (!window.confirm(`確定要刪除這筆${recordLabel}紀錄嗎？`)) {
              event.preventDefault();
            }
          }}
        >
          刪除
        </Button>
      </form>
    </div>
  );
}
