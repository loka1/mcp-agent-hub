import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import express from "express";
import { runMigrations } from "./db/migrate.js";

type MessageKind = "ask" | "command" | "result" | "note";
type ExecutionStatus = "accepted" | "running" | "success" | "failed";

type EventPayload = {
  type: "message_created" | "message_read" | "member_joined" | "member_left";
  at: string;
  data: Record<string, unknown>;
};

type AppBundle = {
  app: express.Express;
  closeDb: () => void;
};

type UnreadRow = {
  id: string;
  created_at: string;
};

type HistoryRow = {
  id: string;
  created_at: string;
};

export function createApp(dbPath: string): AppBundle {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  runMigrations(db);

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const sseClients = new Map<string, Set<express.Response>>();

  function nowIso(): string {
    return new Date().toISOString();
  }

  function parseLimit(limitRaw: string | undefined, defaultLimit = 50, maxLimit = 200): number {
    const parsed = Number(limitRaw ?? defaultLimit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return defaultLimit;
    }
    return Math.min(Math.floor(parsed), maxLimit);
  }

  function emitToAgent(agentId: string, event: EventPayload): void {
    const conns = sseClients.get(agentId);
    if (!conns || conns.size === 0) {
      return;
    }
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of conns) {
      res.write(payload);
    }
  }

  function getConversationMemberIds(conversationId: string): string[] {
    const rows = db
      .prepare("SELECT agent_id FROM conversation_members WHERE conversation_id = ?")
      .all(conversationId) as Array<{ agent_id: string }>;
    return rows.map((r) => r.agent_id);
  }

  function requireAgentExists(agentId: string): boolean {
    const row = db.prepare("SELECT 1 FROM agents WHERE id = ?").get(agentId);
    return Boolean(row);
  }

  function requireMember(conversationId: string, agentId: string): boolean {
    const row = db
      .prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND agent_id = ?")
      .get(conversationId, agentId);
    return Boolean(row);
  }

  function createReceiptsForMessage(messageId: string, conversationId: string, senderAgentId: string): void {
    const memberIds = getConversationMemberIds(conversationId).filter((id) => id !== senderAgentId);
    const deliveredAt = nowIso();
    const stmt = db.prepare(
      `INSERT INTO message_receipts (message_id, agent_id, delivered_at, read_at)
       VALUES (?, ?, ?, NULL)`,
    );
    const tx = db.transaction(() => {
      for (const memberId of memberIds) {
        stmt.run(messageId, memberId, deliveredAt);
        emitToAgent(memberId, {
          type: "message_created",
          at: deliveredAt,
          data: { messageId, conversationId },
        });
      }
    });
    tx();
  }

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "hub-server", dbPath });
  });

  app.post("/agents/register", (req, res) => {
    const id = String(req.body?.id ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    if (!id || !name) {
      return res.status(400).json({ error: "id and name are required" });
    }

    try {
      db.prepare("INSERT INTO agents (id, name, created_at) VALUES (?, ?, ?)").run(id, name, nowIso());
      return res.status(201).json({ id, name });
    } catch (error) {
      return res.status(409).json({ error: "agent id or name already exists", details: String(error) });
    }
  });

  app.post("/agents/remove", (req, res) => {
    const id = String(req.body?.id ?? "").trim();
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    const result = db.prepare("DELETE FROM agents WHERE id = ?").run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: "agent not found" });
    }
    return res.status(200).json({ removed: id });
  });

  app.post("/conversations", (req, res) => {
    const createdByAgentId = String(req.body?.createdByAgentId ?? "").trim();
    const titleRaw = req.body?.title;
    const title = titleRaw == null ? null : String(titleRaw);
    if (!createdByAgentId) {
      return res.status(400).json({ error: "createdByAgentId is required" });
    }
    if (!requireAgentExists(createdByAgentId)) {
      return res.status(404).json({ error: "creator agent not found" });
    }

    const id = randomUUID();
    const createdAt = nowIso();
    const tx = db.transaction(() => {
      db.prepare(
        "INSERT INTO conversations (id, title, created_by_agent_id, created_at) VALUES (?, ?, ?, ?)",
      ).run(id, title, createdByAgentId, createdAt);
      db.prepare(
        "INSERT INTO conversation_members (conversation_id, agent_id, joined_at) VALUES (?, ?, ?)",
      ).run(id, createdByAgentId, createdAt);
    });
    tx();

    return res.status(201).json({ id, title, createdByAgentId, createdAt });
  });

  app.post("/conversations/:conversationId/join", (req, res) => {
    const conversationId = req.params.conversationId;
    const agentId = String(req.body?.agentId ?? "").trim();
    if (!agentId) {
      return res.status(400).json({ error: "agentId is required" });
    }
    if (!requireAgentExists(agentId)) {
      return res.status(404).json({ error: "agent not found" });
    }
    const convoExists = db.prepare("SELECT 1 FROM conversations WHERE id = ?").get(conversationId);
    if (!convoExists) {
      return res.status(404).json({ error: "conversation not found" });
    }

    try {
      const joinedAt = nowIso();
      db.prepare(
        "INSERT INTO conversation_members (conversation_id, agent_id, joined_at) VALUES (?, ?, ?)",
      ).run(conversationId, agentId, joinedAt);

      for (const memberId of getConversationMemberIds(conversationId)) {
        if (memberId === agentId) continue;
        emitToAgent(memberId, {
          type: "member_joined",
          at: joinedAt,
          data: { conversationId, agentId },
        });
      }

      return res.status(201).json({ conversationId, agentId, joinedAt });
    } catch {
      return res.status(409).json({ error: "agent already in conversation" });
    }
  });

  app.post("/conversations/:conversationId/leave", (req, res) => {
    const conversationId = req.params.conversationId;
    const agentId = String(req.body?.agentId ?? "").trim();
    if (!agentId) {
      return res.status(400).json({ error: "agentId is required" });
    }
    const result = db
      .prepare("DELETE FROM conversation_members WHERE conversation_id = ? AND agent_id = ?")
      .run(conversationId, agentId);
    if (result.changes === 0) {
      return res.status(404).json({ error: "membership not found" });
    }

    const at = nowIso();
    for (const memberId of getConversationMemberIds(conversationId)) {
      emitToAgent(memberId, {
        type: "member_left",
        at,
        data: { conversationId, agentId },
      });
    }
    return res.status(200).json({ conversationId, agentId, leftAt: at });
  });

  app.get("/agents/:agentId/conversations", (req, res) => {
    const { agentId } = req.params;
    const rows = db
      .prepare(
        `SELECT c.id, c.title, c.created_by_agent_id, c.created_at
         FROM conversations c
         JOIN conversation_members cm ON cm.conversation_id = c.id
         WHERE cm.agent_id = ?
         ORDER BY c.created_at DESC`,
      )
      .all(agentId);
    return res.json({ items: rows });
  });

  app.post("/messages", (req, res) => {
    const conversationId = String(req.body?.conversationId ?? "").trim();
    const senderAgentId = String(req.body?.senderAgentId ?? "").trim();
    const kind = String(req.body?.kind ?? "").trim() as MessageKind;
    const text = String(req.body?.text ?? "").trim();
    const replyToMessageId = req.body?.replyToMessageId ? String(req.body.replyToMessageId) : null;
    const commandName = req.body?.commandName ? String(req.body.commandName) : null;
    const commandPayloadJson = req.body?.commandPayloadJson
      ? JSON.stringify(req.body.commandPayloadJson)
      : null;
    const executionStatus = req.body?.executionStatus
      ? (String(req.body.executionStatus) as ExecutionStatus)
      : null;
    const idempotencyKey = req.body?.idempotencyKey ? String(req.body.idempotencyKey) : null;

    if (!conversationId || !senderAgentId || !kind || !text) {
      return res.status(400).json({ error: "conversationId, senderAgentId, kind, text are required" });
    }
    if (!requireMember(conversationId, senderAgentId)) {
      return res.status(403).json({ error: "sender must be a conversation member" });
    }
    if (!["ask", "command", "result", "note"].includes(kind)) {
      return res.status(400).json({ error: "invalid kind" });
    }

    if (idempotencyKey) {
      const existing = db
        .prepare(
          `SELECT id, created_at FROM messages
           WHERE conversation_id = ? AND sender_agent_id = ? AND idempotency_key = ?`,
        )
        .get(conversationId, senderAgentId, idempotencyKey) as { id: string; created_at: string } | undefined;
      if (existing) {
        return res.status(200).json({ id: existing.id, deduped: true, createdAt: existing.created_at });
      }
    }

    const id = randomUUID();
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO messages (
        id, conversation_id, sender_agent_id, kind, text, reply_to_message_id,
        command_name, command_payload_json, execution_status, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      conversationId,
      senderAgentId,
      kind,
      text,
      replyToMessageId,
      commandName,
      commandPayloadJson,
      executionStatus,
      idempotencyKey,
      createdAt,
    );

    createReceiptsForMessage(id, conversationId, senderAgentId);
    return res.status(201).json({ id, createdAt });
  });

  app.get("/agents/:agentId/unread", (req, res) => {
    const { agentId } = req.params;
    const conversationId = req.query.conversationId ? String(req.query.conversationId) : null;
    const limit = parseLimit(req.query.limit ? String(req.query.limit) : undefined);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const filters: string[] = ["mr.agent_id = ?", "mr.read_at IS NULL"];
    const params: unknown[] = [agentId];

    if (conversationId) {
      filters.push("m.conversation_id = ?");
      params.push(conversationId);
    }

    if (cursor) {
      filters.push("(m.created_at < ? OR (m.created_at = ? AND m.id < ?))");
      const [cursorCreatedAt, cursorId] = cursor.split("|");
      params.push(cursorCreatedAt, cursorCreatedAt, cursorId);
    }

    params.push(limit + 1);

    const rows = db
      .prepare(
        `SELECT m.id, m.conversation_id, m.sender_agent_id, m.kind, m.text, m.reply_to_message_id,
                m.command_name, m.command_payload_json, m.execution_status, m.idempotency_key, m.created_at,
                mr.delivered_at, mr.read_at
         FROM message_receipts mr
         JOIN messages m ON m.id = mr.message_id
         WHERE ${filters.join(" AND ")}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ?`,
      )
      .all(...params) as UnreadRow[];

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? `${String(items[items.length - 1].created_at)}|${String(items[items.length - 1].id)}`
      : null;
    return res.json({ items, nextCursor });
  });

  app.post("/messages/read", (req, res) => {
    const agentId = String(req.body?.agentId ?? "").trim();
    const messageIds = Array.isArray(req.body?.messageIds)
      ? req.body.messageIds.map((id: unknown) => String(id))
      : [];
    if (!agentId || messageIds.length === 0) {
      return res.status(400).json({ error: "agentId and messageIds[] are required" });
    }
    const readAt = nowIso();
    const stmt = db.prepare(
      `UPDATE message_receipts
       SET read_at = ?
       WHERE agent_id = ? AND message_id = ? AND read_at IS NULL`,
    );
    const tx = db.transaction(() => {
      let updated = 0;
      for (const messageId of messageIds) {
        const result = stmt.run(readAt, agentId, messageId);
        updated += result.changes;
        if (result.changes > 0) {
          emitToAgent(agentId, {
            type: "message_read",
            at: readAt,
            data: { messageId, agentId },
          });
        }
      }
      return updated;
    });
    const updated = tx();
    return res.json({ updated, readAt });
  });

  app.get("/conversations/:conversationId/history", (req, res) => {
    const conversationId = req.params.conversationId;
    const limit = parseLimit(req.query.limit ? String(req.query.limit) : undefined);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const filters = ["conversation_id = ?"];
    const params: unknown[] = [conversationId];

    if (cursor) {
      const [cursorCreatedAt, cursorId] = cursor.split("|");
      filters.push("(created_at < ? OR (created_at = ? AND id < ?))");
      params.push(cursorCreatedAt, cursorCreatedAt, cursorId);
    }
    params.push(limit + 1);

    const rows = db
      .prepare(
        `SELECT *
         FROM messages
         WHERE ${filters.join(" AND ")}
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(...params) as HistoryRow[];

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? `${String(items[items.length - 1].created_at)}|${String(items[items.length - 1].id)}`
      : null;
    return res.json({ items, nextCursor });
  });

  app.get("/conversations/:conversationId/last", (req, res) => {
    const conversationId = req.params.conversationId;
    const kind = String(req.query.kind ?? "").trim() as MessageKind;
    if (!["ask", "command"].includes(kind)) {
      return res.status(400).json({ error: "kind must be ask or command" });
    }

    const item = db
      .prepare(
        `SELECT * FROM messages
         WHERE conversation_id = ? AND kind = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
      )
      .get(conversationId, kind);
    return res.json({ item: item ?? null });
  });

  app.get("/events", (req, res) => {
    const agentId = String(req.query.agentId ?? "").trim();
    if (!agentId) {
      return res.status(400).json({ error: "agentId query param is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const conns = sseClients.get(agentId) ?? new Set<express.Response>();
    conns.add(res);
    sseClients.set(agentId, conns);

    res.write(`event: connected\ndata: ${JSON.stringify({ agentId, at: nowIso() })}\n\n`);

    req.on("close", () => {
      const agentConns = sseClients.get(agentId);
      if (!agentConns) return;
      agentConns.delete(res);
      if (agentConns.size === 0) {
        sseClients.delete(agentId);
      }
    });
  });

  return {
    app,
    closeDb: () => {
      db.close();
    },
  };
}
