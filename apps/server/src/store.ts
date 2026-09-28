import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  type SceneDocument,
  type SceneOperation,
  type Project,
  type SceneRevision,
  type ChatMessage,
  type Attachment,
  validateScene,
  applyOperations,
  operationSchema,
  thumbnail,
} from "../../../packages/domain/src/index";
import { seedScene } from "../../../packages/domain/src/seed";

export class Store {
  db: DatabaseSync;
  root: string;
  constructor(root: string) {
    this.root = root;
    mkdirSync(path.join(root, "attachments"), { recursive: true });
    this.db = new DatabaseSync(path.join(root, "forma.sqlite"));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,head_id TEXT,created_at TEXT NOT NULL,undo TEXT NOT NULL DEFAULT '[]',redo TEXT NOT NULL DEFAULT '[]');
 CREATE TABLE IF NOT EXISTS revisions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),parent_id TEXT,created_at TEXT NOT NULL,summary TEXT NOT NULL,source TEXT NOT NULL,scene TEXT NOT NULL,operations TEXT NOT NULL,thumbnail TEXT);
 CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),role TEXT NOT NULL,text TEXT NOT NULL,attachments TEXT NOT NULL,created_at TEXT NOT NULL,revision_id TEXT);
 CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,mime TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,result TEXT,error TEXT,created_at TEXT NOT NULL);
 INSERT OR IGNORE INTO migrations(version) VALUES(1);`);
    if (
      !(this.db.prepare("PRAGMA table_info(projects)").all() as any[]).some(
        (c) => c.name === "preferences",
      )
    ) {
      this.db.exec(
        "ALTER TABLE projects ADD COLUMN preferences TEXT NOT NULL DEFAULT ''; INSERT OR IGNORE INTO migrations(version) VALUES(2);",
      );
    }
    this.db
      .prepare(
        "UPDATE jobs SET status='failed',error='O serviço foi reiniciado. Sua cena foi preservada; envie o pedido novamente.' WHERE status='running'",
      )
      .run();
    if (!this.db.prepare("SELECT id FROM projects LIMIT 1").get())
      this.create(seedScene());
  }
  transaction<T>(fn: () => T): T {
    if (this.db.isTransaction) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  create(scene: SceneDocument) {
    scene = validateScene(scene);
    const id = randomUUID();
    this.transaction(() => {
      this.db
        .prepare("INSERT INTO projects(id,name,created_at) VALUES(?,?,?)")
        .run(id, scene.name, new Date().toISOString());
      this.insertRevision(id, scene, [], null, "Planta original", "import");
    });
    return this.project(id);
  }
  list() {
    return this.db
      .prepare(
        "SELECT id,name,head_id as headId,created_at as createdAt FROM projects ORDER BY created_at DESC",
      )
      .all();
  }
  project(id: string): Project {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id=?")
      .get(id) as any;
    if (!row) throw new Error("Projeto não encontrado.");
    const rev = this.revision(row.head_id, id);
    return {
      id: row.id,
      name: row.name,
      headId: row.head_id,
      createdAt: row.created_at,
      preferences: row.preferences,
      scene: rev.scene,
    };
  }
  revision(id: string, projectId: string): SceneRevision {
    const r = this.db
      .prepare("SELECT * FROM revisions WHERE id=? AND project_id=?")
      .get(id, projectId) as any;
    if (!r) throw new Error("Versão não encontrada.");
    return {
      id: r.id,
      projectId: r.project_id,
      parentId: r.parent_id,
      createdAt: r.created_at,
      summary: r.summary,
      source: r.source,
      scene: validateScene(JSON.parse(r.scene)),
      operations: JSON.parse(r.operations),
      thumbnail: r.thumbnail,
    };
  }
  revisions(id: string) {
    return this.db
      .prepare(
        "SELECT id,parent_id as parentId,created_at as createdAt,summary,source,thumbnail FROM revisions WHERE project_id=? ORDER BY rowid DESC",
      )
      .all(id);
  }
  insertRevision(
    projectId: string,
    scene: SceneDocument,
    ops: SceneOperation[],
    parentId: string | null,
    summary: string,
    source: SceneRevision["source"],
    createdAt = new Date().toISOString(),
  ) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO revisions VALUES(?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        projectId,
        parentId,
        createdAt,
        summary,
        source,
        JSON.stringify(scene),
        JSON.stringify(ops),
        thumbnail(scene),
      );
    const row = this.db
      .prepare("SELECT undo FROM projects WHERE id=?")
      .get(projectId) as any;
    const undo = JSON.parse(row.undo);
    if (parentId) undo.push(parentId);
    this.db
      .prepare("UPDATE projects SET head_id=?,undo=?,redo=? WHERE id=?")
      .run(id, JSON.stringify(undo), "[]", projectId);
    return id;
  }
  commit(
    projectId: string,
    baseId: string,
    ops: SceneOperation[],
    summary: string,
    source: "manual" | "ai",
    geometry = false,
    roomId?: string,
  ) {
    return this.transaction(() => {
      const p = this.project(projectId);
      if (p.headId !== baseId)
        throw new Error(
          "CONFLICT: a cena mudou durante o pedido. Revise e tente novamente.",
        );
      const scene = applyOperations(p.scene, ops, {
        geometry,
        agent: source === "ai",
        roomId,
      });
      this.insertRevision(projectId, scene, ops, p.headId, summary, source);
      return this.project(projectId);
    });
  }
  restore(projectId: string, revisionId: string, baseId: string) {
    return this.transaction(() => {
      const p = this.project(projectId);
      if (p.headId !== baseId) throw new Error("CONFLICT: a cena mudou.");
      const r = this.revision(revisionId, projectId);
      this.insertRevision(
        projectId,
        r.scene,
        [],
        p.headId,
        `Restaurado: ${r.summary}`,
        "restore",
      );
      return this.project(projectId);
    });
  }
  navigate(projectId: string, direction: "undo" | "redo", baseId: string) {
    return this.transaction(() => {
      const p = this.project(projectId);
      if (p.headId !== baseId) throw new Error("CONFLICT: a cena mudou.");
      const row = this.db
        .prepare("SELECT undo,redo FROM projects WHERE id=?")
        .get(projectId) as any;
      const undo: string[] = JSON.parse(row.undo),
        redo: string[] = JSON.parse(row.redo);
      const from = direction === "undo" ? undo : redo,
        to = direction === "undo" ? redo : undo;
      const id = from.pop();
      if (!id) return p;
      to.push(p.headId);
      this.db
        .prepare("UPDATE projects SET head_id=?,undo=?,redo=? WHERE id=?")
        .run(id, JSON.stringify(undo), JSON.stringify(redo), projectId);
      return this.project(projectId);
    });
  }
  historyState(projectId: string) {
    const r = this.db
      .prepare("SELECT undo,redo FROM projects WHERE id=?")
      .get(projectId) as any;
    return {
      canUndo: JSON.parse(r.undo).length > 0,
      canRedo: JSON.parse(r.redo).length > 0,
    };
  }
  setPreferences(projectId: string, preferences: string) {
    this.project(projectId);
    this.db
      .prepare("UPDATE projects SET preferences=? WHERE id=?")
      .run(preferences, projectId);
  }
  renameRevision(projectId: string, id: string, name: string) {
    this.revision(id, projectId);
    this.db.prepare("UPDATE revisions SET summary=? WHERE id=?").run(name, id);
  }
  messages(projectId: string): ChatMessage[] {
    return this.db
      .prepare(
        "SELECT id,project_id as projectId,role,text,attachments,created_at as createdAt,revision_id as revisionId FROM messages WHERE project_id=? ORDER BY rowid",
      )
      .all(projectId)
      .map((r: any) => ({ ...r, attachments: JSON.parse(r.attachments) }));
  }
  message(
    projectId: string,
    role: ChatMessage["role"],
    text: string,
    attachments: string[] = [],
    revisionId?: string,
  ) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO messages VALUES(?,?,?,?,?,?,?)")
      .run(
        id,
        projectId,
        role,
        text,
        JSON.stringify(attachments),
        new Date().toISOString(),
        revisionId ?? null,
      );
    return id;
  }
  attachments(projectId: string): Attachment[] {
    return this.db
      .prepare(
        "SELECT id,project_id as projectId,name,mime,created_at as createdAt FROM attachments WHERE project_id=? ORDER BY rowid DESC",
      )
      .all(projectId) as Attachment[];
  }
  asset(id: string, projectId?: string) {
    if (!/^[\w-]+$/.test(id)) throw new Error("Arquivo inválido.");
    const r = this.db
      .prepare("SELECT * FROM attachments WHERE id=?")
      .get(id) as any;
    if (!r || (projectId && r.project_id !== projectId))
      throw new Error("Arquivo não encontrado neste projeto.");
    return { ...r, path: path.join(this.root, "attachments", id) };
  }
  addAsset(projectId: string, name: string, mime: string, base64: string) {
    this.project(projectId);
    if (!["image/png", "image/jpeg", "application/pdf"].includes(mime))
      throw new Error("Use PNG, JPEG ou PDF.");
    const data = Buffer.from(base64, "base64");
    if (data.length > 20 * 1024 * 1024)
      throw new Error("Arquivo maior que 20 MB.");
    const valid =
      mime === "image/png"
        ? data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === "image/jpeg"
          ? data[0] === 255 && data[1] === 216
          : data.subarray(0, 5).toString() === "%PDF-";
    if (!valid)
      throw new Error("O conteúdo não corresponde ao formato informado.");
    const id = randomUUID();
    writeFileSync(path.join(this.root, "attachments", id), data);
    this.db
      .prepare("INSERT INTO attachments VALUES(?,?,?,?,?)")
      .run(id, projectId, name.slice(0, 180), mime, new Date().toISOString());
    return this.attachments(projectId).find((a) => a.id === id)!;
  }
  export(projectId: string) {
    const p = this.project(projectId);
    return {
      format: "forma-project",
      version: 1,
      project: p,
      revisions: this.revisions(projectId).map((r: any) =>
        this.revision(r.id, projectId),
      ),
      messages: this.messages(projectId),
      attachments: this.attachments(projectId).map((a) => ({
        ...a,
        base64: readFileSync(this.asset(a.id).path).toString("base64"),
      })),
    };
  }
  import(input: unknown) {
    const bundle = z
      .object({
        format: z.literal("forma-project"),
        version: z.literal(1),
        project: z.object({
          name: z.string().min(1).max(140),
          headId: z.string(),
          scene: z.unknown(),
          preferences: z.string().max(5000).optional(),
        }),
        revisions: z
          .array(
            z.object({
              id: z.string(),
              parentId: z.string().nullable(),
              createdAt: z.string().datetime(),
              summary: z.string().min(1).max(160),
              source: z.enum(["manual", "ai", "restore", "import"]),
              scene: z.unknown(),
              operations: z.array(z.unknown()).max(200),
            }),
          )
          .min(1)
          .max(2000),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              text: z.string().max(200000),
              attachments: z.array(z.string()).max(8),
              createdAt: z.string().datetime(),
              revisionId: z.string().nullable().optional(),
            }),
          )
          .max(20000)
          .default([]),
        attachments: z
          .array(
            z.object({
              id: z.string(),
              name: z.string().max(180),
              mime: z.enum(["image/png", "image/jpeg", "application/pdf"]),
              base64: z.string().max(28 * 1024 * 1024),
            }),
          )
          .max(200),
      })
      .parse(input);
    if (
      bundle?.format !== "forma-project" ||
      bundle?.version !== 1 ||
      !Array.isArray(bundle.revisions) ||
      bundle.revisions.length > 2000 ||
      !Array.isArray(bundle.attachments) ||
      bundle.attachments.length > 200
    )
      throw new Error("Arquivo de projeto inválido.");
    validateScene(bundle.project.scene);
    for (const r of bundle.revisions) validateScene(r.scene);
    const sourceScene = validateScene(bundle.project.scene);
    const ids = new Set(bundle.revisions.map((r) => r.id));
    if (ids.size !== bundle.revisions.length || !ids.has(bundle.project.headId))
      throw new Error("Histórico de versões inválido.");
    const assetIds = new Set(bundle.attachments.map((a) => a.id));
    if (assetIds.size !== bundle.attachments.length)
      throw new Error("Referências duplicadas.");
    for (const r of bundle.revisions) {
      if (r.parentId && !ids.has(r.parentId))
        throw new Error("Versão de origem ausente.");
      const s = validateScene(r.scene);
      if (s.source.imageId && !assetIds.has(s.source.imageId))
        throw new Error("Imagem da planta ausente.");
    }
    return this.transaction(() => {
      const p = this.create({
        ...sourceScene,
        name: `${bundle.project.name} · importado`,
      });
      this.setPreferences(
        p.id,
        String(bundle.project.preferences || "").slice(0, 5000),
      );
      const assets = new Map<string, string>();
      for (const a of bundle.attachments)
        assets.set(a.id, this.addAsset(p.id, a.name, a.mime, a.base64).id);
      const revs = new Map<string, string>();
      this.transaction(() => {
        for (const r of [...bundle.revisions].reverse()) {
          if (r.parentId && !revs.has(r.parentId))
            throw new Error("Ordem ou ancestralidade das versões inválida.");
          const scene = validateScene(r.scene);
          if (scene.source.imageId)
            scene.source.imageId = assets.get(scene.source.imageId);
          const next = this.insertRevision(
            p.id,
            scene,
            z.array(operationSchema).parse(r.operations),
            r.parentId ? revs.get(r.parentId) || null : null,
            r.summary,
            r.source,
            r.createdAt,
          );
          revs.set(r.id, next);
        }
        const head = revs.get(bundle.project.headId);
        if (head)
          this.db
            .prepare("UPDATE projects SET head_id=?,undo=?,redo=? WHERE id=?")
            .run(head, "[]", "[]", p.id);
        this.db
          .prepare("DELETE FROM revisions WHERE id=? AND project_id=?")
          .run(p.headId, p.id);
        for (const m of bundle.messages || []) {
          const messageId = this.message(
            p.id,
            m.role,
            m.text,
            (m.attachments || [])
              .map((id: string) => assets.get(id))
              .filter((id): id is string => !!id),
            m.revisionId ? revs.get(m.revisionId) : undefined,
          );
          this.db
            .prepare("UPDATE messages SET created_at=? WHERE id=?")
            .run(m.createdAt, messageId);
        }
      });
      return this.project(p.id);
    });
  }
  job(projectId: string, kind: string, payload: unknown) {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO jobs(id,project_id,kind,status,payload,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        id,
        projectId,
        kind,
        "queued",
        JSON.stringify(payload),
        new Date().toISOString(),
      );
    return id;
  }
  jobs(projectId?: string) {
    return this.db
      .prepare(
        `SELECT * FROM jobs ${projectId ? "WHERE project_id=?" : ""} ORDER BY rowid DESC`,
      )
      .all(...(projectId ? [projectId] : []))
      .map((j: any) => ({
        ...j,
        payload: JSON.parse(j.payload),
        result: j.result ? JSON.parse(j.result) : null,
      }));
  }
  updateJob(
    id: string,
    status: string,
    result: unknown = null,
    error: string | null = null,
  ) {
    this.db
      .prepare("UPDATE jobs SET status=?,result=?,error=? WHERE id=?")
      .run(status, result ? JSON.stringify(result) : null, error, id);
  }
  close() {
    this.db.close();
  }
}
