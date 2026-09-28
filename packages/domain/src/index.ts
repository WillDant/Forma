import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().min(1).max(160);
const n = z.number().finite();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const kinds = [
  "sofa",
  "bed",
  "table",
  "chair",
  "wardrobe",
  "cabinet",
  "counter",
  "fridge",
  "stove",
  "washer",
  "sink",
  "toilet",
  "shower",
  "rug",
  "plant",
  "lamp",
  "curtain",
  "art",
  "tv",
  "shelf",
] as const;
export const materialSchema = z
  .object({
    color,
    finish: z.enum(["matte", "wood", "fabric", "metal", "ceramic", "glass"]),
    roughness: n.min(0).max(1),
  })
  .strict();
export const materialPartNames = [
  "frame",
  "legs",
  "accent",
  "fabric",
  "bedding",
  "detail",
  "top",
] as const;
const materialPartsSchema = z.record(materialSchema).transform((parts, ctx) => {
  const result: Record<string, z.infer<typeof materialSchema>> = {};
  const aliases: Record<string, string> = {
    blanket: "accent",
    pillows: "bedding",
  };
  for (const [name, material] of Object.entries(parts)) {
    const key = aliases[name] || name;
    if (!(materialPartNames as readonly string[]).includes(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Parte desconhecida: ${name}. Use ${materialPartNames.join(", ")}.`,
      });
    } else result[key] = material;
  }
  return result;
});
export const roomSchema = z
  .object({
    id,
    name: text,
    x: n,
    z: n,
    width: n.positive().max(100),
    depth: n.positive().max(100),
    height: n.min(1.5).max(8),
    floor: materialSchema,
    wallColor: color,
  })
  .strict();
export const wallSchema = z
  .object({
    id,
    start: z.tuple([n, n]),
    end: z.tuple([n, n]),
    height: n.min(1.5).max(8),
    thickness: n.min(0.03).max(0.6),
    color,
    structural: z.boolean(),
  })
  .strict();
export const openingSchema = z
  .object({
    id,
    wallId: id,
    kind: z.enum(["door", "window"]),
    offset: n.min(0),
    width: n.min(0.2).max(8),
    height: n.min(0.2).max(5),
    sill: n.min(0).max(3),
  })
  .strict();
export const objectSchema = z
  .object({
    id,
    name: text,
    kind: z.enum(kinds),
    roomId: id,
    position: z.tuple([n, n, n]),
    rotation: n,
    dimensions: z.tuple([
      n.min(0.02).max(20),
      n.min(0.005).max(10),
      n.min(0.02).max(20),
    ]),
    material: materialSchema,
    parts: materialPartsSchema.default({}),
    locked: z.boolean().default(false),
  })
  .strict();
export const sceneSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: text,
    source: z
      .object({
        label: text,
        area: n.positive(),
        confidence: z.enum(["estimated", "calibrated"]),
        note: z.string().max(2000),
        imageId: id.optional(),
      })
      .strict(),
    rooms: z.array(roomSchema).min(1).max(100),
    walls: z.array(wallSchema).max(300),
    openings: z.array(openingSchema).max(200),
    objects: z.array(objectSchema).max(1000),
    lighting: z
      .object({
        intensity: n.min(0.1).max(3),
        warmth: n.min(2000).max(8000),
        time: z.enum(["day", "evening"]),
      })
      .strict(),
  })
  .strict();
export type SceneDocument = z.infer<typeof sceneSchema>;
export type SceneObject = z.infer<typeof objectSchema>;
export type Material = z.infer<typeof materialSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Wall = z.infer<typeof wallSchema>;
export type Opening = z.infer<typeof openingSchema>;
export const styleNames = [
  "neutro",
  "contemporâneo",
  "escandinavo",
  "industrial",
  "japandi",
] as const;
export type Style = (typeof styleNames)[number];
export const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_object"), object: objectSchema }).strict(),
  z
    .object({
      type: z.literal("update_object"),
      id,
      changes: objectSchema.omit({ id: true }).partial(),
    })
    .strict(),
  z.object({ type: z.literal("remove_object"), id }).strict(),
  z
    .object({
      type: z.literal("set_room"),
      id,
      changes: roomSchema.omit({ id: true }).partial(),
    })
    .strict(),
  z
    .object({
      type: z.literal("set_lighting"),
      lighting: sceneSchema.shape.lighting,
    })
    .strict(),
  z
    .object({
      type: z.literal("apply_style"),
      style: z.enum(styleNames),
      roomId: id.optional(),
    })
    .strict(),
  z.object({ type: z.literal("set_wall"), wall: wallSchema }).strict(),
  z.object({ type: z.literal("remove_wall"), id }).strict(),
  z.object({ type: z.literal("set_opening"), opening: openingSchema }).strict(),
  z.object({ type: z.literal("remove_opening"), id }).strict(),
  z
    .object({ type: z.literal("calibrate"), factor: n.min(0.1).max(10) })
    .strict(),
]);
export type SceneOperation = z.infer<typeof operationSchema>;
export type SceneRevision = {
  id: string;
  projectId: string;
  parentId: string | null;
  createdAt: string;
  summary: string;
  source: "manual" | "ai" | "restore" | "import";
  scene: SceneDocument;
  operations: SceneOperation[];
  thumbnail: string | null;
};
export type Project = {
  id: string;
  name: string;
  headId: string;
  createdAt: string;
  preferences?: string;
  scene: SceneDocument;
};
export type Attachment = {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  createdAt: string;
};
export type ChatMessage = {
  id: string;
  projectId: string;
  role: "user" | "assistant";
  text: string;
  attachments: string[];
  createdAt: string;
  revisionId?: string;
};
export const mat = (
  c: string,
  finish: Material["finish"] = "matte",
): Material => ({
  color: c,
  finish,
  roughness: finish === "metal" ? 0.3 : finish === "glass" ? 0.08 : 0.8,
});
export const catalog: {
  kind: SceneObject["kind"];
  name: string;
  dimensions: [number, number, number];
  color: string;
  finish: Material["finish"];
  category: string;
}[] = [
  {
    kind: "sofa",
    name: "Sofá Nuvem",
    dimensions: [1.8, 0.8, 0.84],
    color: "#ddd5c6",
    finish: "fabric",
    category: "Sala",
  },
  {
    kind: "bed",
    name: "Cama de casal",
    dimensions: [1.38, 0.62, 1.88],
    color: "#e5dfd3",
    finish: "fabric",
    category: "Quarto",
  },
  {
    kind: "bed",
    name: "Cama de solteiro",
    dimensions: [0.88, 0.58, 1.88],
    color: "#d7d9cd",
    finish: "fabric",
    category: "Quarto",
  },
  {
    kind: "table",
    name: "Mesa redonda",
    dimensions: [0.85, 0.75, 0.85],
    color: "#b38c62",
    finish: "wood",
    category: "Sala",
  },
  {
    kind: "chair",
    name: "Cadeira Arco",
    dimensions: [0.45, 0.8, 0.45],
    color: "#c4ae8b",
    finish: "wood",
    category: "Sala",
  },
  {
    kind: "wardrobe",
    name: "Guarda-roupa",
    dimensions: [1.7, 2.2, 0.54],
    color: "#c3b49b",
    finish: "wood",
    category: "Quarto",
  },
  {
    kind: "cabinet",
    name: "Armário baixo",
    dimensions: [1.2, 0.72, 0.4],
    color: "#b99a72",
    finish: "wood",
    category: "Sala",
  },
  {
    kind: "counter",
    name: "Bancada",
    dimensions: [1.2, 0.9, 0.6],
    color: "#d4d0c5",
    finish: "ceramic",
    category: "Cozinha",
  },
  {
    kind: "fridge",
    name: "Geladeira",
    dimensions: [0.6, 1.7, 0.62],
    color: "#babfba",
    finish: "metal",
    category: "Cozinha",
  },
  {
    kind: "stove",
    name: "Fogão",
    dimensions: [0.55, 0.9, 0.6],
    color: "#484a45",
    finish: "metal",
    category: "Cozinha",
  },
  {
    kind: "washer",
    name: "Lava e seca",
    dimensions: [0.6, 0.86, 0.6],
    color: "#eeeeea",
    finish: "metal",
    category: "Serviço",
  },
  {
    kind: "sink",
    name: "Cuba e gabinete",
    dimensions: [0.6, 0.85, 0.5],
    color: "#eeece3",
    finish: "ceramic",
    category: "Banheiro",
  },
  {
    kind: "toilet",
    name: "Vaso sanitário",
    dimensions: [0.4, 0.75, 0.65],
    color: "#f4f2eb",
    finish: "ceramic",
    category: "Banheiro",
  },
  {
    kind: "shower",
    name: "Box de banho",
    dimensions: [0.85, 2, 0.85],
    color: "#b4d1cf",
    finish: "glass",
    category: "Banheiro",
  },
  {
    kind: "rug",
    name: "Tapete orgânico",
    dimensions: [1.5, 0.015, 2],
    color: "#d8c7a6",
    finish: "fabric",
    category: "Decoração",
  },
  {
    kind: "plant",
    name: "Ficus",
    dimensions: [0.5, 1.3, 0.5],
    color: "#658461",
    finish: "matte",
    category: "Decoração",
  },
  {
    kind: "lamp",
    name: "Luminária de piso",
    dimensions: [0.36, 1.6, 0.36],
    color: "#dfcfac",
    finish: "fabric",
    category: "Iluminação",
  },
  {
    kind: "curtain",
    name: "Cortina de linho",
    dimensions: [1.4, 2.35, 0.08],
    color: "#e2ddcd",
    finish: "fabric",
    category: "Decoração",
  },
  {
    kind: "art",
    name: "Quadro abstrato",
    dimensions: [0.6, 0.8, 0.04],
    color: "#b37759",
    finish: "matte",
    category: "Decoração",
  },
  {
    kind: "tv",
    name: "Televisão",
    dimensions: [1.05, 0.62, 0.05],
    color: "#202725",
    finish: "metal",
    category: "Sala",
  },
  {
    kind: "shelf",
    name: "Estante aberta",
    dimensions: [0.8, 1.8, 0.3],
    color: "#9c7952",
    finish: "wood",
    category: "Sala",
  },
];
export function createObject(
  entry: (typeof catalog)[number],
  room: Room,
  objectId = crypto.randomUUID(),
): SceneObject {
  return {
    id: objectId,
    name: entry.name,
    kind: entry.kind,
    roomId: room.id,
    position: [room.x + room.width / 2, 0, room.z + room.depth / 2],
    rotation: 0,
    dimensions: [...entry.dimensions],
    material: mat(entry.color, entry.finish),
    parts: {},
    locked: false,
  };
}
const palettes: Record<
  Style,
  { wall: string; floor: string; wood: string; fabric: string; accent: string }
> = {
  neutro: {
    wall: "#f0ece3",
    floor: "#bdac90",
    wood: "#b79870",
    fabric: "#dcd5c7",
    accent: "#76816b",
  },
  contemporâneo: {
    wall: "#e7e4df",
    floor: "#b5aaa0",
    wood: "#8e7860",
    fabric: "#c9c2b8",
    accent: "#646d6b",
  },
  escandinavo: {
    wall: "#f4f2e9",
    floor: "#d2c1a1",
    wood: "#cfb994",
    fabric: "#e4dfd3",
    accent: "#8a9d85",
  },
  industrial: {
    wall: "#aaa9a2",
    floor: "#8d8b81",
    wood: "#8c6747",
    fabric: "#8b7764",
    accent: "#424946",
  },
  japandi: {
    wall: "#e9e2d2",
    floor: "#b9a783",
    wood: "#a28761",
    fabric: "#d8cdb6",
    accent: "#777d58",
  },
};
function requireItem<T extends { id: string }>(items: T[], key: string) {
  const x = items.find((x) => x.id === key);
  if (!x) throw new Error(`Elemento não encontrado: ${key}`);
  return x;
}
export function validateScene(input: unknown): SceneDocument {
  const s = sceneSchema.parse(input);
  const ids = [...s.rooms, ...s.objects, ...s.walls, ...s.openings].map(
    (x) => x.id,
  );
  if (new Set(ids).size !== ids.length)
    throw new Error("Identificadores duplicados na cena.");
  for (const w of s.walls)
    if (Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]) < 0.1)
      throw new Error("Parede precisa ter ao menos 10 cm.");
  for (const o of s.openings) {
    const w = requireItem(s.walls, o.wallId);
    if (
      o.offset + o.width >
        Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]) + 0.001 ||
      o.sill + o.height > w.height + 0.001
    )
      throw new Error("Abertura ultrapassa a parede.");
  }
  for (const o of s.objects) {
    const r = requireItem(s.rooms, o.roomId);
    if (o.position[1] < 0 || o.position[1] + o.dimensions[1] > r.height + 0.03)
      throw new Error(`${o.name}: altura fora do ambiente.`);
    const [x, , z] = o.position;
    if (
      x < r.x - 0.05 ||
      x > r.x + r.width + 0.05 ||
      z < r.z - 0.05 ||
      z > r.z + r.depth + 0.05
    )
      throw new Error(`${o.name}: centro fora do cômodo selecionado.`);
  }
  return s;
}
export function placementWarnings(s: SceneDocument): string[] {
  const warnings: string[] = [];
  for (const o of s.objects) {
    if (["art", "curtain", "rug", "tv", "shower"].includes(o.kind)) continue;
    const r = s.rooms.find((r) => r.id === o.roomId)!;
    const a = (o.rotation * Math.PI) / 180;
    const dx =
      (Math.abs(Math.cos(a)) * o.dimensions[0] +
        Math.abs(Math.sin(a)) * o.dimensions[2]) /
      2;
    const dz =
      (Math.abs(Math.sin(a)) * o.dimensions[0] +
        Math.abs(Math.cos(a)) * o.dimensions[2]) /
      2;
    if (
      o.position[0] - dx < r.x - 0.06 ||
      o.position[0] + dx > r.x + r.width + 0.06 ||
      o.position[2] - dz < r.z - 0.06 ||
      o.position[2] + dz > r.z + r.depth + 0.06
    )
      warnings.push(`${o.name}: confira a distância das paredes.`);
  }
  return warnings;
}
export function applyOperations(
  scene: SceneDocument,
  raw: unknown,
  {
    geometry = false,
    agent = false,
    roomId,
  }: { geometry?: boolean; agent?: boolean; roomId?: string } = {},
): SceneDocument {
  const ops = z.array(operationSchema).max(200).parse(raw);
  let s = structuredClone(scene);
  for (const op of ops) {
    if (
      [
        "set_wall",
        "remove_wall",
        "set_opening",
        "remove_opening",
        "calibrate",
      ].includes(op.type) &&
      (!geometry || agent)
    )
      throw new Error("Ative Editar planta para alterar a estrutura.");
    if (op.type === "add_object") {
      if (roomId && op.object.roomId !== roomId)
        throw new Error("Objeto fora do cômodo selecionado.");
      s.objects.push(op.object);
    }
    if (op.type === "update_object" || op.type === "remove_object") {
      const o = requireItem(s.objects, op.id);
      if (agent && o.locked) throw new Error(`${o.name} está bloqueado.`);
      if (roomId && o.roomId !== roomId)
        throw new Error("Objeto fora do cômodo selecionado.");
      if (op.type === "update_object") {
        if (
          agent &&
          (op.changes.locked !== undefined ||
            (op.changes.roomId && op.changes.roomId !== o.roomId))
        )
          throw new Error(
            "A IA não pode desbloquear ou trocar o cômodo de um objeto.",
          );
        Object.assign(o, op.changes);
      } else s.objects = s.objects.filter((o) => o.id !== op.id);
    }
    if (op.type === "set_room") {
      if (roomId && op.id !== roomId)
        throw new Error("Cômodo fora da seleção.");
      if (
        Object.keys(op.changes).some((k) =>
          ["x", "z", "width", "depth", "height"].includes(k),
        ) &&
        (!geometry || agent)
      )
        throw new Error("Dimensões exigem Editar planta.");
      Object.assign(requireItem(s.rooms, op.id), op.changes);
    }
    if (op.type === "set_lighting") s.lighting = op.lighting;
    if (op.type === "apply_style") {
      const p = palettes[op.style];
      if (roomId && op.roomId !== roomId)
        throw new Error("Estilo deve respeitar o cômodo selecionado.");
      for (const r of s.rooms.filter((r) => !op.roomId || r.id === op.roomId)) {
        r.wallColor = p.wall;
        r.floor.color = ["kitchen", "bath", "lavabo"].some((k) =>
          r.id.includes(k),
        )
          ? "#d8d5cb"
          : p.floor;
      }
      for (const o of s.objects.filter(
        (o) => (!op.roomId || o.roomId === op.roomId) && !o.locked,
      )) {
        o.material.color =
          o.material.finish === "wood"
            ? p.wood
            : o.material.finish === "fabric"
              ? p.fabric
              : o.kind === "plant"
                ? "#647b54"
                : p.accent;
      }
      if (!op.roomId) for (const w of s.walls) w.color = p.wall;
    }
    if (op.type === "set_wall") {
      const i = s.walls.findIndex((w) => w.id === op.wall.id);
      if (i < 0) s.walls.push(op.wall);
      else s.walls[i] = op.wall;
    }
    if (op.type === "remove_wall") {
      requireItem(s.walls, op.id);
      s.walls = s.walls.filter((w) => w.id !== op.id);
      s.openings = s.openings.filter((o) => o.wallId !== op.id);
    }
    if (op.type === "set_opening") {
      const i = s.openings.findIndex((o) => o.id === op.opening.id);
      if (i < 0) s.openings.push(op.opening);
      else s.openings[i] = op.opening;
    }
    if (op.type === "remove_opening")
      s.openings = s.openings.filter((o) => o.id !== op.id);
    if (op.type === "calibrate") {
      const f = op.factor;
      s.rooms.forEach((r) => {
        r.x *= f;
        r.z *= f;
        r.width *= f;
        r.depth *= f;
      });
      s.walls.forEach((w) => {
        w.start = w.start.map((v) => v * f) as [number, number];
        w.end = w.end.map((v) => v * f) as [number, number];
      });
      s.openings.forEach((o) => {
        o.offset *= f;
        o.width *= f;
      });
      s.objects.forEach((o) => {
        o.position[0] *= f;
        o.position[2] *= f;
      });
      s.source.confidence = "calibrated";
      s.source.note =
        "Escala ajustada pelo usuário. Confira as demais medidas.";
    }
  }
  s = validateScene(s);
  if (agent) {
    const before = new Set(placementWarnings(scene));
    const added = placementWarnings(s).filter((w) => !before.has(w));
    if (added.length) throw new Error(added.join(" "));
  }
  return s;
}
export function sceneBounds(s: SceneDocument) {
  const minX = Math.min(...s.rooms.map((r) => r.x)),
    minZ = Math.min(...s.rooms.map((r) => r.z)),
    maxX = Math.max(...s.rooms.map((r) => r.x + r.width)),
    maxZ = Math.max(...s.rooms.map((r) => r.z + r.depth));
  return { minX, minZ, maxX, maxZ, width: maxX - minX, depth: maxZ - minZ };
}
export function thumbnail(s: SceneDocument) {
  const b = sceneBounds(s);
  const escape = (x: string) => x.replace(/[<>&"']/g, "");
  const rooms = s.rooms
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.z}" width="${r.width}" height="${r.depth}" fill="${r.floor.color}" stroke="#efede4" stroke-width=".04"/>`,
    )
    .join("");
  const objs = s.objects
    .map(
      (o) =>
        `<rect x="${-o.dimensions[0] / 2}" y="${-o.dimensions[2] / 2}" width="${o.dimensions[0]}" height="${o.dimensions[2]}" rx=".04" fill="${escape(o.material.color)}" stroke="#59564f" stroke-width=".02" transform="translate(${o.position[0]} ${o.position[2]}) rotate(${-o.rotation})"/>`,
    )
    .join("");
  const walls = s.walls
    .map(
      (w) =>
        `<path d="M${w.start.join(" ")} L${w.end.join(" ")}" stroke="#5b5b52" stroke-width="${w.thickness}"/>`,
    )
    .join("");
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX - 0.3} ${b.minZ - 0.3} ${b.width + 0.6} ${b.depth + 0.6}"><rect x="${b.minX - 0.3}" y="${b.minZ - 0.3}" width="${b.width + 0.6}" height="${b.depth + 0.6}" fill="#e8e5db"/>${rooms}${objs}${walls}</svg>`)}`;
}
