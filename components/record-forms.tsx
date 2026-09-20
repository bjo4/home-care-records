import {
  addBloodPressureAction,
  addMedicationAction,
  addSymptomsAction,
  addTemperatureAction,
  addWeightAction,
} from "@/app/actions";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BP_POSTURES,
  CLOTHING_OPTIONS,
  MEDICATION_PRESETS,
  SEVERITY_OPTIONS,
  SYMPTOM_OPTIONS,
  TEMPERATURE_SITES,
} from "@/lib/care-records";

type Props = {
  caregiver: string;
  nowInput: string;
};

export function RecordForms({ caregiver, nowInput }: Props) {
  return (
    <section id="quick-add" className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-emerald-700">快速新增</p>
        <h2 className="text-2xl font-bold tracking-tight">今天要記什麼？</h2>
      </div>

      <QuickCleanDayForm caregiver={caregiver} nowInput={nowInput} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TemperatureForm caregiver={caregiver} nowInput={nowInput} />
        <BloodPressureForm caregiver={caregiver} nowInput={nowInput} />
        <MedicationForm caregiver={caregiver} nowInput={nowInput} />
        <SymptomsForm caregiver={caregiver} nowInput={nowInput} />
        <WeightForm caregiver={caregiver} nowInput={nowInput} />
      </div>
    </section>
  );
}

function QuickCleanDayForm({ caregiver, nowInput }: Props) {
  return (
    <form
      action={addSymptomsAction}
      className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm"
    >
      <input type="hidden" name="recordedBy" defaultValue={caregiver} data-caregiver-input />
      <input type="hidden" name="datetime" value={nowInput} />
      <input type="hidden" name="cleanDay" value="yes" />
      <input type="hidden" name="severity" value="無" />
      <input type="hidden" name="notes" value="今日無異狀" />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-sky-950">今日無異狀</h3>
          <p className="text-sm text-sky-800">
            晚上若沒有警訊症狀，可直接留下一筆乾淨紀錄。
          </p>
        </div>
        <Button type="submit" size="lg" className="min-h-12 bg-sky-700 hover:bg-sky-800">
          一鍵記錄
        </Button>
      </div>
    </form>
  );
}

function TemperatureForm({ caregiver, nowInput }: Props) {
  return (
    <FormCard title="體溫" description="早晚量測，37.5°C 以上會標示警示。">
      <form action={addTemperatureAction} className="grid gap-3">
        <HiddenCaregiver name="recordedBy" caregiver={caregiver} />
        <Field label="時間" htmlFor="temperature-datetime">
          <Input id="temperature-datetime" name="datetime" type="datetime-local" defaultValue={nowInput} required />
        </Field>
        <Field label="體溫（°C）" htmlFor="temperature-value">
          <Input id="temperature-value" name="value" type="number" step="0.1" min="30" max="45" placeholder="36.8" required />
        </Field>
        <Field label="部位" htmlFor="temperature-site">
          <NativeSelect id="temperature-site" name="site" options={TEMPERATURE_SITES} />
        </Field>
        <Field label="備註" htmlFor="temperature-notes">
          <Textarea id="temperature-notes" name="notes" placeholder="例如：微燒、剛喝熱水後重量" />
        </Field>
        <SubmitButton>新增體溫</SubmitButton>
      </form>
    </FormCard>
  );
}

function BloodPressureForm({ caregiver, nowInput }: Props) {
  return (
    <FormCard title="血壓" description="收縮壓/舒張壓與脈搏，超出常見範圍會標示。">
      <form action={addBloodPressureAction} className="grid gap-3">
        <HiddenCaregiver name="recordedBy" caregiver={caregiver} />
        <Field label="時間" htmlFor="bp-datetime">
          <Input id="bp-datetime" name="datetime" type="datetime-local" defaultValue={nowInput} required />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="收縮壓" htmlFor="bp-systolic">
            <Input id="bp-systolic" name="systolic" type="number" min="50" max="260" placeholder="120" required />
          </Field>
          <Field label="舒張壓" htmlFor="bp-diastolic">
            <Input id="bp-diastolic" name="diastolic" type="number" min="30" max="160" placeholder="80" required />
          </Field>
          <Field label="脈搏" htmlFor="bp-pulse">
            <Input id="bp-pulse" name="pulse" type="number" min="30" max="220" placeholder="78" required />
          </Field>
        </div>
        <Field label="姿勢" htmlFor="bp-posture">
          <NativeSelect id="bp-posture" name="posture" options={BP_POSTURES} />
        </Field>
        <Field label="備註" htmlFor="bp-notes">
          <Textarea id="bp-notes" name="notes" placeholder="例如：剛起床、吃藥前後" />
        </Field>
        <SubmitButton>新增血壓</SubmitButton>
      </form>
    </FormCard>
  );
}

function MedicationForm({ caregiver, nowInput }: Props) {
  return (
    <FormCard title="吃藥確認" description="預設早晨常用藥，可直接改成其他藥名或分類。">
      <form action={addMedicationAction} className="grid gap-3">
        <HiddenCaregiver name="confirmedBy" caregiver={caregiver} />
        <Field label="時間" htmlFor="med-datetime">
          <Input id="med-datetime" name="datetime" type="datetime-local" defaultValue={nowInput} required />
        </Field>
        <Field label="藥名/類別" htmlFor="med-name">
          <input
            id="med-name"
            name="drugName"
            list="medication-presets"
            defaultValue={MEDICATION_PRESETS[0].name}
            required
            className="min-h-10 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus:ring-4 focus:ring-ring/25"
          />
          <datalist id="medication-presets">
            {MEDICATION_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.name}>
                {preset.category}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="是否已吃" htmlFor="med-taken">
          <NativeSelect id="med-taken" name="taken" options={["yes", "no"]} labels={{ yes: "是，已吃", no: "否，未吃/吐掉" }} />
        </Field>
        <Field label="備註" htmlFor="med-notes">
          <Textarea id="med-notes" name="notes" placeholder="例如：漏吃、吃後吐掉、依醫囑暫停" />
        </Field>
        <SubmitButton>新增吃藥確認</SubmitButton>
      </form>
    </FormCard>
  );
}

function SymptomsForm({ caregiver, nowInput }: Props) {
  return (
    <FormCard title="警訊症狀" description="有任何異狀時填寫；無異狀可用上方一鍵記錄。">
      <form action={addSymptomsAction} className="grid gap-3">
        <HiddenCaregiver name="recordedBy" caregiver={caregiver} />
        <input type="hidden" name="cleanDay" value="no" />
        <Field label="時間" htmlFor="symptoms-datetime">
          <Input id="symptoms-datetime" name="datetime" type="datetime-local" defaultValue={nowInput} required />
        </Field>
        <div className="grid gap-2">
          <Label>症狀勾選</Label>
          <div className="grid grid-cols-2 gap-2">
            {SYMPTOM_OPTIONS.map((symptom) => (
              <label
                key={symptom}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm"
              >
                <input name="symptoms" type="checkbox" value={symptom} className="size-4" />
                {symptom}
              </label>
            ))}
          </div>
        </div>
        <Field label="嚴重程度" htmlFor="symptoms-severity">
          <NativeSelect id="symptoms-severity" name="severity" options={SEVERITY_OPTIONS} defaultValue="輕微" />
        </Field>
        <div className="grid gap-2">
          <ToggleLine name="clinicianNotified" label="已通知醫護/診所" />
          <ToggleLine name="soughtCare" label="已就醫或尋求緊急協助" />
        </div>
        <Field label="備註" htmlFor="symptoms-notes">
          <Textarea id="symptoms-notes" name="notes" placeholder="例如：時間、次數、伴隨情況" />
        </Field>
        <SubmitButton>新增症狀紀錄</SubmitButton>
      </form>
    </FormCard>
  );
}

function WeightForm({ caregiver, nowInput }: Props) {
  return (
    <FormCard title="體重" description="建議固定早晨、相似衣著；日變化 1kg 以上會標示。">
      <form action={addWeightAction} className="grid gap-3">
        <HiddenCaregiver name="recordedBy" caregiver={caregiver} />
        <Field label="時間" htmlFor="weight-datetime">
          <Input id="weight-datetime" name="datetime" type="datetime-local" defaultValue={nowInput} required />
        </Field>
        <Field label="體重（kg）" htmlFor="weight-value">
          <Input id="weight-value" name="value" type="number" step="0.1" min="20" max="200" placeholder="60.8" required />
        </Field>
        <Field label="衣著" htmlFor="weight-clothing">
          <NativeSelect id="weight-clothing" name="clothing" options={CLOTHING_OPTIONS} />
        </Field>
        <Field label="備註" htmlFor="weight-notes">
          <Textarea id="weight-notes" name="notes" placeholder="例如：厚外套、飯後" />
        </Field>
        <SubmitButton>新增體重</SubmitButton>
      </form>
    </FormCard>
  );
}

function FormCard({
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

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function HiddenCaregiver({ name, caregiver }: { name: string; caregiver: string }) {
  return (
    <input
      type="hidden"
      name={name}
      defaultValue={caregiver}
      data-caregiver-input
    />
  );
}

function NativeSelect({
  id,
  name,
  options,
  labels,
  defaultValue,
}: {
  id: string;
  name: string;
  options: readonly string[];
  labels?: Record<string, string>;
  defaultValue?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="min-h-10 w-full rounded-lg border border-input bg-white px-3 text-base outline-none focus:ring-4 focus:ring-ring/25"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function ToggleLine({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm">
      <input name={name} type="checkbox" value="yes" className="size-4" />
      {label}
    </label>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <Button type="submit" size="lg" className="mt-1 min-h-11">
      {children}
    </Button>
  );
}
