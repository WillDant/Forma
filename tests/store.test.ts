import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../apps/server/src/store";
const setup = () => {
  const root = mkdtempSync(path.join(tmpdir(), "forma-test-"));
  const store = new Store(root);
  return {
    store,
    root,
    close: () => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
};
test("histórico: editar, desfazer, refazer, restaurar e ramificar mantém versões", () => {
  const { store, close } = setup();
  try {
    const p = store.project((store.list()[0] as any).id);
    const a = store.commit(
      p.id,
      p.headId,
      [{ type: "apply_style", style: "japandi" }],
      "Japandi",
      "manual",
    );
    const b = store.commit(
      p.id,
      a.headId,
      [{ type: "apply_style", style: "industrial" }],
      "Industrial",
      "manual",
    );
    const undo = store.navigate(p.id, "undo", b.headId);
    assert.equal(undo.headId, a.headId);
    const redo = store.navigate(p.id, "redo", undo.headId);
    assert.equal(redo.headId, b.headId);
    const restored = store.restore(p.id, p.headId, redo.headId);
    assert.deepEqual(restored.scene, p.scene);
    const branch = store.commit(
      p.id,
      restored.headId,
      [{ type: "apply_style", style: "escandinavo" }],
      "Nova alternativa",
      "manual",
    );
    assert.equal(store.revisions(p.id).length, 5);
    assert.deepEqual(store.revision(b.headId, p.id).scene, b.scene);
    assert.equal(store.historyState(p.id).canRedo, false);
  } finally {
    close();
  }
});
test("conflito não sobrescreve edição mais recente", () => {
  const { store, close } = setup();
  try {
    const p = store.project((store.list()[0] as any).id);
    const n = store.commit(
      p.id,
      p.headId,
      [{ type: "apply_style", style: "japandi" }],
      "Manual",
      "manual",
    );
    assert.throws(
      () =>
        store.commit(
          p.id,
          p.headId,
          [{ type: "apply_style", style: "industrial" }],
          "IA",
          "ai",
        ),
      /CONFLICT/,
    );
    assert.equal(store.project(p.id).headId, n.headId);
  } finally {
    close();
  }
});
test("reinício mantém dados e marca trabalho interrompido sem mudar a cena", () => {
  const { store, root } = setup();
  const p = store.project((store.list()[0] as any).id);
  store.message(p.id, "user", "Teste");
  const job = store.job(p.id, "design", { prompt: "Exemplo" });
  store.updateJob(job, "running");
  store.close();
  const reopened = new Store(root);
  try {
    assert.equal(reopened.project(p.id).headId, p.headId);
    assert.equal(reopened.messages(p.id).length, 1);
    assert.equal(reopened.jobs(p.id)[0].status, "failed");
  } finally {
    reopened.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test("exportar e importar preserva snapshots e conversa", () => {
  const { store, close } = setup();
  try {
    const p = store.project((store.list()[0] as any).id);
    const next = store.commit(
      p.id,
      p.headId,
      [{ type: "apply_style", style: "japandi" }],
      "Minha ideia",
      "manual",
    );
    store.message(p.id, "assistant", "Japandi aplicado.", [], next.headId);
    const copied = store.import(store.export(p.id));
    assert.notEqual(copied.id, p.id);
    assert.deepEqual(copied.scene, next.scene);
    assert.equal(store.messages(copied.id)[0].text, "Japandi aplicado.");
    assert.equal(store.revisions(copied.id).length, 2);
  } finally {
    close();
  }
});
test("anexos não permitem traversal, MIME falso ou acesso entre projetos", () => {
  const { store, close } = setup();
  try {
    const p = store.project((store.list()[0] as any).id);
    assert.throws(() => store.asset("../../etc/passwd"));
    assert.throws(() =>
      store.addAsset(
        p.id,
        "foto.png",
        "image/png",
        Buffer.from("not png").toString("base64"),
      ),
    );
    assert.throws(() => store.revision(p.headId, "outro-projeto"));
  } finally {
    close();
  }
});
