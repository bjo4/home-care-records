import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST } from "../app/api/line/webhook/route";
import { bootstrapUsersIfEmpty } from "../lib/auth";
import { getCareLog, saveCareLog } from "../lib/care-store";
import { bindLineUser, createLineBindCode, setPendingLineInput } from "../lib/line";

type LineReplyCall = {
  url: string;
  body: {
    replyToken?: string;
    messages?: { type?: string; text?: string; altText?: string }[];
  };
};

test("line webhook stays quiet except for commands, bind codes, and pending input", { concurrency: 1 }, async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "carelog-line-webhook-"));
  const filePath = path.join(dir, "carelog.json");
  const secret = "line-webhook-secret";
  const previous = {
    dataFile: process.env.CARELOG_DATA_FILE,
    secret: process.env.LINE_CHANNEL_SECRET,
    token: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    altSecret: process.env.CARELOG_LINE_CHANNEL_SECRET,
    altToken: process.env.CARELOG_LINE_CHANNEL_ACCESS_TOKEN,
    fetch: globalThis.fetch,
  };
  const replies: LineReplyCall[] = [];

  process.env.CARELOG_DATA_FILE = filePath;
  process.env.LINE_CHANNEL_SECRET = secret;
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "line-access-token";
  delete process.env.CARELOG_LINE_CHANNEL_SECRET;
  delete process.env.CARELOG_LINE_CHANNEL_ACCESS_TOKEN;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    replies.push({
      url: String(input),
      body: init?.body ? (JSON.parse(String(init.body)) as LineReplyCall["body"]) : {},
    });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    await bootstrapUsersIfEmpty("warren:alpha:Warren", filePath);
    const data = await getCareLog(filePath);
    const bindCode = await createLineBindCode(data.users[0].id, data.users[0].displayName);
    await bindLineUser("Cfamily-group", bindCode.code, "group");

    await t.test("group random chat does not reply", async () => {
      replies.length = 0;
      const response = await postWebhook(secret, [
        textEvent("r-group-chat", {
          type: "group",
          groupId: "Cfamily-group",
          userId: "Usender",
        }, "今晚吃什麼"),
      ]);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
      assert.equal(lineReplies(replies).length, 0);
      assert.equal((await getCareLog(filePath)).records.length, 0);
    });

    await t.test("1:1 random chat without pending does not nag", async () => {
      replies.length = 0;
      const userCode = await createLineBindCode(
        (await getCareLog(filePath)).users[0].id,
        "Warren",
      );
      await bindLineUser("Uone", userCode.code, "user");
      const response = await postWebhook(secret, [
        textEvent("r-user-chat", { type: "user", userId: "Uone" }, "在忙嗎"),
      ]);
      assert.equal(response.status, 200);
      assert.equal(lineReplies(replies).length, 0);
    });

    await t.test("unbound 1:1 chat without a bind code stays silent", async () => {
      replies.length = 0;
      const response = await postWebhook(secret, [
        textEvent("r-unbound", { type: "user", userId: "Ustranger" }, "哈囉"),
      ]);
      assert.equal(response.status, 200);
      assert.equal(lineReplies(replies).length, 0);
    });

    await t.test("group command still replies with the menu", async () => {
      replies.length = 0;
      const response = await postWebhook(secret, [
        textEvent("r-menu", {
          type: "group",
          groupId: "Cfamily-group",
          userId: "Usender",
        }, "選單"),
      ]);
      assert.equal(response.status, 200);
      const messages = lineReplies(replies);
      assert.equal(messages.length, 1);
      assert.equal(messages[0]?.body.replyToken, "r-menu");
      assert.equal(messages[0]?.body.messages?.[0]?.type, "flex");
      assert.match(messages[0]?.body.messages?.[0]?.altText ?? "", /CareLog/);
    });

    await t.test("group pending input still records and replies", async () => {
      replies.length = 0;
      await setPendingLineInput("Cfamily-group", "temperature");
      const response = await postWebhook(secret, [
        textEvent("r-pending", {
          type: "group",
          groupId: "Cfamily-group",
          userId: "Usender",
        }, "36.8"),
      ]);
      assert.equal(response.status, 200);
      const messages = lineReplies(replies);
      assert.equal(messages.length, 1);
      assert.equal(messages[0]?.body.messages?.[0]?.text, "已新增紀錄。");
      const saved = await getCareLog(filePath);
      assert.equal(saved.records.at(-1)?.type, "temperature");
      assert.equal(saved.linePendingInputs.length, 0);
    });

    await t.test("bind code in a group still binds and replies", async () => {
      replies.length = 0;
      const fresh = await createLineBindCode(
        (await getCareLog(filePath)).users[0].id,
        "Warren",
      );
      const response = await postWebhook(secret, [
        textEvent("r-bind", {
          type: "group",
          groupId: "Cnew-family",
          userId: "Usender",
        }, fresh.code),
      ]);
      assert.equal(response.status, 200);
      const messages = lineReplies(replies);
      assert.equal(messages.length, 1);
      assert.match(messages[0]?.body.messages?.[0]?.text ?? "", /已綁定 家庭群組（Warren）/);
      const saved = await getCareLog(filePath);
      assert.equal(
        saved.lineBindings.some((item) => item.lineUserId === "Cnew-family" && item.sourceType === "group"),
        true,
      );
    });

    await t.test("visit text commands reply with the list flex", async () => {
      replies.length = 0;
      const current = await getCareLog(filePath);
      await saveCareLog(
        {
          ...current,
          visits: [
            {
              id: "v-line",
              department: "心臟內科",
              date: "2026-09-18",
              doctor: "林醫師",
              instructions: "持續追蹤心律",
              recordedBy: "Warren",
              createdAt: "2026-09-18T08:00:00.000Z",
            },
          ],
        },
        filePath,
      );

      for (const [replyToken, text] of [
        ["r-visits-text", "看診紀錄"],
        ["r-visits-alias", "看診"],
      ] as const) {
        replies.length = 0;
        const response = await postWebhook(secret, [
          textEvent(replyToken, {
            type: "group",
            groupId: "Cfamily-group",
            userId: "Usender",
          }, text),
        ]);
        assert.equal(response.status, 200);
        const messages = lineReplies(replies);
        assert.equal(messages.length, 1);
        assert.equal(messages[0]?.body.messages?.[0]?.type, "flex");
        assert.match(messages[0]?.body.messages?.[0]?.altText ?? "", /看診/);
      }
    });

    await t.test("visit list and detail postbacks reply in group and 1:1", async () => {
      replies.length = 0;
      const current = await getCareLog(filePath);
      await saveCareLog(
        {
          ...current,
          visits: Array.from({ length: 10 }, (_, index) => ({
            id: index === 0 ? "v-line" : `v-page-${index}`,
            department: index === 0 ? "心臟內科" : `第${index + 1}科`,
            date: `2026-09-${String(21 - index).padStart(2, "0")}`,
            doctor: index === 0 ? "林醫師" : undefined,
            instructions: index === 0 ? "持續追蹤心律" : `摘要 ${index + 1}`,
            recordedBy: "Warren",
            createdAt: "2026-09-18T08:00:00.000Z",
          })),
        },
        filePath,
      );

      const listResponse = await postWebhook(secret, [
        postbackEvent("r-visits-list", {
          type: "group",
          groupId: "Cfamily-group",
          userId: "Usender",
        }, "action=visits&page=1"),
      ]);
      assert.equal(listResponse.status, 200);
      const listMessages = lineReplies(replies);
      assert.equal(listMessages.length, 1);
      assert.equal(listMessages[0]?.body.messages?.[0]?.type, "flex");
      assert.match(listMessages[0]?.body.messages?.[0]?.altText ?? "", /看診紀錄共 10 筆/);

      replies.length = 0;
      const page2Response = await postWebhook(secret, [
        postbackEvent("r-visits-page-2", {
          type: "user",
          userId: "Uone",
        }, "action=visits&page=2"),
      ]);
      assert.equal(page2Response.status, 200);
      const page2Messages = lineReplies(replies);
      assert.equal(page2Messages.length, 1);
      assert.equal(page2Messages[0]?.body.messages?.[0]?.type, "flex");
      assert.match(page2Messages[0]?.body.messages?.[0]?.altText ?? "", /看診紀錄共 10 筆/);

      replies.length = 0;
      const detailResponse = await postWebhook(secret, [
        postbackEvent("r-visit-detail", {
          type: "user",
          userId: "Uone",
        }, "action=visit&id=v-line&page=1"),
      ]);
      assert.equal(detailResponse.status, 200);
      const detailMessages = lineReplies(replies);
      assert.equal(detailMessages.length, 1);
      assert.equal(detailMessages[0]?.body.messages?.[0]?.type, "flex");
      assert.match(detailMessages[0]?.body.messages?.[0]?.altText ?? "", /心臟內科|看診/);

      replies.length = 0;
      const groupDetail = await postWebhook(secret, [
        postbackEvent("r-visit-detail-group", {
          type: "group",
          groupId: "Cfamily-group",
          userId: "Usender",
        }, "action=visit&id=v-line&page=2"),
      ]);
      assert.equal(groupDetail.status, 200);
      assert.equal(lineReplies(replies)[0]?.body.messages?.[0]?.type, "flex");

      replies.length = 0;
      const missing = await postWebhook(secret, [
        postbackEvent("r-visit-missing", {
          type: "group",
          groupId: "Cfamily-group",
          userId: "Usender",
        }, "action=visit&id=missing&page=1"),
      ]);
      assert.equal(missing.status, 200);
      assert.match(lineReplies(replies)[0]?.body.messages?.[0]?.text ?? "", /找不到這筆看診紀錄/);
    });

    await t.test("unbound visit command asks for bind code and empty list stays a flex card", async () => {
      replies.length = 0;
      const unbound = await postWebhook(secret, [
        textEvent("r-visits-unbound", { type: "user", userId: "Ustranger" }, "看診"),
      ]);
      assert.equal(unbound.status, 200);
      assert.match(
        lineReplies(replies)[0]?.body.messages?.[0]?.text ?? "",
        /綁定碼/,
      );

      replies.length = 0;
      const current = await getCareLog(filePath);
      await saveCareLog({ ...current, visits: [] }, filePath);
      const empty = await postWebhook(secret, [
        textEvent("r-visits-empty", {
          type: "group",
          groupId: "Cfamily-group",
          userId: "Usender",
        }, "看診紀錄"),
      ]);
      assert.equal(empty.status, 200);
      const emptyMessage = lineReplies(replies)[0]?.body.messages?.[0];
      assert.equal(emptyMessage?.type, "flex");
      assert.match(emptyMessage?.altText ?? "", /看診/);
    });

    await t.test("join welcome still replies once", async () => {
      replies.length = 0;
      const response = await postWebhook(secret, [
        {
          type: "join",
          replyToken: "r-join",
          source: { type: "group", groupId: "Cwelcome-group", userId: "Usender" },
        },
      ]);
      assert.equal(response.status, 200);
      const messages = lineReplies(replies);
      assert.equal(messages.length, 1);
      assert.equal(messages[0]?.body.messages?.[0]?.type, "flex");
      assert.match(messages[0]?.body.messages?.[1]?.text ?? "", /綁定碼/);
    });
  } finally {
    if (previous.dataFile === undefined) delete process.env.CARELOG_DATA_FILE;
    else process.env.CARELOG_DATA_FILE = previous.dataFile;
    if (previous.secret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = previous.secret;
    if (previous.token === undefined) delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    else process.env.LINE_CHANNEL_ACCESS_TOKEN = previous.token;
    if (previous.altSecret === undefined) delete process.env.CARELOG_LINE_CHANNEL_SECRET;
    else process.env.CARELOG_LINE_CHANNEL_SECRET = previous.altSecret;
    if (previous.altToken === undefined) delete process.env.CARELOG_LINE_CHANNEL_ACCESS_TOKEN;
    else process.env.CARELOG_LINE_CHANNEL_ACCESS_TOKEN = previous.altToken;
    globalThis.fetch = previous.fetch;
    await rm(dir, { recursive: true, force: true });
  }
});

function textEvent(
  replyToken: string,
  source: { type: string; userId?: string; groupId?: string; roomId?: string },
  text: string,
) {
  return {
    type: "message",
    replyToken,
    source,
    message: { type: "text", text },
  };
}

function postbackEvent(
  replyToken: string,
  source: { type: string; userId?: string; groupId?: string; roomId?: string },
  data: string,
) {
  return {
    type: "postback",
    replyToken,
    source,
    postback: { data },
  };
}

async function postWebhook(secret: string, events: unknown[]) {
  const body = JSON.stringify({ events });
  const signature = createHmac("sha256", secret).update(body).digest("base64");
  return POST(
    new NextRequest("http://localhost/api/line/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-line-signature": signature,
      },
      body,
    }),
  );
}

function lineReplies(replies: LineReplyCall[]) {
  return replies.filter((item) => item.url.includes("https://api.line.me/v2/bot/message/reply"));
}
