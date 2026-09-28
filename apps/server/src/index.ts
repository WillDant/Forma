import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { randomBytes } from "node:crypto";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Store } from "./store";
import { CodexAgent, type DesignAgent, friendlyAgentError } from "./agent";
import {
  sceneSchema,
  operationSchema,
  validateScene,
} from "../../../packages/domain/src/index";

export function createServer(
  options: { dataDir?: string; agent?: DesignAgent; port?: number } = {},
) {
  const root = path.resolve(
    options.dataDir || process.env.FORMA_DATA_DIR || "data",
  );
  const store = new Store(root);
  const agent = options.agent || new CodexAgent(root);
  const app = Fastify({ logger: false, bodyLimit: 80 * 1024 * 1024 });
  const port = Number(options.port || process.env.PORT || 4310);
  const session = randomBytes(32).toString("hex");
  const clients = new Set<any>();
  const active = new Map<string, AbortController>();
  let draining = false;
  let stopping = false;
  const drainWaiters: (() => void)[] = [];
  function broadcast(type: string, payload: any) {
    for (const res of clients)
      res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
  }
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (
      origin &&
      ![
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        `http://127.0.0.1:${port}`,
        `http://localhost:${port}`,
      ].includes(origin)
    )
      return reply.code(403).send({ error: "Origem não autorizada." });
    if (
      !["127.0.0.1", "localhost"].includes(
        (req.headers.host || "").split(":")[0],
      )
    )
      return reply.code(403).send({ error: "Host não autorizado." });
    if (
      req.url.startsWith("/api") &&
      !req.url.startsWith("/api/session") &&
      !req.url.startsWith("/api/events") &&
      !req.url.match(/^\/api\/assets\/[\w-]+$/) &&
      req.headers["x-forma-session"] !== session
    )
      return reply
        .code(401)
        .send({ error: "Sessão expirada. Recarregue a página." });
  });
  app.setErrorHandler((e: any, _req, reply) =>
    reply
      .code(e.message?.startsWith("CONFLICT") ? 409 : e.statusCode || 400)
      .send({
        error:
          e instanceof z.ZodError
            ? "Dados inválidos: " +
              e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(";")
            : e.message || "Não foi possível concluir.",
      }),
  );
  app.get("/api/session", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return { token: session };
  });
  app.get("/api/events", async (req, reply) => {
    if ((req.query as any).token !== session) return reply.code(401).send();
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write(": connected\n\n");
    clients.add(reply.raw);
    const ping = setInterval(() => reply.raw.write(": ping\n\n"), 20000);
    req.raw.on("close", () => {
      clearInterval(ping);
      clients.delete(reply.raw);
    });
  });
  app.get("/api/projects", async () => store.list());
  app.get("/api/projects/:id", async (req) => {
    const id = (req.params as any).id;
    return {
      project: store.project(id),
      revisions: store.revisions(id),
      messages: store.messages(id),
      attachments: store.attachments(id),
      jobs: store.jobs(id).map(({ payload, ...j }) => ({
        ...j,
        error: j.error ? friendlyAgentError(j.error) : null,
      })),
      ...store.historyState(id),
    };
  });
  app.patch("/api/projects/:id/preferences", async (req) => {
    const b = z.object({ preferences: z.string().max(5000) }).parse(req.body);
    store.setPreferences((req.params as any).id, b.preferences);
    return { ok: true };
  });
  app.post("/api/projects", async (req) => {
    const scene = sceneSchema.parse((req.body as any).scene);
    return store.create(scene);
  });
  app.post("/api/projects/:id/operations", async (req) => {
    const b = z
      .object({
        baseId: z.string(),
        operations: z.array(operationSchema).min(1).max(200),
        summary: z.string().min(1).max(160),
        geometry: z.boolean().optional(),
      })
      .parse(req.body);
    const p = store.commit(
      (req.params as any).id,
      b.baseId,
      b.operations,
      b.summary,
      "manual",
      b.geometry,
    );
    broadcast("scene", { projectId: p.id });
    return p;
  });
  app.get("/api/projects/:id/revisions/:revisionId", async (req) => {
    const p = req.params as any;
    return store.revision(p.revisionId, p.id);
  });
  app.post("/api/projects/:id/restore", async (req) => {
    const b = z
      .object({ revisionId: z.string(), baseId: z.string() })
      .parse(req.body);
    const p = store.restore((req.params as any).id, b.revisionId, b.baseId);
    broadcast("scene", { projectId: p.id });
    return p;
  });
  app.post("/api/projects/:id/history", async (req) => {
    const b = z
      .object({ direction: z.enum(["undo", "redo"]), baseId: z.string() })
      .parse(req.body);
    const p = store.navigate((req.params as any).id, b.direction, b.baseId);
    broadcast("scene", { projectId: p.id });
    return p;
  });
  app.patch("/api/projects/:id/revisions/:revisionId", async (req) => {
    const p = req.params as any;
    store.renameRevision(
      p.id,
      p.revisionId,
      z.object({ name: z.string().min(1).max(160) }).parse(req.body).name,
    );
    return { ok: true };
  });
  app.post("/api/projects/:id/assets", async (req) => {
    const b = z
      .object({
        name: z.string().max(180),
        mime: z.string(),
        base64: z.string().max(28 * 1024 * 1024),
      })
      .parse(req.body);
    return store.addAsset((req.params as any).id, b.name, b.mime, b.base64);
  });
  app.get("/api/assets/:id", async (req, reply) => {
    if (
      !req.headers.cookie
        ?.split(";")
        .some((c) => c.trim() === `forma_session=${session}`)
    )
      return reply.code(401).send({ error: "Sessão expirada." });
    const a = store.asset((req.params as any).id);
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "private, max-age=3600")
      .type(a.mime);
    return readFileSync(a.path);
  });
  app.post("/api/cookie", async (_req, reply) => {
    reply.header(
      "Set-Cookie",
      `forma_session=${session}; Path=/; HttpOnly; SameSite=Strict`,
    );
    return { ok: true };
  });
  app.get("/api/projects/:id/export", async (req) =>
    store.export((req.params as any).id),
  );
  app.post("/api/import", async (req) => store.import(req.body));
  app.get("/api/agent/status", async () => {
    try {
      return await agent.status();
    } catch (e: any) {
      return { connected: false, error: e.message };
    }
  });
  app.get("/api/agent/models", async () => agent.models());
  app.post("/api/agent/login", async () => agent.login());
  agent.events?.on("account", () => broadcast("account", {}));
  app.post("/api/projects/:id/chat", async (req) => {
    const p = store.project((req.params as any).id);
    const b = z
      .object({
        prompt: z.string().min(1).max(12000),
        model: z.string().min(1),
        baseId: z.string(),
        roomId: z.string().optional(),
        selectedId: z.string().optional(),
        attachments: z.array(z.string()).max(8).default([]),
        screenshot: z
          .string()
          .max(4 * 1024 * 1024)
          .optional(),
        kind: z.enum(["design", "floorplan"]).default("design"),
      })
      .parse(req.body);
    if (p.headId !== b.baseId) throw new Error("CONFLICT: a cena mudou.");
    for (const id of b.attachments) {
      if (store.asset(id, p.id).mime === "application/pdf")
        throw new Error(
          "Selecione e recorte uma página do PDF antes de enviar à IA.",
        );
    }
    if (b.roomId && !p.scene.rooms.some((r) => r.id === b.roomId))
      throw new Error("Cômodo inválido.");
    if (b.selectedId && !p.scene.objects.some((o) => o.id === b.selectedId))
      throw new Error("Objeto inválido.");
    const models = await agent.models();
    if (!models.some((m) => m.model === b.model))
      throw new Error(
        "Modelo indisponível nesta conta. Escolha outro no seletor.",
      );
    store.message(
      p.id,
      "user",
      b.kind === "floorplan"
        ? "Importar a planta anexada e preparar a geometria para revisão."
        : b.prompt,
      b.attachments,
      p.headId,
    );
    const id = store.job(p.id, b.kind, b);
    void drain();
    return { id };
  });
  app.post("/api/jobs/:id/cancel", async (req) => {
    const id = (req.params as any).id;
    const job = store.jobs().find((j) => j.id === id);
    if (job && ["queued", "running"].includes(job.status)) {
      store.updateJob(id, "cancelled", null, "Cancelado pelo usuário.");
      active.get(id)?.abort();
      broadcast("job", { id, projectId: job.project_id, status: "cancelled" });
    }
    return { ok: true };
  });
  app.post("/api/jobs/:id/accept", async (req) => {
    const j = store.jobs().find((j) => j.id === (req.params as any).id);
    if (!j || j.kind !== "floorplan" || j.status !== "completed")
      throw new Error("Planta ainda não disponível.");
    const scene = validateScene((req.body as any).scene);
    if (scene.source.imageId) store.asset(scene.source.imageId, j.project_id);
    const created = store.create(scene);
    if (scene.source.imageId) {
      const old = store.asset(scene.source.imageId, j.project_id);
      const a = store.addAsset(
        created.id,
        old.name,
        old.mime,
        readFileSync(old.path).toString("base64"),
      );
      const updated = { ...scene, source: { ...scene.source, imageId: a.id } };
      store.transaction(() =>
        store.insertRevision(
          created.id,
          updated,
          [],
          created.headId,
          "Planta revisada",
          "import",
        ),
      );
    }
    return store.project(created.id);
  });
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      let j: any;
      while (
        !stopping &&
        (j = store
          .jobs()
          .reverse()
          .find((j) => j.status === "queued"))
      ) {
        const ctrl = new AbortController();
        active.set(j.id, ctrl);
        store.updateJob(j.id, "running");
        broadcast("job", {
          id: j.id,
          projectId: j.project_id,
          status: "running",
        });
        let capture: string | undefined;
        try {
          const p = store.project(j.project_id);
          if (p.headId !== j.payload.baseId)
            throw new Error(
              "CONFLICT: a cena mudou após o envio. Envie o pedido novamente.",
            );
          const images = j.payload.attachments.map(
            (id: string) => store.asset(id, p.id).path,
          );
          if (j.payload.screenshot) {
            const b64 = j.payload.screenshot.replace(
              /^data:image\/png;base64,/,
              "",
            );
            const b = Buffer.from(b64, "base64");
            if (b[0] === 137 && b.subarray(1, 4).toString() === "PNG") {
              capture = path.join(root, "attachments", `capture-${j.id}.png`);
              writeFileSync(capture, b);
              images.push(capture);
            }
          }
          const history =
            "PREFERÊNCIAS SALVAS: " +
            (p.preferences || "Nenhuma") +
            "\nCONVERSA RELACIONADA À VERSÃO ATUAL: " +
            store
              .messages(p.id)
              .filter((m) => m.revisionId === p.headId)
              .slice(-8)
              .map((m) => `${m.role}: ${m.text}`)
              .join("\n");
          const result = await agent.run({
            scene: p.scene,
            prompt: j.payload.prompt,
            model: j.payload.model,
            roomId: j.payload.roomId,
            selectedId: j.payload.selectedId,
            images,
            history,
            kind: j.kind,
            signal: ctrl.signal,
            progress: (text) =>
              broadcast("progress", { id: j.id, projectId: p.id, text }),
          });
          if (ctrl.signal.aborted) throw new Error("Cancelado.");
          let head = p.headId;
          if (j.kind === "design" && result.operations.length) {
            const next = store.commit(
              p.id,
              j.payload.baseId,
              result.operations,
              j.payload.prompt.slice(0, 100),
              "ai",
              false,
              j.payload.roomId,
            );
            head = next.headId;
            broadcast("scene", { projectId: p.id });
          }
          if (result.scene && j.payload.attachments[0])
            result.scene.source.imageId = j.payload.attachments[0];
          store.message(p.id, "assistant", result.text, [], head);
          store.updateJob(j.id, "completed", result);
          broadcast("job", { id: j.id, projectId: p.id, status: "completed" });
        } catch (e: any) {
          if (!ctrl.signal.aborted)
            store.updateJob(j.id, "failed", null, e.message);
          broadcast("job", {
            id: j.id,
            projectId: j.project_id,
            status: ctrl.signal.aborted ? "cancelled" : "failed",
            error: e.message,
          });
        } finally {
          active.delete(j.id);
          if (capture && existsSync(capture)) unlinkSync(capture);
        }
      }
    } finally {
      draining = false;
      drainWaiters.splice(0).forEach((resolve) => resolve());
    }
  }
  if (existsSync(path.resolve("dist/index.html"))) {
    void app.register(fastifyStatic, { root: path.resolve("dist") });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api")
        ? reply.code(404).send({ error: "Rota não encontrada." })
        : reply.sendFile("index.html"),
    );
  }
  const close = async () => {
    stopping = true;
    for (const c of active.values()) c.abort();
    agent.close?.();
    if (draining)
      await new Promise<void>((resolve) => drainWaiters.push(resolve));
    for (const c of clients) c.end();
    await app.close();
    store.close();
  };
  return { app, store, agent, drain, close, port };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  const server = createServer();
  await server.app.listen({ host: "127.0.0.1", port: server.port });
  console.log(`Forma · servidor local em http://127.0.0.1:${server.port}`);
  void server.drain();
  const stop = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
