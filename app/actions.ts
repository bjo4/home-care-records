"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type CareRecord,
  createRecord,
  type BloodPressurePosture,
  type Clothing,
  type GlucoseMealTiming,
  type Severity,
  type Symptom,
  type TemperatureSite,
} from "@/lib/care-records";
import { changePassword, createApiToken, revokeApiToken } from "@/lib/auth";
import {
  addExam,
  addCareRecord,
  addMedicationOrder,
  addReminder,
  addVisit,
  clearCareRecords,
  deleteCareRecord,
  deleteExam,
  deleteMedicationOrder,
  deleteReminder,
  deleteVisit,
  getCareLog,
  seedDemoCareLog,
  updateExam,
  updateMedicationOrder,
  updateCareRecord,
  updateReminder,
  updateVisit,
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
      pulse: optionalInteger(formData, "pulse"),
      posture: requiredString(formData, "posture") as BloodPressurePosture,
      recordedBy: user.displayName,
      notes: optionalString(formData, "notes"),
    }),
  );
  revalidateCareViews();
  redirect("/");
}

export async function addBloodGlucoseAction(formData: FormData) {
  const user = await requireCurrentUser();

  await addCareRecord(
    createRecord("bloodGlucose", {
      datetime: requiredString(formData, "datetime"),
      value: requiredNumber(formData, "value"),
      mealTiming: requiredString(formData, "mealTiming") as GlucoseMealTiming,
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

export async function deleteRecordAction(formData: FormData) {
  await requireCurrentUser();
  const recordId = requiredString(formData, "recordId");

  await deleteCareRecord(recordId);
  revalidateCareViews();
}

export async function updateRecordAction(formData: FormData) {
  const user = await requireCurrentUser();
  const recordId = requiredString(formData, "recordId");
  const data = await getCareLog();
  const original = data.records.find((record) => record.id === recordId);

  if (!original) {
    redirect("/history");
  }

  const editedAt = new Date().toISOString();
  const editedBy = user.displayName;
  const updated = buildEditedRecord(original, formData, editedBy, editedAt);

  await updateCareRecord(recordId, () => updated);
  revalidateCareViews();
  redirect("/history");
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

export async function createApiTokenAction(formData: FormData) {
  const user = await requireCurrentUser();
  const label = requiredString(formData, "label");
  const { token } = await createApiToken(user.id, label);

  revalidateCareViews();
  redirect(`/account?newToken=${encodeURIComponent(token)}`);
}

export async function revokeApiTokenAction(formData: FormData) {
  const user = await requireCurrentUser();
  const tokenId = requiredString(formData, "tokenId");
  await revokeApiToken(user.id, tokenId);

  revalidateCareViews();
}

export async function saveReminderAction(formData: FormData) {
  const user = await requireCurrentUser();
  const now = new Date().toISOString();
  const id = optionalString(formData, "id");
  const reminder = {
    id: id || createId(),
    type: requiredString(formData, "type") as never,
    dueAt: requiredString(formData, "dueAt"),
    recurrence: requiredString(formData, "recurrence") as never,
    linkedRecordId: optionalString(formData, "linkedRecordId") || undefined,
    notes: optionalString(formData, "notes"),
    completed: formData.get("completed") === "yes",
    completedAt: optionalString(formData, "completedAt") || undefined,
    completedBy: optionalString(formData, "completedBy") || undefined,
    recordedBy: optionalString(formData, "recordedBy") || user.displayName,
    createdAt: optionalString(formData, "createdAt") || now,
    lastEditedBy: id ? user.displayName : undefined,
    lastEditedAt: id ? now : undefined,
  };

  if (id) {
    await updateReminder(id, () => reminder);
  } else {
    await addReminder(reminder);
  }
  revalidateCareViews();
  redirect("/reminders");
}

export async function completeReminderAction(formData: FormData) {
  const user = await requireCurrentUser();
  const id = requiredString(formData, "id");
  const now = new Date().toISOString();
  await updateReminder(id, (reminder) => ({
    ...reminder,
    completed: true,
    completedAt: now,
    completedBy: user.displayName,
    lastEditedBy: user.displayName,
    lastEditedAt: now,
  }));
  revalidateCareViews();
}

export async function deleteReminderAction(formData: FormData) {
  await requireCurrentUser();
  await deleteReminder(requiredString(formData, "id"));
  revalidateCareViews();
}

export async function saveMedicationOrderAction(formData: FormData) {
  const user = await requireCurrentUser();
  const now = new Date().toISOString();
  const id = optionalString(formData, "id");
  const order = {
    id: id || createId(),
    drugName: requiredString(formData, "drugName"),
    dose: requiredString(formData, "dose"),
    frequency: requiredString(formData, "frequency"),
    route: requiredString(formData, "route") as never,
    scheduleHint: requiredString(formData, "scheduleHint"),
    startDate: requiredString(formData, "startDate"),
    stopDate: optionalString(formData, "stopDate") || undefined,
    notes: optionalString(formData, "notes"),
    precautions: optionalString(formData, "precautions"),
    status: requiredString(formData, "status") as never,
    recordedBy: optionalString(formData, "recordedBy") || user.displayName,
    createdAt: optionalString(formData, "createdAt") || now,
    lastEditedBy: id ? user.displayName : undefined,
    lastEditedAt: id ? now : undefined,
  };
  if (id) await updateMedicationOrder(id, () => order);
  else await addMedicationOrder(order);
  revalidateCareViews();
  redirect("/meds");
}

export async function stopMedicationOrderAction(formData: FormData) {
  const user = await requireCurrentUser();
  const id = requiredString(formData, "id");
  const now = new Date().toISOString();
  await updateMedicationOrder(id, (order) => ({
    ...order,
    status: "已停",
    stopDate: order.stopDate || now.slice(0, 10),
    lastEditedBy: user.displayName,
    lastEditedAt: now,
  }));
  revalidateCareViews();
}

export async function deleteMedicationOrderAction(formData: FormData) {
  await requireCurrentUser();
  await deleteMedicationOrder(requiredString(formData, "id"));
  revalidateCareViews();
}

export async function saveExamAction(formData: FormData) {
  const user = await requireCurrentUser();
  const now = new Date().toISOString();
  const id = optionalString(formData, "id");
  const exam = {
    id: id || createId(),
    name: requiredString(formData, "name"),
    datetime: requiredString(formData, "datetime"),
    location: optionalString(formData, "location"),
    resultSummary: optionalString(formData, "resultSummary"),
    nextDue: optionalString(formData, "nextDue") || undefined,
    status: requiredString(formData, "status") as never,
    recordedBy: optionalString(formData, "recordedBy") || user.displayName,
    createdAt: optionalString(formData, "createdAt") || now,
    lastEditedBy: id ? user.displayName : undefined,
    lastEditedAt: id ? now : undefined,
  };
  if (id) await updateExam(id, () => exam);
  else await addExam(exam);
  revalidateCareViews();
  redirect("/exams");
}

export async function deleteExamAction(formData: FormData) {
  await requireCurrentUser();
  await deleteExam(requiredString(formData, "id"));
  revalidateCareViews();
}

export async function saveVisitAction(formData: FormData) {
  const user = await requireCurrentUser();
  const now = new Date().toISOString();
  const id = optionalString(formData, "id");
  const visit = {
    id: id || createId(),
    department: requiredString(formData, "department"),
    date: requiredString(formData, "date"),
    doctor: optionalString(formData, "doctor") || undefined,
    instructions: requiredString(formData, "instructions"),
    followUpDate: optionalString(formData, "followUpDate") || undefined,
    recordedBy: optionalString(formData, "recordedBy") || user.displayName,
    createdAt: optionalString(formData, "createdAt") || now,
    lastEditedBy: id ? user.displayName : undefined,
    lastEditedAt: id ? now : undefined,
  };
  if (id) await updateVisit(id, () => visit);
  else await addVisit(visit);
  revalidateCareViews();
  redirect("/visits");
}

export async function deleteVisitAction(formData: FormData) {
  await requireCurrentUser();
  await deleteVisit(requiredString(formData, "id"));
  revalidateCareViews();
}

function revalidateCareViews() {
  revalidatePath("/");
  revalidatePath("/add");
  revalidatePath("/history");
  revalidatePath("/account");
  revalidatePath("/reminders");
  revalidatePath("/meds");
  revalidatePath("/exams");
  revalidatePath("/visits");
}

function buildEditedRecord(
  original: CareRecord,
  formData: FormData,
  lastEditedBy: string,
  lastEditedAt: string,
) {
  const common = {
    id: original.id,
    createdAt: original.createdAt,
    lastEditedBy,
    lastEditedAt,
  };

  switch (original.type) {
    case "temperature":
      return {
        ...createRecord("temperature", {
          datetime: requiredString(formData, "datetime"),
          value: requiredNumber(formData, "value"),
          site: requiredString(formData, "site") as TemperatureSite,
          recordedBy: original.recordedBy,
          notes: optionalString(formData, "notes"),
        }),
        ...common,
      };
    case "bloodPressure":
      return {
        ...createRecord("bloodPressure", {
          datetime: requiredString(formData, "datetime"),
          systolic: requiredInteger(formData, "systolic"),
          diastolic: requiredInteger(formData, "diastolic"),
          pulse: optionalInteger(formData, "pulse"),
          posture: requiredString(formData, "posture") as BloodPressurePosture,
          recordedBy: original.recordedBy,
          notes: optionalString(formData, "notes"),
        }),
        ...common,
      };
    case "bloodGlucose":
      return {
        ...createRecord("bloodGlucose", {
          datetime: requiredString(formData, "datetime"),
          value: requiredNumber(formData, "value"),
          mealTiming: requiredString(formData, "mealTiming") as GlucoseMealTiming,
          recordedBy: original.recordedBy,
          notes: optionalString(formData, "notes"),
        }),
        ...common,
      };
    case "medication":
      return {
        ...createRecord("medication", {
          drugName: requiredString(formData, "drugName"),
          taken: formData.get("taken") === "yes",
          datetime: requiredString(formData, "datetime"),
          confirmedBy: original.confirmedBy,
          notes: optionalString(formData, "notes"),
        }),
        ...common,
      };
    case "symptoms": {
      const cleanDay = formData.get("cleanDay") === "yes";
      return {
        ...createRecord("symptoms", {
          datetime: requiredString(formData, "datetime"),
          recordedBy: original.recordedBy,
          cleanDay,
          symptoms: cleanDay
            ? []
            : (formData.getAll("symptoms").map(String) as Symptom[]),
          severity: (formData.get("severity")?.toString() || "無") as Severity,
          clinicianNotified: formData.get("clinicianNotified") === "yes",
          soughtCare: formData.get("soughtCare") === "yes",
          notes: optionalString(formData, "notes"),
        }),
        ...common,
      };
    }
    case "weight":
      return {
        ...createRecord("weight", {
          datetime: requiredString(formData, "datetime"),
          value: requiredNumber(formData, "value"),
          clothing: requiredString(formData, "clothing") as Clothing,
          recordedBy: original.recordedBy,
          notes: optionalString(formData, "notes"),
        }),
        ...common,
      };
  }
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

function optionalInteger(formData: FormData, key: string) {
  const raw = formData.get(key)?.toString().trim();

  if (!raw) {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }

  return value;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
