import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../app.js";

function makeTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-hub-test-"));
  return path.join(dir, "hub.sqlite");
}

test("register agents, create conversation, send command, fetch unread, mark read", async () => {
  const dbPath = makeTempDbPath();
  const { app, closeDb } = createApp(dbPath);

  await request(app).post("/agents/register").send({ id: "agent-a", name: "Agent A" }).expect(201);
  await request(app).post("/agents/register").send({ id: "agent-b", name: "Agent B" }).expect(201);

  const createConversationRes = await request(app)
    .post("/conversations")
    .send({ createdByAgentId: "agent-a", title: "Ops" })
    .expect(201);

  const conversationId = createConversationRes.body.id as string;
  assert.ok(conversationId);

  await request(app)
    .post(`/conversations/${conversationId}/join`)
    .send({ agentId: "agent-b" })
    .expect(201);

  const sendCommandRes = await request(app).post("/messages").send({
    conversationId,
    senderAgentId: "agent-a",
    kind: "command",
    text: "Run daily sync",
    commandName: "sync.contacts",
    commandPayloadJson: { dryRun: true },
    idempotencyKey: "cmd-1",
  });

  assert.equal(sendCommandRes.status, 201);
  assert.ok(sendCommandRes.body.id);

  const unreadRes = await request(app).get(`/agents/agent-b/unread?conversationId=${conversationId}`).expect(200);
  assert.equal(unreadRes.body.items.length, 1);
  assert.equal(unreadRes.body.items[0].kind, "command");

  const messageId = unreadRes.body.items[0].id as string;
  await request(app).post("/messages/read").send({ agentId: "agent-b", messageIds: [messageId] }).expect(200);

  const unreadAfterRead = await request(app)
    .get(`/agents/agent-b/unread?conversationId=${conversationId}`)
    .expect(200);
  assert.equal(unreadAfterRead.body.items.length, 0);

  closeDb();
});

test("idempotency key deduplicates message creation", async () => {
  const dbPath = makeTempDbPath();
  const { app, closeDb } = createApp(dbPath);

  await request(app).post("/agents/register").send({ id: "agent-a", name: "Agent A" }).expect(201);

  const createConversationRes = await request(app)
    .post("/conversations")
    .send({ createdByAgentId: "agent-a", title: "Ops" })
    .expect(201);

  const conversationId = createConversationRes.body.id as string;

  const first = await request(app).post("/messages").send({
    conversationId,
    senderAgentId: "agent-a",
    kind: "ask",
    text: "What is status?",
    idempotencyKey: "same-key",
  });
  assert.equal(first.status, 201);

  const second = await request(app).post("/messages").send({
    conversationId,
    senderAgentId: "agent-a",
    kind: "ask",
    text: "What is status?",
    idempotencyKey: "same-key",
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.deduped, true);
  assert.equal(second.body.id, first.body.id);

  closeDb();
});
