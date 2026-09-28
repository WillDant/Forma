import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "../apps/server/src/index";
import type { DesignAgent } from "../apps/server/src/agent";
import { seedScene } from "../packages/domain/src/seed";

class TestAgent implements DesignAgent {
  mode: "success" | "failure" | "delay" = "success";
  async status() {
    return { connected: true, account: { type: "chatgpt", planType: "test" } };
  }
  async models() {
    return [{ model: "test-model", displayName: "Provedor de teste" }];
  }
  async login() {
    return { authUrl: "https://example.invalid/test-only" };
  }
  async run(
    input: Parameters<DesignAgent["run"]>[0],
  ): ReturnType<DesignAgent["run"]> {
    if (this.mode === "failure")
      throw new Error("Your workspace is out of credits.");
    if (this.mode === "delay")
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 100);
        input.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            reject(new Error("Cancelado"));
          },
          { once: true },
        );
      });
    if (input.kind === "floorplan") {
      const base = seedScene();
      return {
        text: "Planta de teste interpretada.",
        operations: [],
        scene: {
          ...base,
          name: "Estúdio 20 m²",
          source: {
            label: "Planta de teste",
            area: 20,
            confidence: "estimated",
            note: "Fixture para integração; não é análise real de IA.",
          },
          rooms: [
            {
              ...base.rooms[0],
              id: "studio",
              name: "Estúdio",
              width: 4,
              depth: 5,
            },
          ],
          walls: [
            { ...base.walls[0], id: "studio-n", start: [0, 0], end: [4, 0] },
            { ...base.walls[0], id: "studio-s", start: [0, 5], end: [4, 5] },
          ],
          openings: [],
          objects: [],
        },
      };
    }
    const sofa = input.scene.objects.find((o) => o.kind === "sofa")!;
    return {
      text: "Sofá atualizado pelo provedor de teste.",
      operations: [
        {
          type: "update_object",
          id: sofa.id,
          changes: { material: { ...sofa.material, color: "#c8b89c" } },
        },
      ],
    };
  }
}
async function setup() {
  const root = mkdtempSync(path.join(tmpdir(), "forma-http-"));
  const agent = new TestAgent();
  const server = createServer({ dataDir: root, agent });
  await server.app.ready();
  const token = (
    await server.app.inject({ method: "GET", url: "/api/session" })
  ).json().token;
  const request = (
    method: any,
    url: string,
    payload?: any,
    headers: any = {},
  ) =>
    server.app.inject({
      method,
      url,
      payload,
      headers: { "x-forma-session": token, ...headers },
    });
  const project = server.store.project((server.store.list()[0] as any).id);
  const close = async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  };
  return { ...server, request, project, close, testAgent: agent };
}
async function waitJob(store: any, id: string) {
  for (let i = 0; i < 100; i++) {
    const job = store.jobs().find((j: any) => j.id === id);
    if (!["queued", "running"].includes(job.status)) return job;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("O trabalho de teste não terminou.");
}
test("HTTP exige sessão e rejeita origem e host externos", async () => {
  const t = await setup();
  try {
    assert.equal(
      (await t.app.inject({ method: "GET", url: "/api/projects" })).statusCode,
      401,
    );
    assert.equal(
      (
        await t.request("GET", "/api/projects", undefined, {
          origin: "https://externo.invalid",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await t.request("GET", "/api/projects", undefined, {
          host: "externo.invalid",
        })
      ).statusCode,
      403,
    );
    assert.equal((await t.request("GET", "/api/projects")).statusCode, 200);
  } finally {
    await t.close();
  }
});
test("chat aplica operações e cria uma única revisão, sem alterar paredes", async () => {
  const t = await setup();
  try {
    const r = await t.request("POST", `/api/projects/${t.project.id}/chat`, {
      prompt: "Sofá bege",
      model: "test-model",
      baseId: t.project.headId,
    });
    assert.equal(r.statusCode, 200);
    const job = await waitJob(t.store, r.json().id);
    assert.equal(job.status, "completed");
    const p = t.store.project(t.project.id);
    assert.equal(
      p.scene.objects.find((o) => o.kind === "sofa")!.material.color,
      "#c8b89c",
    );
    assert.deepEqual(p.scene.walls, t.project.scene.walls);
    assert.equal(t.store.revisions(p.id).length, 2);
    assert.equal(t.store.messages(p.id).length, 2);
  } finally {
    await t.close();
  }
});
test("indisponibilidade do provedor preserva cena e explica créditos", async () => {
  const t = await setup();
  try {
    t.testAgent.mode = "failure";
    const r = await t.request("POST", `/api/projects/${t.project.id}/chat`, {
      prompt: "Teste",
      model: "test-model",
      baseId: t.project.headId,
    });
    await waitJob(t.store, r.json().id);
    assert.equal(t.store.project(t.project.id).headId, t.project.headId);
    const state = (
      await t.request("GET", `/api/projects/${t.project.id}`)
    ).json();
    assert.match(state.jobs[0].error, /sem créditos/);
  } finally {
    await t.close();
  }
});
test("conflito durante geração rejeita resultado antigo", async () => {
  const t = await setup();
  try {
    t.testAgent.mode = "delay";
    const r = await t.request("POST", `/api/projects/${t.project.id}/chat`, {
      prompt: "Teste",
      model: "test-model",
      baseId: t.project.headId,
    });
    const changed = t.store.commit(
      t.project.id,
      t.project.headId,
      [{ type: "apply_style", style: "japandi" }],
      "Edição simultânea",
      "manual",
    );
    const job = await waitJob(t.store, r.json().id);
    assert.equal(job.status, "failed");
    assert.match(job.error, /CONFLICT/);
    assert.equal(t.store.project(t.project.id).headId, changed.headId);
  } finally {
    await t.close();
  }
});
test("cancelar geração não aplica operações nem cria versão", async () => {
  const t = await setup();
  try {
    t.testAgent.mode = "delay";
    const r = await t.request("POST", `/api/projects/${t.project.id}/chat`, {
      prompt: "Teste",
      model: "test-model",
      baseId: t.project.headId,
    });
    await t.request("POST", `/api/jobs/${r.json().id}/cancel`, {});
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(t.store.project(t.project.id).headId, t.project.headId);
    assert.equal(t.store.jobs()[0].status, "cancelled");
  } finally {
    await t.close();
  }
});
test("importação de imagem gera outra topologia, revisável antes de criar projeto", async () => {
  const t = await setup();
  try {
    const upload = await t.request(
      "POST",
      `/api/projects/${t.project.id}/assets`,
      {
        name: "studio.png",
        mime: "image/png",
        base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6QAAAABJRU5ErkJggg==",
      },
    );
    assert.equal(upload.statusCode, 200);
    const r = await t.request("POST", `/api/projects/${t.project.id}/chat`, {
      prompt: "Importar estúdio",
      model: "test-model",
      baseId: t.project.headId,
      attachments: [upload.json().id],
      kind: "floorplan",
    });
    const job = await waitJob(t.store, r.json().id);
    assert.equal(job.status, "completed");
    assert.equal(t.store.list().length, 1);
    const accepted = await t.request("POST", `/api/jobs/${job.id}/accept`, {
      scene: job.result.scene,
    });
    assert.equal(accepted.statusCode, 200);
    const p = accepted.json();
    assert.equal(p.scene.rooms.length, 1);
    assert.equal(p.scene.rooms[0].width, 4);
    assert.equal(t.store.list().length, 2);
    assert.notEqual(p.scene.source.imageId, upload.json().id);
    assert.equal(t.store.attachments(p.id).length, 1);
  } finally {
    await t.close();
  }
});
test("modelo inexistente não gera chamada nem mensagem", async () => {
  const t = await setup();
  try {
    const r = await t.request("POST", `/api/projects/${t.project.id}/chat`, {
      prompt: "Teste",
      model: "inventado",
      baseId: t.project.headId,
    });
    assert.equal(r.statusCode, 400);
    assert.equal(t.store.messages(t.project.id).length, 0);
  } finally {
    await t.close();
  }
});
