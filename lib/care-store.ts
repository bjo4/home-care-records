import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildDemoData,
  type CareLogData,
  type CareRecord,
  isAbnormalWeightChange,
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
    users: [],
    sessions: [],
    loginAttempts: [],
  };
}

export function normalizeCareLogData(data: Partial<CareLogData>): CareLogData {
  return {
    records: Array.isArray(data.records) ? data.records : [],
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
