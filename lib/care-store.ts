import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildDemoData,
  type CareLogData,
  type CareRecord,
  type CareReminder,
  type ExamRecord,
  isAbnormalWeightChange,
  type MedicationOrder,
  type VisitRecord,
} from "./care-records";

export const DEFAULT_DATA_FILE = path.join(
  process.cwd(),
  ".data",
  "carelog.json",
);

function dataFilePath(filePath?: string) {
  return filePath ?? process.env.CARELOG_DATA_FILE ?? DEFAULT_DATA_FILE;
}

export async function getCareLog(filePath?: string): Promise<CareLogData> {
  filePath = dataFilePath(filePath);

  try {
    const raw = await readFile(/*turbopackIgnore: true*/ filePath, "utf8");
    const parsed = JSON.parse(raw) as CareLogData;

    return normalizeCareLogData(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyCareLogData();
    }

    throw error;
  }
}

export async function saveCareLog(
  data: CareLogData,
  filePath?: string,
) {
  filePath = dataFilePath(filePath);
  await mkdir(path.dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(
    /*turbopackIgnore: true*/ tempPath,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
  await rename(
    /*turbopackIgnore: true*/ tempPath,
    /*turbopackIgnore: true*/ filePath,
  );
}

export async function addCareRecord(
  record: CareRecord,
  filePath?: string,
) {
  filePath = dataFilePath(filePath);
  const data = await getCareLog(filePath);
  const nextRecord = record.type === "weight" ? withWeightFlag(record, data) : record;
  const next = { ...data, records: [...data.records, nextRecord] };

  await saveCareLog(next, filePath);

  return nextRecord;
}

export async function updateCareRecord(
  recordId: string,
  update: (record: CareRecord) => CareRecord,
  filePath?: string,
) {
  filePath = dataFilePath(filePath);
  const data = await getCareLog(filePath);
  let updatedRecord: CareRecord | undefined;
  const nextRecords = data.records.map((record) => {
    if (record.id !== recordId) {
      return record;
    }

    updatedRecord = update(record);
    return updatedRecord;
  });

  if (!updatedRecord) {
    return null;
  }

  await saveCareLog({ ...data, records: nextRecords }, filePath);
  return updatedRecord;
}

export async function deleteCareRecord(recordId: string, filePath?: string) {
  filePath = dataFilePath(filePath);
  const data = await getCareLog(filePath);
  const deleted = data.records.find((record) => record.id === recordId);

  if (!deleted) {
    return null;
  }

  await saveCareLog(
    {
      ...data,
      records: data.records.filter((record) => record.id !== recordId),
    },
    filePath,
  );

  return deleted;
}

export async function addReminder(reminder: CareReminder, filePath?: string) {
  const data = await getCareLog(filePath);
  const next = { ...data, reminders: [...data.reminders, reminder] };
  await saveCareLog(next, filePath);
  return reminder;
}

export async function updateReminder(
  reminderId: string,
  update: (reminder: CareReminder) => CareReminder,
  filePath?: string,
) {
  const data = await getCareLog(filePath);
  const current = data.reminders.find((reminder) => reminder.id === reminderId);

  if (!current) return null;

  const updated = update(current);
  await saveCareLog(
    {
      ...data,
      reminders: data.reminders.map((reminder) =>
        reminder.id === reminderId ? updated : reminder,
      ),
    },
    filePath,
  );
  return updated;
}

export async function deleteReminder(reminderId: string, filePath?: string) {
  const data = await getCareLog(filePath);
  const deleted = data.reminders.find((reminder) => reminder.id === reminderId);

  if (!deleted) return null;

  await saveCareLog(
    {
      ...data,
      reminders: data.reminders.filter((reminder) => reminder.id !== reminderId),
    },
    filePath,
  );
  return deleted;
}

export function getDueReminders(
  data: CareLogData,
  now = new Date(),
  hoursAhead = 48,
) {
  const end = now.getTime() + hoursAhead * 60 * 60 * 1000;

  return data.reminders
    .filter((reminder) => {
      const due = new Date(reminder.dueAt).getTime();
      return !reminder.completed && due >= now.getTime() && due <= end;
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export async function addMedicationOrder(order: MedicationOrder, filePath?: string) {
  const data = await getCareLog(filePath);
  await saveCareLog({ ...data, medicationOrders: [...data.medicationOrders, order] }, filePath);
  return order;
}

export async function updateMedicationOrder(
  orderId: string,
  update: (order: MedicationOrder) => MedicationOrder,
  filePath?: string,
) {
  const data = await getCareLog(filePath);
  const current = data.medicationOrders.find((order) => order.id === orderId);
  if (!current) return null;
  const updated = update(current);
  await saveCareLog(
    {
      ...data,
      medicationOrders: data.medicationOrders.map((order) =>
        order.id === orderId ? updated : order,
      ),
    },
    filePath,
  );
  return updated;
}

export async function deleteMedicationOrder(orderId: string, filePath?: string) {
  const data = await getCareLog(filePath);
  const deleted = data.medicationOrders.find((order) => order.id === orderId);
  if (!deleted) return null;
  await saveCareLog(
    {
      ...data,
      medicationOrders: data.medicationOrders.filter((order) => order.id !== orderId),
    },
    filePath,
  );
  return deleted;
}

export async function addExam(exam: ExamRecord, filePath?: string) {
  const data = await getCareLog(filePath);
  await saveCareLog({ ...data, exams: [...data.exams, exam] }, filePath);
  return exam;
}

export async function updateExam(
  examId: string,
  update: (exam: ExamRecord) => ExamRecord,
  filePath?: string,
) {
  const data = await getCareLog(filePath);
  const current = data.exams.find((exam) => exam.id === examId);
  if (!current) return null;
  const updated = update(current);
  await saveCareLog(
    {
      ...data,
      exams: data.exams.map((exam) => (exam.id === examId ? updated : exam)),
    },
    filePath,
  );
  return updated;
}

export async function deleteExam(examId: string, filePath?: string) {
  const data = await getCareLog(filePath);
  const deleted = data.exams.find((exam) => exam.id === examId);
  if (!deleted) return null;
  await saveCareLog(
    { ...data, exams: data.exams.filter((exam) => exam.id !== examId) },
    filePath,
  );
  return deleted;
}

export async function addVisit(visit: VisitRecord, filePath?: string) {
  const data = await getCareLog(filePath);
  await saveCareLog({ ...data, visits: [...data.visits, visit] }, filePath);
  return visit;
}

export async function updateVisit(
  visitId: string,
  update: (visit: VisitRecord) => VisitRecord,
  filePath?: string,
) {
  const data = await getCareLog(filePath);
  const current = data.visits.find((visit) => visit.id === visitId);
  if (!current) return null;
  const updated = update(current);
  await saveCareLog(
    {
      ...data,
      visits: data.visits.map((visit) =>
        visit.id === visitId ? updated : visit,
      ),
    },
    filePath,
  );
  return updated;
}

export async function deleteVisit(visitId: string, filePath?: string) {
  const data = await getCareLog(filePath);
  const deleted = data.visits.find((visit) => visit.id === visitId);
  if (!deleted) return null;
  await saveCareLog(
    { ...data, visits: data.visits.filter((visit) => visit.id !== visitId) },
    filePath,
  );
  return deleted;
}

export async function clearCareLog(filePath?: string) {
  filePath = dataFilePath(filePath);
  const empty = emptyCareLogData();
  await saveCareLog(empty, filePath);
  return empty;
}

export async function clearCareRecords(filePath?: string) {
  filePath = dataFilePath(filePath);
  const data = await getCareLog(filePath);
  const next = { ...data, records: [] };

  await saveCareLog(next, filePath);
  return next;
}

export async function seedDemoCareLog(filePath?: string) {
  filePath = dataFilePath(filePath);
  const existing = await getCareLog(filePath);

  if (existing.records.length > 0) {
    return existing;
  }

  const demo = buildDemoData();
  const next = { ...existing, records: demo.records };

  await saveCareLog(next, filePath);
  return next;
}

function withWeightFlag(
  record: Extract<CareRecord, { type: "weight" }>,
  data: CareLogData,
) {
  const previous = [...data.records]
    .reverse()
    .find((candidate) => candidate.type === "weight");

  return {
    ...record,
    abnormal:
      previous?.type === "weight"
        ? isAbnormalWeightChange(record.value, previous.value)
        : false,
  };
}

export function emptyCareLogData(): CareLogData {
  return {
    records: [],
    reminders: [],
    medicationOrders: [],
    exams: [],
    visits: [],
    users: [],
    sessions: [],
    loginAttempts: [],
  };
}

export function normalizeCareLogData(data: Partial<CareLogData>): CareLogData {
  return {
    records: Array.isArray(data.records) ? data.records : [],
    reminders: Array.isArray(data.reminders) ? data.reminders : [],
    medicationOrders: Array.isArray(data.medicationOrders)
      ? data.medicationOrders
      : [],
    exams: Array.isArray(data.exams) ? data.exams : [],
    visits: Array.isArray(data.visits) ? data.visits : [],
    users: Array.isArray(data.users) ? data.users.map(migrateUser) : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    loginAttempts: Array.isArray(data.loginAttempts) ? data.loginAttempts : [],
  };
}

function migrateUser(user: CareLogData["users"][number]) {
  if (user.username === "sister") {
    return { ...user, username: "vickie" };
  }

  if (user.username === "dad") {
    return { ...user, username: "fanlee" };
  }

  return user;
}
