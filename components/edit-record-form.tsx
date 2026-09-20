import { updateRecordAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BP_POSTURES,
  CLOTHING_OPTIONS,
  type CareRecord,
  SEVERITY_OPTIONS,
  SYMPTOM_OPTIONS,
  TEMPERATURE_SITES,
} from "@/lib/care-records";
import type { ReactNode } from "react";

export function EditRecordForm({ record }: { record: CareRecord }) {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-sm">
      <p className="text-sm font-semibold text-muted-foreground">
        原記錄人：{record.type === "medication" ? record.confirmedBy : record.recordedBy}
      </p>
      <form action={updateRecordAction} className="mt-4 grid gap-3">
        <input type="hidden" name="recordId" value={record.id} />
        {renderFields(record)}
        <div className="grid grid-cols-2 gap-2">
          <a
            href="/history"
            className="flex min-h-12 items-center justify-center rounded-2xl border bg-white px-4 text-sm font-bold"
          >
            取消
          </a>
          <Button type="submit" className="min-h-12 rounded-2xl">
            儲存修改
          </Button>
        </div>
      </form>
    </section>
  );
}

function renderFields(record: CareRecord) {
  switch (record.type) {
    case "temperature":
      return (
        <>
          <DateTimeField value={record.datetime} />
          <Field label="體溫（°C）" htmlFor="value">
            <Input id="value" name="value" type="number" step="0.1" defaultValue={record.value} required />
          </Field>
          <Field label="部位" htmlFor="site">
            <NativeSelect id="site" name="site" options={TEMPERATURE_SITES} defaultValue={record.site} />
          </Field>
          <Notes value={record.notes} />
        </>
      );
    case "bloodPressure":
      return (
        <>
          <DateTimeField value={record.datetime} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="收縮壓" htmlFor="systolic">
              <Input id="systolic" name="systolic" type="number" defaultValue={record.systolic} required />
            </Field>
            <Field label="舒張壓" htmlFor="diastolic">
              <Input id="diastolic" name="diastolic" type="number" defaultValue={record.diastolic} required />
            </Field>
            <Field label="脈搏（選填）" htmlFor="pulse">
              <Input id="pulse" name="pulse" type="number" defaultValue={record.pulse ?? ""} />
            </Field>
          </div>
          <Field label="姿勢" htmlFor="posture">
            <NativeSelect id="posture" name="posture" options={BP_POSTURES} defaultValue={record.posture} />
          </Field>
          <Notes value={record.notes} />
        </>
      );
    case "medication":
      return (
        <>
          <DateTimeField value={record.datetime} />
          <Field label="藥名/類別" htmlFor="drugName">
            <Input id="drugName" name="drugName" defaultValue={record.drugName} required />
          </Field>
          <Field label="是否已吃" htmlFor="taken">
            <NativeSelect
              id="taken"
              name="taken"
              options={["yes", "no"]}
              labels={{ yes: "是，已吃", no: "否，未吃/吐掉" }}
              defaultValue={record.taken ? "yes" : "no"}
            />
          </Field>
          <Notes value={record.notes} />
        </>
      );
    case "symptoms":
      return (
        <>
          <DateTimeField value={record.datetime} />
          <Field label="紀錄方式" htmlFor="cleanDay">
            <NativeSelect
              id="cleanDay"
              name="cleanDay"
              options={["yes", "no"]}
              labels={{ yes: "今日無異狀", no: "有症狀" }}
              defaultValue={record.cleanDay ? "yes" : "no"}
            />
          </Field>
          <div className="grid gap-2">
            <Label>症狀勾選</Label>
            <div className="grid grid-cols-2 gap-2">
              {SYMPTOM_OPTIONS.map((symptom) => (
                <label key={symptom} className="flex min-h-12 items-center gap-2 rounded-xl border bg-white px-3 text-sm">
                  <input
                    name="symptoms"
                    type="checkbox"
                    value={symptom}
                    defaultChecked={record.symptoms.includes(symptom)}
                    className="size-4"
                  />
                  {symptom}
                </label>
              ))}
            </div>
          </div>
          <Field label="嚴重程度" htmlFor="severity">
            <NativeSelect id="severity" name="severity" options={SEVERITY_OPTIONS} defaultValue={record.severity} />
          </Field>
          <Toggle name="clinicianNotified" label="已通知醫護/診所" checked={record.clinicianNotified} />
          <Toggle name="soughtCare" label="已就醫或尋求緊急協助" checked={record.soughtCare} />
          <Notes value={record.notes} />
        </>
      );
    case "weight":
      return (
        <>
          <DateTimeField value={record.datetime} />
          <Field label="體重（kg）" htmlFor="value">
            <Input id="value" name="value" type="number" step="0.1" defaultValue={record.value} required />
          </Field>
          <Field label="衣著" htmlFor="clothing">
            <NativeSelect id="clothing" name="clothing" options={CLOTHING_OPTIONS} defaultValue={record.clothing} />
          </Field>
          <Notes value={record.notes} />
        </>
      );
  }
}

function DateTimeField({ value }: { value: string }) {
  return (
    <Field label="時間" htmlFor="datetime">
      <Input id="datetime" name="datetime" type="datetime-local" defaultValue={value} required />
    </Field>
  );
}

function Notes({ value }: { value: string }) {
  return (
    <Field label="備註" htmlFor="notes">
      <Textarea id="notes" name="notes" defaultValue={value} />
    </Field>
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
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
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
      className="min-h-12 w-full rounded-xl border border-input bg-white px-3 text-base outline-none focus:ring-4 focus:ring-ring/25"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex min-h-12 items-center gap-2 rounded-xl border bg-white px-3 text-sm">
      <input name={name} type="checkbox" value="yes" defaultChecked={checked} className="size-4" />
      {label}
    </label>
  );
}
