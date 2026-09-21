import { AppFrame } from "@/components/app-frame";
import {
  ADD_RECORD_OPTIONS,
  QuickCleanDayForm,
  SingleRecordForm,
  type RecordKind,
} from "@/components/record-forms";
import { buttonVariants } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/session";
import {
  AlertTriangle,
  Droplet,
  HeartPulse,
  Pill,
  Scale,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";

const ADD_ICONS: Record<RecordKind, LucideIcon> = {
  temperature: Thermometer,
  bloodPressure: HeartPulse,
  bloodGlucose: Droplet,
  bloodOxygen: Wind,
  medication: Pill,
  symptoms: AlertTriangle,
  weight: Scale,
};

type Props = {
  searchParams?: Promise<{
    type?: string;
  }>;
};

export default async function AddPage({ searchParams }: Props) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const kind = normalizeKind(params?.type);
  const nowInput = toDateTimeLocalInput(new Date());

  return (
    <AppFrame
      active="add"
      title={kind ? selectedTitle(kind) : "新增紀錄"}
      description={
        kind
          ? "只填這一項，送出後回到今日摘要。"
          : "先選一種紀錄。常用的「今日無異狀」可以直接一鍵完成。"
      }
    >
      {kind ? (
        <div className="grid gap-4">
          <a
            href="/add"
            className="w-fit rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm"
          >
            ← 回到種類
          </a>
          <SingleRecordForm kind={kind} caregiver={user.displayName} nowInput={nowInput} />
        </div>
      ) : (
        <div className="grid gap-4">
          <QuickCleanDayForm caregiver={user.displayName} nowInput={nowInput} />
          <section className="grid gap-3">
            {ADD_RECORD_OPTIONS.map((option) => (
              <AddChoice key={option.kind} option={option} />
            ))}
          </section>
        </div>
      )}
    </AppFrame>
  );
}

function AddChoice({
  option,
}: {
  option: (typeof ADD_RECORD_OPTIONS)[number];
}) {
  const Icon = ADD_ICONS[option.kind];

  return (
    <a
      href={`/add?type=${option.kind}`}
      className="grid grid-cols-[3rem_1fr] gap-3 rounded-3xl border border-white/80 bg-white/95 p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Icon aria-hidden="true" className="size-6" strokeWidth={2.4} />
      </span>
      <span>
        <span className="block text-xl font-black text-stone-950">
          {option.title}
        </span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
          {option.description}
        </span>
        <span className={buttonVariants({ variant: "secondary", className: "mt-3 rounded-2xl" })}>
          開始填寫
        </span>
      </span>
    </a>
  );
}

function normalizeKind(kind?: string): RecordKind | undefined {
  return ADD_RECORD_OPTIONS.some((option) => option.kind === kind)
    ? (kind as RecordKind)
    : undefined;
}

function selectedTitle(kind: RecordKind) {
  return ADD_RECORD_OPTIONS.find((option) => option.kind === kind)?.title ?? "新增紀錄";
}

function toDateTimeLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}
