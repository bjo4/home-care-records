"use client";

import { useEffect, useState } from "react";

import { CAREGIVERS } from "@/lib/care-records";

const STORAGE_KEY = "carelog-caregiver";

type Props = {
  initialCaregiver: string;
};

export function CaregiverPicker({ initialCaregiver }: Props) {
  const [caregiver, setCaregiver] = useState(initialCaregiver || CAREGIVERS[0]);

  useEffect(() => {
    syncCaregiver(caregiver);
  }, [caregiver]);

  function updateCaregiver(nextCaregiver: string) {
    setCaregiver(nextCaregiver);
    window.localStorage.setItem(STORAGE_KEY, nextCaregiver);
    syncCaregiver(nextCaregiver);
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
      <label className="text-sm font-semibold" htmlFor="caregiver-picker">
        現在記錄人
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          id="caregiver-picker"
          value={caregiver}
          onChange={(event) => updateCaregiver(event.target.value)}
          className="min-h-12 rounded-xl border border-emerald-200 bg-white px-3 text-base font-medium outline-none focus:ring-4 focus:ring-emerald-200"
        >
          {CAREGIVERS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          aria-label="自訂記錄人"
          placeholder="或輸入其他照顧者"
          value={isPresetCaregiver(caregiver) ? "" : caregiver}
          onChange={(event) => updateCaregiver(event.target.value || CAREGIVERS[0])}
          className="min-h-12 rounded-xl border border-emerald-200 bg-white px-3 text-base outline-none focus:ring-4 focus:ring-emerald-200"
        />
      </div>
      <p className="mt-2 text-xs text-emerald-800">
        會儲存在這台裝置，下次開啟自動帶入；所有新增表單都會附上這個姓名。
      </p>
    </div>
  );
}

function syncCaregiver(caregiver: string) {
  document.cookie = `carelog-caregiver=${encodeURIComponent(caregiver)}; path=/; max-age=31536000; SameSite=Lax`;
  document
    .querySelectorAll<HTMLInputElement>("[data-caregiver-input]")
    .forEach((input) => {
      input.value = caregiver;
    });
}

function isPresetCaregiver(caregiver: string) {
  return CAREGIVERS.some((name) => name === caregiver);
}
