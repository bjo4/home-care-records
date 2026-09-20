"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createRecord,
  type BloodPressurePosture,
  type Clothing,
  type Severity,
  type Symptom,
  type TemperatureSite,
} from "@/lib/care-records";
import { changePassword } from "@/lib/auth";
import {
  addCareRecord,
  clearCareRecords,
  seedDemoCareLog,
} from "@/lib/care-store";
import { clearSessionCookie, requireCurrentUser } from "@/lib/session";

export async function addTemperatureAction(formData: FormData) {
  const user = await requireCurrentUser();

  await addCareRecord(
    createRecord("temperature", {
      datetime: requiredString(formData, "datetime"),
      value: requiredNumber(formData, "value"),
      site: requiredString(formData, "site") as TemperatureSite,
      recordedBy: user.displayName,
      notes: optionalString(formData, "notes"),
    }),
  );
  revalidateCareViews();
  redirect("/");
}

export async function addBloodPressureAction(formData: FormData) {
  const user = await requireCurrentUser();

  await addCareRecord(
    createRecord("bloodPressure", {
      datetime: requiredString(formData, "datetime"),
      systolic: requiredInteger(formData, "systolic"),
      diastolic: requiredInteger(formData, "diastolic"),
      pulse: requiredInteger(formData, "pulse"),
      posture: requiredString(formData, "posture") as BloodPressurePosture,
      recordedBy: user.displayName,
      notes: optionalString(formData, "notes"),
    }),
  );
  revalidateCareViews();
  redirect("/");
}

export async function addMedicationAction(formData: FormData) {
  const user = await requireCurrentUser();

  await addCareRecord(
    createRecord("medication", {
      drugName: requiredString(formData, "drugName"),
      taken: formData.get("taken") === "yes",
      datetime: requiredString(formData, "datetime"),
      confirmedBy: user.displayName,
      notes: optionalString(formData, "notes"),
    }),
  );
  revalidateCareViews();
  redirect("/");
}

export async function addSymptomsAction(formData: FormData) {
  const user = await requireCurrentUser();
  const cleanDay = formData.get("cleanDay") === "yes";

  await addCareRecord(
    createRecord("symptoms", {
      datetime: requiredString(formData, "datetime"),
      recordedBy: user.displayName,
      cleanDay,
      symptoms: cleanDay
        ? []
        : (formData.getAll("symptoms").map(String) as Symptom[]),
      severity: (formData.get("severity")?.toString() || "無") as Severity,
      clinicianNotified: formData.get("clinicianNotified") === "yes",
      soughtCare: formData.get("soughtCare") === "yes",
      notes: optionalString(formData, "notes"),
    }),
  );
  revalidateCareViews();
  redirect("/");
}

export async function addWeightAction(formData: FormData) {
  const user = await requireCurrentUser();

  await addCareRecord(
    createRecord("weight", {
      datetime: requiredString(formData, "datetime"),
      value: requiredNumber(formData, "value"),
      clothing: requiredString(formData, "clothing") as Clothing,
      recordedBy: user.displayName,
      notes: optionalString(formData, "notes"),
    }),
  );
  revalidateCareViews();
  redirect("/");
}

export async function seedDemoDataAction() {
  await requireCurrentUser();
  await seedDemoCareLog();
  revalidateCareViews();
}

export async function clearDataAction() {
  await requireCurrentUser();
  await clearCareRecords();
  revalidateCareViews();
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireCurrentUser();
  const currentPassword = requiredString(formData, "currentPassword");
  const nextPassword = requiredString(formData, "nextPassword");
  const confirmPassword = requiredString(formData, "confirmPassword");

  if (nextPassword !== confirmPassword) {
    redirect("/account?password=confirm-mismatch");
  }

  const result = await changePassword(user.id, currentPassword, nextPassword);

  if (!result.ok) {
    redirect(`/account?password=${result.reason}`);
  }

  redirect("/account?password=changed");
}

function revalidateCareViews() {
  revalidatePath("/");
  revalidatePath("/add");
  revalidatePath("/history");
  revalidatePath("/account");
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function optionalString(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}

function requiredNumber(formData: FormData, key: string) {
  const value = Number(requiredString(formData, key));

  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }

  return value;
}

function requiredInteger(formData: FormData, key: string) {
  const value = requiredNumber(formData, key);

  if (!Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }

  return value;
}
