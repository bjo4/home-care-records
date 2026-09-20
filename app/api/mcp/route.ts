import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";

import { verifyApiToken } from "@/lib/auth";
import {
  createRecord,
  type BloodPressurePosture,
  type Clothing,
  type GlucoseMealTiming,
  type Severity,
  type Symptom,
  type TemperatureSite,
} from "@/lib/care-records";
import {
  addCareRecord,
  addExam,
  addMedicationOrder,
  addReminder,
  addVisit,
  deleteCareRecord,
  deleteExam,
  deleteMedicationOrder,
  deleteReminder,
  deleteVisit,
  getCareLog,
  updateCareRecord,
  updateExam,
  updateMedicationOrder,
  updateReminder,
  updateVisit,
} from "@/lib/care-store";

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown };
type McpContext = { userId: string; displayName: string };

const emptySchema = z.object({}).optional();
const idSchema = z.object({ id: z.string().min(1) });
const listRecordsSchema = z.object({ type: z.string().optional(), limit: z.number().int().positive().max(200).optional() }).optional();
const careRecordSchema = z.object({
  type: z.enum(["temperature", "bloodPressure", "bloodGlucose", "medication", "symptoms", "weight"]),
  datetime: z.string().min(1),
  notes: z.string().optional().default(""),
  value: z.number().optional(),
  site: z.enum(["額", "耳", "腋"]).optional(),
  systolic: z.number().int().optional(),
  diastolic: z.number().int().optional(),
  pulse: z.number().int().optional(),
  posture: z.enum(["坐", "躺"]).optional(),
  mealTiming: z.enum(["飯前", "飯後", "空腹", "其他/未指定"]).optional(),
  clothing: z.enum(["輕", "重"]).optional(),
  drugName: z.string().optional(),
  taken: z.boolean().optional(),
  cleanDay: z.boolean().optional(),
  symptoms: z.array(z.enum(["嘔吐", "頭痛", "頭暈", "視力變化", "發燒", "喘/胸悶", "咳血", "其他"])).optional(),
  severity: z.enum(["無", "輕微", "中等", "嚴重"]).optional(),
  clinicianNotified: z.boolean().optional(),
  soughtCare: z.boolean().optional(),
});
const updateCareRecordSchema = careRecordSchema.partial().extend({ id: z.string().min(1), type: careRecordSchema.shape.type });
const reminderSchema = z.object({ id: z.string().optional(), type: z.enum(["吃藥", "量體溫", "量血壓", "量血糖", "回診", "檢查", "禁食", "其他"]), dueAt: z.string(), recurrence: z.enum(["none", "daily", "weekly", "custom"]).default("none"), linkedRecordId: z.string().optional(), notes: z.string().optional().default(""), completed: z.boolean().optional().default(false) });
const medicationOrderSchema = z.object({ id: z.string().optional(), drugName: z.string(), dose: z.string(), frequency: z.string(), route: z.enum(["口服", "點滴", "其他"]), scheduleHint: z.string(), startDate: z.string(), stopDate: z.string().optional(), notes: z.string().optional().default(""), precautions: z.string().optional().default(""), status: z.enum(["進行中", "已停"]).default("進行中") });
const examSchema = z.object({ id: z.string().optional(), name: z.string(), datetime: z.string(), location: z.string().optional().default(""), resultSummary: z.string().optional().default(""), nextDue: z.string().optional(), status: z.enum(["待做", "完成", "待報告"]).default("待做") });
const visitSchema = z.object({ id: z.string().optional(), department: z.string(), date: z.string(), doctor: z.string().optional(), instructions: z.string(), followUpDate: z.string().optional() });

const toolSchemas: Record<string, z.ZodTypeAny> = {
  list_care_records: listRecordsSchema,
  get_care_record: idSchema,
  create_care_record: careRecordSchema,
  update_care_record: updateCareRecordSchema,
  delete_care_record: idSchema,
  list_reminders: emptySchema,
  create_reminder: reminderSchema,
  update_reminder: reminderSchema.extend({ id: z.string() }),
  complete_reminder: idSchema,
  delete_reminder: idSchema,
  list_medication_orders: emptySchema,
  create_medication_order: medicationOrderSchema,
  update_medication_order: medicationOrderSchema.extend({ id: z.string() }),
  delete_medication_order: idSchema,
  list_exams: emptySchema,
  create_exam: examSchema,
  update_exam: examSchema.extend({ id: z.string() }),
  delete_exam: idSchema,
  list_visits: emptySchema,
  create_visit: visitSchema,
  update_visit: visitSchema.extend({ id: z.string() }),
  delete_visit: idSchema,
};

const toolDescriptions: Record<string, string> = {
  list_care_records: "列出生命徵象與照護紀錄，可用 type 過濾。",
  get_care_record: "取得單筆照護紀錄。",
  create_care_record: "建立照護紀錄。",
  update_care_record: "更新照護紀錄。",
  delete_care_record: "刪除照護紀錄。",
  list_reminders: "列出提醒。",
  create_reminder: "建立提醒。",
  update_reminder: "更新提醒。",
  complete_reminder: "完成提醒。",
  delete_reminder: "刪除提醒。",
  list_medication_orders: "列出用藥醫囑。",
  create_medication_order: "建立用藥醫囑。",
  update_medication_order: "更新用藥醫囑。",
  delete_medication_order: "刪除用藥醫囑。",
  list_exams: "列出檢查紀錄。",
  create_exam: "建立檢查紀錄。",
  update_exam: "更新檢查紀錄。",
  delete_exam: "刪除檢查紀錄。",
  list_visits: "列出看診紀錄。",
  create_visit: "建立看診紀錄。",
  update_visit: "更新看診紀錄。",
  delete_visit: "刪除看診紀錄。",
};

export async function GET() {
  return NextResponse.json({ error: "SSE stream is not implemented; use POST JSON-RPC." }, { status: 405 });
}

export async function POST(request: NextRequest) {
  const context = await authenticateBearer(request);
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const message = (await request.json()) as RpcRequest;
  if (message.id === undefined && message.method !== "initialize") return new NextResponse(null, { status: 202 });

  try {
    if (message.method === "initialize") return rpc(message.id, { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "CareLog MCP", version: "1.0.0" } });
    if (message.method === "tools/list") return rpc(message.id, { tools: Object.keys(toolSchemas).map((name) => ({ name, description: toolDescriptions[name], inputSchema: z.toJSONSchema(toolSchemas[name]) })) });
    if (message.method === "tools/call") {
      const { name, arguments: args } = z.object({ name: z.string(), arguments: z.unknown().optional() }).parse(message.params);
      return rpc(message.id, await callTool(context, name, args ?? {}));
    }
    return rpcError(message.id, -32601, "Method not found");
  } catch (error) {
    return rpcError(message.id, -32000, error instanceof Error ? error.message : "Unknown error");
  }
}

async function authenticateBearer(request: NextRequest): Promise<McpContext | null> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const tokenAuth = await verifyApiToken(bearer);
  if (tokenAuth) return { userId: tokenAuth.user.id, displayName: tokenAuth.user.displayName };
  if (process.env.CARELOG_REMINDER_TOKEN && bearer === process.env.CARELOG_REMINDER_TOKEN) return { userId: "bot", displayName: "提醒機器人" };
  return null;
}

async function callTool(context: McpContext, name: string, rawArgs: unknown) {
  const schema = toolSchemas[name];
  if (!schema) throw new Error(`Unknown tool: ${name}`);
  const args = schema.parse(rawArgs ?? {}) as Record<string, unknown>;
  const data = await getCareLog();
  const now = new Date().toISOString();

  switch (name) {
    case "list_care_records": {
      const listArgs = listRecordsSchema.parse(rawArgs ?? {}) ?? {};
      return textResult(
        data.records
          .filter((record) => !listArgs.type || record.type === listArgs.type)
          .slice(0, listArgs.limit ?? 100),
      );
    }
    case "get_care_record": return textResult(data.records.find((record) => record.id === args.id) ?? null);
    case "create_care_record": return textResult(await addCareRecord(buildCareRecord(careRecordSchema.parse(args), context.displayName)));
    case "update_care_record": {
      const updateArgs = updateCareRecordSchema.parse(args);
      return textResult(await updateCareRecord(updateArgs.id, (record) => ({ ...buildCareRecord(careRecordSchema.parse({ ...record, ...updateArgs }), record.type === "medication" ? record.confirmedBy : record.recordedBy), id: record.id, createdAt: record.createdAt, lastEditedBy: context.displayName, lastEditedAt: now })));
    }
    case "delete_care_record": return textResult(await deleteCareRecord(String(args.id)));
    case "list_reminders": return textResult(data.reminders);
    case "create_reminder": return textResult(await addReminder({ ...args, id: createId(), recordedBy: context.displayName, createdAt: now, completed: Boolean(args.completed) } as Parameters<typeof addReminder>[0]));
    case "update_reminder": return textResult(await updateReminder(String(args.id), (item) => ({ ...item, ...args, lastEditedBy: context.displayName, lastEditedAt: now })));
    case "complete_reminder": return textResult(await updateReminder(String(args.id), (item) => ({ ...item, completed: true, completedAt: now, completedBy: context.displayName, lastEditedBy: context.displayName, lastEditedAt: now })));
    case "delete_reminder": return textResult(await deleteReminder(String(args.id)));
    case "list_medication_orders": return textResult(data.medicationOrders);
    case "create_medication_order": return textResult(await addMedicationOrder({ ...args, id: createId(), recordedBy: context.displayName, createdAt: now } as Parameters<typeof addMedicationOrder>[0]));
    case "update_medication_order": return textResult(await updateMedicationOrder(String(args.id), (item) => ({ ...item, ...args, lastEditedBy: context.displayName, lastEditedAt: now })));
    case "delete_medication_order": return textResult(await deleteMedicationOrder(String(args.id)));
    case "list_exams": return textResult(data.exams);
    case "create_exam": return textResult(await addExam({ ...args, id: createId(), recordedBy: context.displayName, createdAt: now } as Parameters<typeof addExam>[0]));
    case "update_exam": return textResult(await updateExam(String(args.id), (item) => ({ ...item, ...args, lastEditedBy: context.displayName, lastEditedAt: now })));
    case "delete_exam": return textResult(await deleteExam(String(args.id)));
    case "list_visits": return textResult(data.visits);
    case "create_visit": return textResult(await addVisit({ ...args, id: createId(), recordedBy: context.displayName, createdAt: now } as Parameters<typeof addVisit>[0]));
    case "update_visit": return textResult(await updateVisit(String(args.id), (item) => ({ ...item, ...args, lastEditedBy: context.displayName, lastEditedAt: now })));
    case "delete_visit": return textResult(await deleteVisit(String(args.id)));
  }
}

function buildCareRecord(args: z.infer<typeof careRecordSchema>, userName: string) {
  switch (args.type) {
    case "temperature": return createRecord("temperature", { datetime: args.datetime, value: requiredNumber(args.value, "value"), site: (args.site ?? "耳") as TemperatureSite, recordedBy: userName, notes: args.notes });
    case "bloodPressure": return createRecord("bloodPressure", { datetime: args.datetime, systolic: requiredNumber(args.systolic, "systolic"), diastolic: requiredNumber(args.diastolic, "diastolic"), pulse: args.pulse, posture: (args.posture ?? "坐") as BloodPressurePosture, recordedBy: userName, notes: args.notes });
    case "bloodGlucose": return createRecord("bloodGlucose", { datetime: args.datetime, value: requiredNumber(args.value, "value"), mealTiming: (args.mealTiming ?? "其他/未指定") as GlucoseMealTiming, recordedBy: userName, notes: args.notes });
    case "medication": return createRecord("medication", { datetime: args.datetime, drugName: args.drugName ?? "未命名藥物", taken: args.taken ?? true, confirmedBy: userName, notes: args.notes });
    case "symptoms": return createRecord("symptoms", { datetime: args.datetime, recordedBy: userName, cleanDay: args.cleanDay ?? false, symptoms: (args.symptoms ?? []) as Symptom[], severity: (args.severity ?? "輕微") as Severity, clinicianNotified: args.clinicianNotified ?? false, soughtCare: args.soughtCare ?? false, notes: args.notes });
    case "weight": return createRecord("weight", { datetime: args.datetime, value: requiredNumber(args.value, "value"), clothing: (args.clothing ?? "輕") as Clothing, recordedBy: userName, notes: args.notes });
  }
}

function requiredNumber(value: number | undefined, name: string) { if (value === undefined) throw new Error(`${name} is required`); return value; }
function textResult(value: unknown) { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }; }
function rpc(id: RpcRequest["id"], result: unknown) { return NextResponse.json({ jsonrpc: "2.0", id, result }); }
function rpcError(id: RpcRequest["id"], code: number, message: string) { return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }); }
function createId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
