import {
  type SceneDocument,
  type SceneObject,
  type Wall,
  mat,
  catalog,
  validateScene,
} from "./index";
export function seedScene(): SceneDocument {
  const d = 4.695;
  const room = (
    id: string,
    name: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    height = 2.6,
  ) => ({
    id,
    name,
    x,
    z,
    width,
    depth,
    height,
    floor: mat(
      id === "kitchen" || id === "bath" || id === "lavabo"
        ? "#d9d8cf"
        : "#baa17d",
      id === "kitchen" || id === "bath" || id === "lavabo" ? "ceramic" : "wood",
    ),
    wallColor: "#e9e4d8",
  });
  const rooms = [
    room("kitchen", "Cozinha e serviço", 0, 0, 3.9, 1.65),
    room("entry", "Entrada", 3.9, 0, 1.18, 1.65),
    room("lavabo", "Lavatório", 5.08, 0, 1.05, 1.38, 2.35),
    room("bath", "Banheiro", 6.13, 0, 1.57, 1.38, 2.35),
    room("bedroom2", "Quarto de solteiro", 0, 1.65, 2.35, d - 1.65),
    room("living", "Sala de estar", 2.35, 1.65, 2.73, d - 1.65),
    room("bedroom1", "Quarto de casal", 5.08, 1.38, 2.62, d - 1.38),
  ];
  const wall = (
    id: string,
    start: [number, number],
    end: [number, number],
    height = 2.6,
  ): Wall => ({
    id,
    start,
    end,
    height,
    thickness: 0.12,
    color: "#e9e4d8",
    structural: true,
  });
  const walls = [
    wall("north", [0, 0], [7.7, 0]),
    wall("east", [7.7, 0], [7.7, d]),
    wall("south", [0, d], [7.7, d]),
    wall("west", [0, 0], [0, d]),
    wall("bed2-n", [0, 1.65], [2.35, 1.65]),
    wall("bed2-e", [2.35, 1.65], [2.35, d]),
    wall("bed1-w", [5.08, 1.38], [5.08, d]),
    wall("bath-s", [6.13, 1.38], [7.7, 1.38], 2.35),
    wall("lavabo-w", [5.08, 0], [5.08, 1.38], 2.35),
    wall("bath-w", [6.13, 0], [6.13, 1.38], 2.35),
  ];
  const openings: SceneDocument["openings"] = [
    {
      id: "entrance",
      wallId: "north",
      kind: "door",
      offset: 3.93,
      width: 0.92,
      height: 2.1,
      sill: 0,
    },
    {
      id: "door-bed2",
      wallId: "bed2-e",
      kind: "door",
      offset: 0.08,
      width: 0.78,
      height: 2.1,
      sill: 0,
    },
    {
      id: "door-bed1",
      wallId: "bed1-w",
      kind: "door",
      offset: 0.12,
      width: 0.78,
      height: 2.1,
      sill: 0,
    },
    {
      id: "door-bath",
      wallId: "bath-w",
      kind: "door",
      offset: 0.47,
      width: 0.78,
      height: 2.05,
      sill: 0,
    },
    {
      id: "door-lavabo",
      wallId: "lavabo-w",
      kind: "door",
      offset: 0.43,
      width: 0.78,
      height: 2.05,
      sill: 0,
    },
    {
      id: "win-bed2",
      wallId: "south",
      kind: "window",
      offset: 0.46,
      width: 1.3,
      height: 1.15,
      sill: 1,
    },
    {
      id: "win-living",
      wallId: "south",
      kind: "window",
      offset: 3.08,
      width: 1.35,
      height: 1.15,
      sill: 1,
    },
    {
      id: "win-bed1",
      wallId: "south",
      kind: "window",
      offset: 5.67,
      width: 1.4,
      height: 1.15,
      sill: 1,
    },
    {
      id: "win-kitchen",
      wallId: "west",
      kind: "window",
      offset: 0.25,
      width: 0.9,
      height: 0.8,
      sill: 1.25,
    },
  ];
  const objects: SceneObject[] = [];
  let count = 0;
  function add(
    kind: SceneObject["kind"],
    roomId: string,
    x: number,
    z: number,
    w: number,
    h: number,
    dep: number,
    rotation = 0,
    c?: string,
    y = 0,
    locked = false,
    name?: string,
  ) {
    const e = catalog.find((e) => e.kind === kind)!;
    objects.push({
      id: `hm-${++count}`,
      kind,
      name: name || e.name,
      roomId,
      position: [x, y, z],
      rotation,
      dimensions: [w, h, dep],
      material: mat(c || e.color, e.finish),
      parts: {},
      locked,
    });
  }
  add(
    "sink",
    "kitchen",
    0.4,
    0.42,
    0.56,
    0.88,
    0.6,
    0,
    undefined,
    0,
    true,
    "Tanque",
  );
  add("washer", "kitchen", 1.03, 0.42, 0.57, 0.86, 0.6);
  add("stove", "kitchen", 1.68, 0.42, 0.55, 0.9, 0.6);
  add("counter", "kitchen", 2.55, 0.42, 1.1, 0.89, 0.6, 0, undefined, 0, true);
  add(
    "sink",
    "kitchen",
    2.57,
    0.43,
    0.55,
    0.08,
    0.43,
    0,
    undefined,
    0.9,
    true,
    "Pia da cozinha",
  );
  add("fridge", "kitchen", 3.52, 0.44, 0.58, 1.72, 0.64);
  add("wardrobe", "bedroom2", 1.15, 2.02, 1.94, 2.2, 0.53);
  add(
    "bed",
    "bedroom2",
    0.57,
    3.6,
    0.82,
    0.57,
    1.86,
    0,
    "#bfcbd0",
    0,
    false,
    "Cama de solteiro 01",
  );
  add(
    "bed",
    "bedroom2",
    1.78,
    3.6,
    0.82,
    0.57,
    1.86,
    0,
    "#bfcbd0",
    0,
    false,
    "Cama de solteiro 02",
  );
  add("cabinet", "bedroom2", 1.18, 4.37, 0.32, 0.42, 0.36);
  add("rug", "living", 3.8, 3.65, 1.65, 0.018, 1.58, 0, "#b7ac8e");
  add("sofa", "living", 2.85, 3.69, 1.68, 0.79, 0.76, 90);
  add("cabinet", "living", 4.79, 3.65, 1.45, 0.47, 0.35, 90);
  add("tv", "living", 4.97, 3.64, 1.03, 0.62, 0.05, 90, undefined, 0.7);
  add("table", "living", 4.25, 2.12, 0.83, 0.74, 0.83);
  add("chair", "living", 3.68, 2.12, 0.42, 0.78, 0.42, -90);
  add("chair", "living", 4.8, 2.12, 0.38, 0.78, 0.42, 90);
  add("chair", "living", 4.25, 2.72, 0.42, 0.78, 0.42, 0);
  add("plant", "living", 4.66, 4.38, 0.31, 0.88, 0.31);
  add("wardrobe", "bedroom1", 6.47, 1.74, 1.94, 2.2, 0.5);
  add("bed", "bedroom1", 6.63, 3.4, 1.45, 0.64, 1.88, -90, "#d7d5c9");
  add("cabinet", "bedroom1", 7.25, 4.28, 0.53, 0.5, 0.48);
  add("lamp", "bedroom1", 7.25, 4.28, 0.22, 0.35, 0.22, 0, "#e5d4aa", 0.5);
  add("sink", "lavabo", 5.61, 0.35, 0.47, 0.85, 0.44, 0, undefined, 0, true);
  add("toilet", "bath", 6.51, 0.43, 0.4, 0.72, 0.61, 0, undefined, 0, true);
  add("shower", "bath", 7.19, 0.81, 0.86, 2, 0.89, 0, undefined, 0, true);
  return validateScene({
    schemaVersion: 1,
    name: "Meu apartamento",
    source: {
      label: "HM Smart Barra Funda · Ponta",
      area: 36.15,
      confidence: "estimated",
      note: "Base proporcional à página 11 do book. Cotas horizontais estimadas; pé-direito informado pela construtora. Confirme medidas antes de comprar móveis.",
    },
    rooms,
    walls,
    openings,
    objects,
    lighting: { intensity: 1, warmth: 4800, time: "day" },
  });
}
