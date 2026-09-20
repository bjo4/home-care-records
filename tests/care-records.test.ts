import assert from "node:assert/strict";
import test from "node:test";

import {
  ABNORMAL_THRESHOLDS,
  buildDemoData,
  createRecord,
  getTodayEntries,
  isAbnormalBloodPressure,
  isAbnormalTemperature,
  isAbnormalWeightChange,
  MEDICATION_PRESETS,
  type CareLogData,
} from "../lib/care-records";

test("temperature records always keep caregiver, notes, site, and abnormal flag", () => {
  const record = createRecord("temperature", {
    datetime: "2026-09-20T07:30",
    value: 37.8,
    site: "耳",
    recordedBy: "Warren",
    notes: "微燒",
  });

  assert.equal(record.type, "temperature");
  assert.equal(record.recordedBy, "Warren");
  assert.equal(record.site, "耳");
  assert.equal(record.notes, "微燒");
  assert.equal(record.abnormal, true);
  assert.equal(isAbnormalTemperature(37.4), false);
  assert.equal(isAbnormalTemperature(ABNORMAL_THRESHOLDS.temperature.feverC), true);
});

test("blood pressure records mark common high and low ranges as abnormal", () => {
  const high = createRecord("bloodPressure", {
    datetime: "2026-09-20T08:00",
    systolic: 141,
    diastolic: 92,
    pulse: 86,
    posture: "坐",
    recordedBy: "姐姐",
    notes: "",
  });

  const low = createRecord("bloodPressure", {
    datetime: "2026-09-20T08:10",
    systolic: 89,
    diastolic: 58,
    pulse: 72,
    posture: "躺",
    recordedBy: "爸爸",
    notes: "剛起床",
  });

  assert.equal(high.abnormal, true);
  assert.equal(low.abnormal, true);
  assert.equal(isAbnormalBloodPressure(118, 76), false);
});

test("blood pressure pulse is optional", () => {
  const record = createRecord("bloodPressure", {
    datetime: "2026-09-20T08:20",
    systolic: 118,
    diastolic: 76,
    posture: "坐",
    recordedBy: "Warren",
    notes: "未量脈搏",
  });

  assert.equal(record.type, "bloodPressure");
  assert.equal(record.pulse, undefined);
  assert.equal(record.abnormal, false);
});

test("blood glucose records keep meal timing and flag attention ranges", () => {
  const high = createRecord("bloodGlucose", {
    datetime: "2026-09-20T08:45",
    value: 186,
    mealTiming: "飯後",
    recordedBy: "Warren",
    notes: "早餐後",
  });

  const normal = createRecord("bloodGlucose", {
    datetime: "2026-09-20T12:00",
    value: 98,
    mealTiming: "飯前",
    recordedBy: "姐姐",
    notes: "",
  });

  assert.equal(high.type, "bloodGlucose");
  assert.equal(high.abnormal, true);
  assert.equal(normal.abnormal, false);
  assert.equal(normal.mealTiming, "飯前");
});

test("medication presets include editable morning medicines and steroid note", () => {
  assert.deepEqual(
    MEDICATION_PRESETS.map((preset) => preset.name),
    ["甲狀腺×2", "心律整錠", "類固醇（口服，依醫囑）"],
  );

  const record = createRecord("medication", {
    drugName: "甲狀腺×2",
    taken: true,
    datetime: "2026-09-20T07:15",
    confirmedBy: "María",
    notes: "",
  });

  assert.equal(record.confirmedBy, "María");
  assert.equal(record.taken, true);
});

test("symptom clean-day shortcut records no abnormalities without requiring checklist expansion", () => {
  const record = createRecord("symptoms", {
    datetime: "2026-09-20T20:30",
    recordedBy: "Warren",
    cleanDay: true,
    symptoms: [],
    severity: "無",
    clinicianNotified: false,
    soughtCare: false,
    notes: "今日無異狀",
  });

  assert.equal(record.cleanDay, true);
  assert.deepEqual(record.symptoms, []);
  assert.equal(record.abnormal, false);
});

test("weight change helper highlights larger day-to-day shifts", () => {
  const record = createRecord("weight", {
    datetime: "2026-09-20T06:50",
    value: 61.8,
    clothing: "輕",
    recordedBy: "爸爸",
    notes: "",
  });

  assert.equal(record.type, "weight");
  assert.equal(isAbnormalWeightChange(61.8, 60.5), true);
  assert.equal(isAbnormalWeightChange(61.0, 60.5), false);
});

test("today entries are grouped in reverse chronological order across all record types", () => {
  const data: CareLogData = {
    records: [
      createRecord("temperature", {
        datetime: "2026-09-19T20:00",
        value: 36.7,
        site: "額",
        recordedBy: "Warren",
        notes: "",
      }),
      createRecord("weight", {
        datetime: "2026-09-20T06:50",
        value: 60.8,
        clothing: "輕",
        recordedBy: "爸爸",
        notes: "",
      }),
      createRecord("symptoms", {
        datetime: "2026-09-20T20:30",
        recordedBy: "María",
        cleanDay: true,
        symptoms: [],
        severity: "無",
        clinicianNotified: false,
        soughtCare: false,
        notes: "",
      }),
    ],
    users: [],
    sessions: [],
    loginAttempts: [],
  };

  assert.deepEqual(
    getTodayEntries(data, new Date("2026-09-20T12:00:00+08:00")).map(
      (entry) => entry.type,
    ),
    ["symptoms", "weight"],
  );
});

test("demo data contains every MVP record type", () => {
  const types = new Set(buildDemoData().records.map((record) => record.type));

  assert.deepEqual([...types].sort(), [
    "bloodGlucose",
    "bloodPressure",
    "medication",
    "symptoms",
    "temperature",
    "weight",
  ]);
});
