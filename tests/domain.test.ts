import test from "node:test";
import assert from "node:assert/strict";
import { seedScene } from "../packages/domain/src/seed";
import {
  applyOperations,
  validateScene,
  placementWarnings,
  createObject,
  catalog,
  thumbnail,
  type SceneOperation,
} from "../packages/domain/src/index";

test("materiais por parte correspondem à renderização e rejeitam nomes desconhecidos", () => {
  const scene = seedScene();
  const bed = scene.objects.find((o) => o.kind === "bed")!;
  const material = {
    color: "#587b98",
    finish: "fabric" as const,
    roughness: 0.9,
  };
  const next = applyOperations(
    scene,
    [
      {
        type: "update_object",
        id: bed.id,
        changes: { parts: { blanket: material, pillows: material } },
      },
    ],
    { agent: true },
  );
  assert.deepEqual(next.objects.find((o) => o.id === bed.id)!.parts, {
    accent: material,
    bedding: material,
  });
  assert.throws(
    () =>
      applyOperations(
        scene,
        [
          {
            type: "update_object",
            id: bed.id,
            changes: { parts: { unsupported: material } },
          },
        ],
        { agent: true },
      ),
    /Parte desconhecida/,
  );
  assert.deepEqual(scene.objects.find((o) => o.id === bed.id)!.parts, {});
});

test("HM Ponta tem dois dormitórios, alturas e aberturas válidas", () => {
  const s = seedScene();
  assert.equal(s.source.area, 36.15);
  assert.equal(s.rooms.filter((r) => r.id.startsWith("bedroom")).length, 2);
  assert.equal(s.rooms.find((r) => r.id === "bath")!.height, 2.35);
  assert.equal(s.rooms.find((r) => r.id === "living")!.height, 2.6);
  assert.equal(validateScene(s).schemaVersion, 1);
  assert.equal(s.source.confidence, "estimated");
});
test("operações são atômicas e não alteram a cena original", () => {
  const s = seedScene();
  const original = JSON.stringify(s);
  assert.throws(() =>
    applyOperations(s, [
      { type: "update_object", id: s.objects[0].id, changes: { name: "Novo" } },
      { type: "update_object", id: "inexistente", changes: { name: "Falha" } },
    ]),
  );
  assert.equal(JSON.stringify(s), original);
});
test("IA respeita objetos bloqueados, estrutura e seleção de cômodo", () => {
  const s = seedScene();
  const locked = s.objects.find((o) => o.locked)!;
  assert.throws(() =>
    applyOperations(
      s,
      [{ type: "update_object", id: locked.id, changes: { locked: false } }],
      { agent: true },
    ),
  );
  assert.throws(() =>
    applyOperations(s, [{ type: "remove_wall", id: s.walls[0].id }], {
      agent: true,
      geometry: true,
    }),
  );
  const bed = s.objects.find((o) => o.kind === "bed")!;
  assert.throws(() =>
    applyOperations(s, [{ type: "remove_object", id: bed.id }], {
      agent: true,
      roomId: "living",
    }),
  );
  assert.throws(() =>
    applyOperations(s, [{ type: "apply_style", style: "japandi" }], {
      agent: true,
      roomId: "living",
    }),
  );
});
test("estilo por cômodo mantém outros ambientes e instalações", () => {
  const s = seedScene();
  const next = applyOperations(
    s,
    [{ type: "apply_style", style: "industrial", roomId: "living" }],
    { agent: true, roomId: "living" },
  );
  assert.notDeepEqual(
    next.rooms.find((r) => r.id === "living"),
    s.rooms.find((r) => r.id === "living"),
  );
  assert.deepEqual(
    next.objects.filter((o) => o.roomId !== "living"),
    s.objects.filter((o) => o.roomId !== "living"),
  );
  assert.deepEqual(next.walls, s.walls);
});
test("validação rejeita IDs repetidos, dimensões inválidas e aberturas fora da parede", () => {
  const s = seedScene();
  assert.throws(() =>
    validateScene({ ...s, objects: [...s.objects, s.objects[0]] }),
  );
  assert.throws(() =>
    applyOperations(s, [
      {
        type: "update_object",
        id: s.objects[0].id,
        changes: { dimensions: [-1, 1, 1] },
      },
    ]),
  );
  assert.throws(() =>
    validateScene({ ...s, openings: [{ ...s.openings[0], width: 99 }] }),
  );
});
test("mudança do sofá preserva geometria e usa a cor pedida", () => {
  const s = seedScene();
  const sofa = s.objects.find((o) => o.kind === "sofa")!;
  const next = applyOperations(
    s,
    [
      {
        type: "update_object",
        id: sofa.id,
        changes: { material: { ...sofa.material, color: "#c8b89c" } },
      },
    ],
    { agent: true },
  );
  assert.equal(
    next.objects.find((o) => o.id === sofa.id)!.material.color,
    "#c8b89c",
  );
  assert.deepEqual(next.walls, s.walls);
  assert.deepEqual(next.rooms, s.rooms);
});
test("calibração escala planta, posições e aberturas sem redimensionar móveis reais", () => {
  const s = seedScene();
  const n = applyOperations(s, [{ type: "calibrate", factor: 1.1 }], {
    geometry: true,
  });
  assert.equal(n.rooms[0].width, s.rooms[0].width * 1.1);
  assert.deepEqual(n.objects[0].dimensions, s.objects[0].dimensions);
  assert.equal(n.openings[0].offset, s.openings[0].offset * 1.1);
  assert.equal(n.source.confidence, "calibrated");
});
test("geração e validação aceitam outra topologia independente da HM", () => {
  const s = seedScene();
  const other = validateScene({
    ...s,
    name: "Estúdio teste",
    rooms: [
      { ...s.rooms[0], id: "studio", name: "Estúdio", width: 4, depth: 5 },
    ],
    walls: [{ ...s.walls[0], id: "w1", start: [0, 0], end: [4, 0] }],
    objects: [],
    openings: [],
  });
  const object = createObject(catalog[0], other.rooms[0]);
  assert.equal(
    applyOperations(other, [{ type: "add_object", object }]).objects.length,
    1,
  );
  assert.equal(other.rooms.length, 1);
  assert.match(thumbnail(other), /^data:image\/svg\+xml,/);
});
