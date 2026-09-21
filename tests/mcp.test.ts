import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST } from "../app/api/mcp/route";
import { bootstrapUsersIfEmpty, createApiToken } from "../lib/auth";
import { getCareLog } from "../lib/care-store";

test("mcp rejects missing bearer token and lists tools with a valid api token", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-mcp-"));
  const filePath = path.join(dir, "carelog.json");
  const previousDataFile = process.env.CARELOG_DATA_FILE;

  try {
    process.env.CARELOG_DATA_FILE = filePath;
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const { token } = await createApiToken(data.users[0].id, "MCP test", filePath);

    const rejected = await POST(
      new NextRequest("http://localhost/api/mcp", {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    assert.equal(rejected.status, 401);

    const accepted = await POST(
      new NextRequest("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      }),
    );
    assert.equal(accepted.status, 200);
    const payload = await accepted.json();
    const names = payload.result.tools.map((tool: { name: string }) => tool.name);
    assert.equal(names.includes("create_care_record"), true);
    assert.equal(names.includes("list_reminders"), true);

    const created = await POST(
      new NextRequest("http://localhost/api/mcp", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "create_care_record",
            arguments: {
              type: "bloodOxygen",
              datetime: "2026-09-21T08:00",
              value: 96.5,
              pulse: 70,
              notes: "MCP",
            },
          },
        }),
      }),
    );
    assert.equal(created.status, 200);
    const createdPayload = await created.json();
    const createdRecord = JSON.parse(createdPayload.result.content[0].text);
    assert.equal(createdRecord.type, "bloodOxygen");
    assert.equal(createdRecord.value, 96.5);
    assert.equal(createdRecord.pulse, 70);
    assert.equal(createdRecord.abnormal, false);

    const listed = await POST(
      new NextRequest("http://localhost/api/mcp", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "list_care_records", arguments: { type: "bloodOxygen" } },
        }),
      }),
    );
    const listedPayload = await listed.json();
    const listedRecords = JSON.parse(listedPayload.result.content[0].text);
    assert.equal(listedRecords.length, 1);
    assert.equal(listedRecords[0].id, createdRecord.id);

    const updated = await POST(
      new NextRequest("http://localhost/api/mcp", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "update_care_record",
            arguments: { id: createdRecord.id, type: "bloodOxygen", value: 93 },
          },
        }),
      }),
    );
    const updatedPayload = await updated.json();
    const updatedRecord = JSON.parse(updatedPayload.result.content[0].text);
    assert.equal(updatedRecord.value, 93);
    assert.equal(updatedRecord.abnormal, true);

    const deleted = await POST(
      new NextRequest("http://localhost/api/mcp", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "delete_care_record", arguments: { id: createdRecord.id } },
        }),
      }),
    );
    assert.equal(deleted.status, 200);
    assert.equal((await getCareLog(filePath)).records.length, 0);
  } finally {
    if (previousDataFile === undefined) {
      delete process.env.CARELOG_DATA_FILE;
    } else {
      process.env.CARELOG_DATA_FILE = previousDataFile;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
