export const CAREGIVERS = ["Warren", "姊姊", "爸爸", "María"] as const;

export const TEMPERATURE_SITES = ["額", "耳", "腋"] as const;
export const BP_POSTURES = ["坐", "躺"] as const;
export const CLOTHING_OPTIONS = ["輕", "重"] as const;
export const SYMPTOM_OPTIONS = [
  "嘔吐",
  "頭痛",
  "頭暈",
  "視力變化",
  "發燒",
  "喘/胸悶",
  "咳血",
  "其他",
] as const;
export const SEVERITY_OPTIONS = ["無", "輕微", "中等", "嚴重"] as const;

export const MEDICATION_PRESETS = [
  { id: "thyroid-2", name: "甲狀腺×2", category: "早晨常用藥" },
  { id: "rhythm", name: "心律整錠", category: "早晨常用藥" },
  { id: "steroid-oral", name: "類固醇（口服，依醫囑）", category: "選填提醒" },
] as const;

export const ABNORMAL_THRESHOLDS = {
  temperature: {
    feverC: 37.5,
  },
  bloodPressure: {
    highSystolic: 140,
    highDiastolic: 90,
    lowSystolic: 90,
    lowDiastolic: 60,
  },
  pulse: {
    low: 50,
    high: 110,
  },
  weight: {
    dailyChangeKg: 1,
  },
} as const;

export type Caregiver = (typeof CAREGIVERS)[number] | string;
export type TemperatureSite = (typeof TEMPERATURE_SITES)[number];
export type BloodPressurePosture = (typeof BP_POSTURES)[number];
export type Clothing = (typeof CLOTHING_OPTIONS)[number];
export type Symptom = (typeof SYMPTOM_OPTIONS)[number];
export type Severity = (typeof SEVERITY_OPTIONS)[number];
export type RecordType =
  | "temperature"
  | "bloodPressure"
  | "medication"
  | "symptoms"
  | "weight";

type BaseRecord = {
  id: string;
  type: RecordType;
  datetime: string;
  notes: string;
  abnormal: boolean;
  createdAt: string;
};

export type TemperatureRecord = BaseRecord & {
  type: "temperature";
  value: number;
  site: TemperatureSite;
  recordedBy: Caregiver;
};

export type BloodPressureRecord = BaseRecord & {
  type: "bloodPressure";
  systolic: number;
  diastolic: number;
  pulse?: number;
  posture: BloodPressurePosture;
  recordedBy: Caregiver;
};

export type MedicationRecord = BaseRecord & {
  type: "medication";
  drugName: string;
  taken: boolean;
  confirmedBy: Caregiver;
};

export type SymptomsRecord = BaseRecord & {
  type: "symptoms";
  cleanDay: boolean;
  symptoms: Symptom[];
  severity: Severity;
  clinicianNotified: boolean;
  soughtCare: boolean;
  recordedBy: Caregiver;
};

export type WeightRecord = BaseRecord & {
  type: "weight";
  value: number;
  clothing: Clothing;
  recordedBy: Caregiver;
};

export type CareRecord =
  | TemperatureRecord
  | BloodPressureRecord
  | MedicationRecord
  | SymptomsRecord
  | WeightRecord;

export type UserAccount = {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

export type LoginAttempt = {
  username: string;
  failedAt: string;
};

export type CareLogData = {
  records: CareRecord[];
  users: UserAccount[];
  sessions: AuthSession[];
  loginAttempts: LoginAttempt[];
};

type RecordInputMap = {
  temperature: Omit<TemperatureRecord, keyof BaseRecord | "abnormal"> & {
    datetime: string;
    notes?: string;
  };
  bloodPressure: Omit<BloodPressureRecord, keyof BaseRecord | "abnormal"> & {
    datetime: string;
    notes?: string;
  };
  medication: Omit<MedicationRecord, keyof BaseRecord | "abnormal"> & {
    datetime: string;
    notes?: string;
  };
  symptoms: Omit<SymptomsRecord, keyof BaseRecord | "abnormal"> & {
    datetime: string;
    notes?: string;
  };
  weight: Omit<WeightRecord, keyof BaseRecord | "abnormal"> & {
    datetime: string;
    notes?: string;
  };
};

export function isAbnormalTemperature(value: number) {
  return value >= ABNORMAL_THRESHOLDS.temperature.feverC;
}

export function isAbnormalBloodPressure(systolic: number, diastolic: number) {
  const threshold = ABNORMAL_THRESHOLDS.bloodPressure;

  return (
    systolic >= threshold.highSystolic ||
    diastolic >= threshold.highDiastolic ||
    systolic < threshold.lowSystolic ||
    diastolic < threshold.lowDiastolic
  );
}

export function isAbnormalPulse(pulse?: number) {
  if (pulse === undefined) {
    return false;
  }

  return (
    pulse < ABNORMAL_THRESHOLDS.pulse.low ||
    pulse > ABNORMAL_THRESHOLDS.pulse.high
  );
}

export function isAbnormalWeightChange(value: number, previousValue?: number) {
  if (previousValue === undefined) {
    return false;
  }

  return Math.abs(value - previousValue) >= ABNORMAL_THRESHOLDS.weight.dailyChangeKg;
}

export function createRecord<T extends RecordType>(
  type: T,
  input: RecordInputMap[T],
): Extract<CareRecord, { type: T }> {
  const base = {
    id: createId(),
    type,
    datetime: input.datetime,
    notes: input.notes?.trim() ?? "",
    createdAt: new Date().toISOString(),
  };

  switch (type) {
    case "temperature": {
      const payload = input as RecordInputMap["temperature"];
      return {
        ...base,
        type,
        value: payload.value,
        site: payload.site,
        recordedBy: payload.recordedBy,
        abnormal: isAbnormalTemperature(payload.value),
      } as Extract<CareRecord, { type: T }>;
    }
    case "bloodPressure": {
      const payload = input as RecordInputMap["bloodPressure"];
      return {
        ...base,
        type,
        systolic: payload.systolic,
        diastolic: payload.diastolic,
        pulse: payload.pulse,
        posture: payload.posture,
        recordedBy: payload.recordedBy,
        abnormal:
          isAbnormalBloodPressure(payload.systolic, payload.diastolic) ||
          isAbnormalPulse(payload.pulse),
      } as Extract<CareRecord, { type: T }>;
    }
    case "medication": {
      const payload = input as RecordInputMap["medication"];
      return {
        ...base,
        type,
        drugName: payload.drugName.trim(),
        taken: payload.taken,
        confirmedBy: payload.confirmedBy,
        abnormal: !payload.taken,
      } as Extract<CareRecord, { type: T }>;
    }
    case "symptoms": {
      const payload = input as RecordInputMap["symptoms"];
      const symptoms = payload.cleanDay ? [] : payload.symptoms;
      return {
        ...base,
        type,
        cleanDay: payload.cleanDay,
        symptoms,
        severity: payload.cleanDay ? "無" : payload.severity,
        clinicianNotified: payload.clinicianNotified,
        soughtCare: payload.soughtCare,
        recordedBy: payload.recordedBy,
        abnormal:
          !payload.cleanDay &&
          (symptoms.length > 0 ||
            payload.severity !== "無" ||
            payload.clinicianNotified ||
            payload.soughtCare),
      } as Extract<CareRecord, { type: T }>;
    }
    case "weight": {
      const payload = input as RecordInputMap["weight"];
      return {
        ...base,
        type,
        value: payload.value,
        clothing: payload.clothing,
        recordedBy: payload.recordedBy,
        abnormal: false,
      } as Extract<CareRecord, { type: T }>;
    }
    default:
      throw new Error(`Unsupported record type: ${type satisfies never}`);
  }
}

export function getTodayEntries(data: CareLogData, today = new Date()) {
  const key = toDateKey(today);

  return [...data.records]
    .filter((record) => toDateKey(new Date(record.datetime)) === key)
    .sort((a, b) => b.datetime.localeCompare(a.datetime));
}

export function buildDemoData(): CareLogData {
  const today = "2026-09-20";

  return {
    records: [
      createRecord("medication", {
        drugName: "甲狀腺×2",
        taken: true,
        datetime: `${today}T07:10`,
        confirmedBy: "Warren",
        notes: "早餐前確認",
      }),
      createRecord("medication", {
        drugName: "心律整錠",
        taken: true,
        datetime: `${today}T07:15`,
        confirmedBy: "Warren",
        notes: "",
      }),
      createRecord("temperature", {
        datetime: `${today}T07:30`,
        value: 36.8,
        site: "耳",
        recordedBy: "Warren",
        notes: "",
      }),
      createRecord("bloodPressure", {
        datetime: `${today}T07:35`,
        systolic: 124,
        diastolic: 78,
        pulse: 82,
        posture: "坐",
        recordedBy: "爸爸",
        notes: "起床後 10 分鐘",
      }),
      createRecord("weight", {
        datetime: `${today}T07:40`,
        value: 60.8,
        clothing: "輕",
        recordedBy: "爸爸",
        notes: "",
      }),
      createRecord("symptoms", {
        datetime: `${today}T20:30`,
        recordedBy: "María",
        cleanDay: true,
        symptoms: [],
        severity: "無",
        clinicianNotified: false,
        soughtCare: false,
        notes: "今日無異狀",
      }),
    ],
    users: [],
    sessions: [],
    loginAttempts: [],
  };
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
