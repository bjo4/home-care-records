import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CircleCheckBig } from "lucide-react";
import type { ReactNode } from "react";
import {
  type BloodPressureRecord,
  type CareLogData,
  type CareRecord,
  type MedicationRecord,
  type SymptomsRecord,
  type TemperatureRecord,
  type WeightRecord,
} from "@/lib/care-records";

type Props = {
  data: CareLogData;
  todayEntries: CareRecord[];
};

export function TodaySummary({ data, todayEntries }: Props) {
  const latestTemperature = latestOfType<TemperatureRecord>(data, "temperature");
  const latestBp = latestOfType<BloodPressureRecord>(data, "bloodPressure");
  const latestWeight = latestOfType<WeightRecord>(data, "weight");
  const alertCount = todayEntries.filter((record) => record.abnormal).length;
  const todayMeds = todayEntries.filter(
    (record): record is MedicationRecord => record.type === "medication",
  );
  const hasCleanDay = todayEntries.some(
    (record): record is SymptomsRecord =>
      record.type === "symptoms" && record.cleanDay,
  );
  const medStatus =
    todayMeds.length === 0
      ? "尚未記錄"
      : todayMeds.some((record) => !record.taken)
        ? "有未吃"
        : "已確認";

  return (
    <section id="today" className="grid gap-4 scroll-mt-24">
      <div
        className={`rounded-3xl border p-4 shadow-sm ${
          alertCount > 0
            ? "border-red-200 bg-red-50 text-red-950"
            : "border-emerald-200 bg-emerald-50 text-emerald-950"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/80">
              {alertCount > 0 ? (
                <AlertTriangle aria-hidden="true" className="size-6" />
              ) : (
                <CircleCheckBig aria-hidden="true" className="size-6" />
              )}
            </span>
            <div>
            <p className="text-sm font-bold">
              {alertCount > 0 ? "今天有需要留意的紀錄" : "今天目前平穩"}
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {alertCount > 0 ? `${alertCount} 筆警示` : "沒有異常標示"}
            </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <span className="rounded-2xl bg-white/80 px-3 py-2 font-semibold">
              吃藥：{medStatus}
            </span>
            <span className="rounded-2xl bg-white/80 px-3 py-2 font-semibold">
              症狀：{hasCleanDay ? "無異狀" : "待確認"}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          title="今日筆數"
          value={`${todayEntries.length}`}
          helper="所有類型"
        />
        <MetricCard
          title="最新體溫"
          value={latestTemperature ? `${latestTemperature.value.toFixed(1)}°C` : "尚無"}
          helper={latestTemperature ? formatShortTime(latestTemperature.datetime) : "先新增一筆"}
          abnormal={latestTemperature?.abnormal}
        />
        <MetricCard
          title="最新血壓"
          value={latestBp ? `${latestBp.systolic}/${latestBp.diastolic}` : "尚無"}
          helper={latestBp ? bpHelper(latestBp) : "先新增一筆"}
          abnormal={latestBp?.abnormal}
        />
        <MetricCard
          title="最新體重"
          value={latestWeight ? `${latestWeight.value.toFixed(1)}kg` : "尚無"}
          helper={latestWeight ? formatShortTime(latestWeight.datetime) : "先新增一筆"}
          abnormal={latestWeight?.abnormal}
        />
      </div>

      <Card className="bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle>今日紀錄</CardTitle>
          <CardDescription>依時間由新到舊排列，方便交班快速查看。</CardDescription>
        </CardHeader>
        <CardContent>
          {todayEntries.length === 0 ? (
            <EmptyState
              title="今天還沒有紀錄"
              body="登入者已自動帶入。早上可先記吃藥、體溫與血壓；晚上可一鍵記錄今日無異狀。"
            />
          ) : (
            <RecordList records={todayEntries} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function HistorySection({ data }: { data: CareLogData }) {
  const records = [...data.records].sort((a, b) =>
    b.datetime.localeCompare(a.datetime),
  );
  const temperatures = recordsOfType<TemperatureRecord>(data, "temperature");
  const bloodPressures = recordsOfType<BloodPressureRecord>(data, "bloodPressure");
  const weights = recordsOfType<WeightRecord>(data, "weight");

  return (
    <section id="history" className="grid gap-4">
      <Card className="bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle>最近紀錄</CardTitle>
          <CardDescription>最近 30 筆，先看文字列表最省力。</CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <EmptyState
              title="目前沒有任何歷史紀錄"
              body="可從空白開始，或用 demo seed 建立範例資料試看趨勢圖。"
            />
          ) : (
            <RecordList records={records.slice(0, 30)} />
          )}
        </CardContent>
      </Card>

      <details className="rounded-3xl border border-white/80 bg-white/95 shadow-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 py-3">
          <span>
            <span className="block text-lg font-black">趨勢圖</span>
            <span className="text-sm text-muted-foreground">需要比較時再展開</span>
          </span>
          <span className="rounded-full bg-muted px-3 py-2 text-sm font-bold text-muted-foreground">
            展開
          </span>
        </summary>
        <div className="grid gap-4 border-t bg-stone-50/60 p-4">
          <TrendCard title="體溫趨勢" description="°C，37.5 以上警示">
            <LineChart
              series={[
                {
                  label: "體溫",
                  color: "#dc2626",
                  points: temperatures.map((record) => ({
                    label: formatShortDateTime(record.datetime),
                    value: record.value,
                  })),
                },
              ]}
              suffix="°C"
            />
          </TrendCard>
          <TrendCard title="血壓趨勢" description="收縮壓 / 舒張壓">
            <LineChart
              series={[
                {
                  label: "收縮壓",
                  color: "#2563eb",
                  points: bloodPressures.map((record) => ({
                    label: formatShortDateTime(record.datetime),
                    value: record.systolic,
                  })),
                },
                {
                  label: "舒張壓",
                  color: "#16a34a",
                  points: bloodPressures.map((record) => ({
                    label: formatShortDateTime(record.datetime),
                    value: record.diastolic,
                  })),
                },
              ]}
              suffix=" mmHg"
            />
          </TrendCard>
          <TrendCard title="體重趨勢" description="kg">
            <LineChart
              series={[
                {
                  label: "體重",
                  color: "#7c3aed",
                  points: weights.map((record) => ({
                    label: formatShortDateTime(record.datetime),
                    value: record.value,
                  })),
                },
              ]}
              suffix="kg"
            />
          </TrendCard>
        </div>
      </details>
    </section>
  );
}

function MetricCard({
  title,
  value,
  helper,
  abnormal,
}: {
  title: string;
  value: string;
  helper: string;
  abnormal?: boolean;
}) {
  return (
    <Card
      className={
        abnormal
          ? "min-h-28 border-red-200 bg-red-50 shadow-sm"
          : "min-h-28 bg-white/95 shadow-sm"
      }
    >
      <CardContent className="grid gap-1 py-4">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <strong className="text-2xl leading-tight">{value}</strong>
        <span className={abnormal ? "text-xs text-red-700" : "text-xs text-muted-foreground"}>
          {helper}
        </span>
      </CardContent>
    </Card>
  );
}

function RecordList({ records }: { records: CareRecord[] }) {
  return (
    <ol className="grid gap-3">
      {records.map((record) => (
        <li
          key={record.id}
          className={`rounded-2xl border p-3 ${
            record.abnormal ? "border-red-200 bg-red-50" : "border-border bg-white"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={record.abnormal ? "destructive" : "secondary"}>
                  {recordLabel(record)}
                </Badge>
                {record.abnormal ? (
                  <span className="text-xs font-semibold text-red-700">需留意</span>
                ) : null}
              </div>
              <p className="mt-1 text-base font-semibold">{recordHeadline(record)}</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(record.datetime)}</p>
            </div>
            <p className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
              {recordPerson(record)}
            </p>
          </div>
          {record.notes ? (
            <>
              <Separator className="my-3" />
              <p className="text-sm text-muted-foreground">{record.notes}</p>
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function TrendCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="bg-white/95 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function LineChart({
  series,
  suffix,
}: {
  series: {
    label: string;
    color: string;
    points: { label: string; value: number }[];
  }[];
  suffix: string;
}) {
  const allPoints = series.flatMap((item) => item.points);

  if (allPoints.length === 0) {
    return <EmptyState title="尚無資料" body="新增紀錄後會出現趨勢。" />;
  }

  const width = 320;
  const height = 150;
  const padding = 24;
  const values = allPoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  function xy(value: number, index: number, count: number) {
    const x =
      count === 1
        ? width / 2
        : padding + (index / (count - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);

    return { x, y };
  }

  return (
    <div className="grid gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="趨勢圖"
        className="h-40 w-full rounded-xl bg-muted/40"
      >
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="#d4d4d8" />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="#d4d4d8" />
        {series.map((item) => {
          const pathData = item.points
            .map((point, index) => {
              const pointXY = xy(point.value, index, item.points.length);
              return `${index === 0 ? "M" : "L"} ${pointXY.x} ${pointXY.y}`;
            })
            .join(" ");

          return (
            <g key={item.label}>
              <path d={pathData} fill="none" stroke={item.color} strokeLinecap="round" strokeWidth="3" />
              {item.points.map((point, index) => {
                const pointXY = xy(point.value, index, item.points.length);
                return (
                  <circle
                    key={`${item.label}-${point.label}-${index}`}
                    cx={pointXY.x}
                    cy={pointXY.y}
                    r="4"
                    fill={item.color}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-2 text-xs">
        {series.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        範圍：{min.toFixed(1)}
        {suffix} - {max.toFixed(1)}
        {suffix}
      </p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-center">
      <p className="font-semibold">{title}</p>
      {body ? <p className="mt-1 text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}

function latestOfType<T extends CareRecord>(
  data: CareLogData,
  type: T["type"],
): T | undefined {
  return recordsOfType<T>(data, type).at(-1);
}

function recordsOfType<T extends CareRecord>(data: CareLogData, type: T["type"]) {
  return data.records
    .filter((record): record is T => record.type === type)
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

function recordLabel(record: CareRecord) {
  const labels: Record<CareRecord["type"], string> = {
    temperature: "體溫",
    bloodPressure: "血壓",
    medication: "吃藥",
    symptoms: "症狀",
    weight: "體重",
  };

  return labels[record.type];
}

function recordHeadline(record: CareRecord) {
  switch (record.type) {
    case "temperature":
      return `${record.value.toFixed(1)}°C（${record.site}）`;
    case "bloodPressure":
      return `${record.systolic}/${record.diastolic} mmHg${record.pulse ? `，脈搏 ${record.pulse}` : ""}（${record.posture}）`;
    case "medication":
      return `${record.drugName}：${record.taken ? "已吃" : "未吃/吐掉"}`;
    case "symptoms":
      return record.cleanDay
        ? "今日無異狀"
        : `${record.symptoms.join("、") || "未勾選"}，${record.severity}`;
    case "weight":
      return `${record.value.toFixed(1)} kg（衣著：${record.clothing}）`;
  }
}

function recordPerson(record: CareRecord) {
  return record.type === "medication"
    ? `確認：${record.confirmedBy}`
    : `記錄：${record.recordedBy}`;
}

function bpHelper(record: BloodPressureRecord) {
  return record.pulse ? `脈搏 ${record.pulse}` : "未記脈搏";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}
