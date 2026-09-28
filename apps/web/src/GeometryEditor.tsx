import { useState, useRef } from "react";
import { Plus, Trash2, Move, Check, ScanLine } from "lucide-react";
import {
  sceneBounds,
  type SceneDocument,
  type Wall,
  type SceneOperation,
  validateScene,
} from "../../../packages/domain/src/index";

export function GeometryEditor({
  scene,
  onChange,
  sourceUrl,
}: {
  scene: SceneDocument;
  onChange: (
    scene: SceneDocument,
    ops: SceneOperation[],
    summary: string,
  ) => void;
  sourceUrl?: string;
}) {
  const [selected, setSelected] = useState(scene.walls[0]?.id);
  const [tab, setTab] = useState<"walls" | "rooms" | "openings">("walls");
  const [opacity, setOpacity] = useState(0.3);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<{ id: string; point: "start" | "end" }>();
  const [draft, setDraft] = useState<SceneDocument>();
  const svg = useRef<SVGSVGElement>(null);
  const s = draft || scene;
  const b = sceneBounds(s);
  const w = s.walls.find((w) => w.id === selected);
  const [current, setCurrent] = useState("1");
  const [actual, setActual] = useState("1");
  function change(next: SceneDocument, ops: SceneOperation[], summary: string) {
    try {
      validateScene(next);
      setError("");
      onChange(next, ops, summary);
    } catch (e: any) {
      setError(e.message);
    }
  }
  function updateWall(wall: Wall) {
    const next = structuredClone(scene);
    const i = next.walls.findIndex((w) => w.id === wall.id);
    if (i < 0) next.walls.push(wall);
    else next.walls[i] = wall;
    change(next, [{ type: "set_wall", wall }], "Ajustou a planta");
  }
  function pointer(e: React.PointerEvent) {
    const pt = svg.current!.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100] as [
      number,
      number,
    ];
  }
  return (
    <div className="geometry-editor">
      <div className="plan-review">
        <svg
          ref={svg}
          viewBox={`${b.minX - 0.4} ${b.minZ - 0.4} ${b.width + 0.8} ${b.depth + 0.8}`}
          onPointerMove={(e) => {
            if (!drag) return;
            const next = structuredClone(s);
            next.walls.find((w) => w.id === drag.id)![drag.point] = pointer(e);
            setDraft(next);
          }}
          onPointerUp={() => {
            if (drag && draft) {
              const changed = draft.walls.find((w) => w.id === drag.id)!;
              setDrag(undefined);
              setDraft(undefined);
              updateWall(changed);
            }
          }}
          onPointerCancel={() => {
            setDrag(undefined);
            setDraft(undefined);
          }}
        >
          {sourceUrl && (
            <image
              href={sourceUrl}
              x={b.minX}
              y={b.minZ}
              width={b.width}
              height={b.depth}
              opacity={opacity}
              preserveAspectRatio="none"
            />
          )}
          {s.rooms.map((r) => (
            <g key={r.id}>
              <rect
                x={r.x}
                y={r.z}
                width={r.width}
                height={r.depth}
                fill={r.floor.color}
                fillOpacity={sourceUrl ? 0.12 : 0.8}
                stroke="#afafa2"
                strokeWidth=".015"
              />
              <text
                x={r.x + r.width / 2}
                y={r.z + r.depth / 2}
                textAnchor="middle"
                fontSize=".12"
                fill="#343a32"
              >
                {r.name}
              </text>
            </g>
          ))}
          {s.walls.map((w) => (
            <line
              key={w.id}
              x1={w.start[0]}
              y1={w.start[1]}
              x2={w.end[0]}
              y2={w.end[1]}
              stroke={selected === w.id ? "#75964f" : "#575c52"}
              strokeWidth={Math.max(w.thickness, 0.07)}
              onPointerDown={(e) => {
                e.stopPropagation();
                setSelected(w.id);
              }}
            />
          ))}
          {s.openings.map((o) => {
            const wall = s.walls.find((w) => w.id === o.wallId)!;
            const len = Math.hypot(
              wall.end[0] - wall.start[0],
              wall.end[1] - wall.start[1],
            );
            return (
              <line
                key={o.id}
                x1={
                  wall.start[0] +
                  ((wall.end[0] - wall.start[0]) * o.offset) / len
                }
                y1={
                  wall.start[1] +
                  ((wall.end[1] - wall.start[1]) * o.offset) / len
                }
                x2={
                  wall.start[0] +
                  ((wall.end[0] - wall.start[0]) * (o.offset + o.width)) / len
                }
                y2={
                  wall.start[1] +
                  ((wall.end[1] - wall.start[1]) * (o.offset + o.width)) / len
                }
                stroke={o.kind === "door" ? "#edeee5" : "#6a9da6"}
                strokeWidth=".09"
              />
            );
          })}
          {w &&
            (["start", "end"] as const).map((point) => (
              <circle
                key={point}
                cx={w[point][0]}
                cy={w[point][1]}
                r=".085"
                fill="#d2e6b9"
                stroke="#5d793e"
                strokeWidth=".025"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ id: w.id, point });
                }}
              />
            ))}
        </svg>
        <span>
          <Move size={12} /> Arraste os pontos da parede selecionada
        </span>
      </div>
      {sourceUrl && (
        <label className="range-label">
          Sobreposição da planta
          <input
            type="range"
            min="0"
            max="1"
            step=".05"
            value={opacity}
            onChange={(e) => setOpacity(+e.target.value)}
          />
        </label>
      )}
      <div className="segmented">
        {(["walls", "rooms", "openings"] as const).map((t, i) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {["Paredes", "Ambientes", "Aberturas"][i]}
          </button>
        ))}
      </div>
      {tab === "walls" && (
        <>
          <label className="field">
            Parede
            <select
              value={selected || ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {scene.walls.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id}
                </option>
              ))}
            </select>
          </label>
          {w && (
            <div key={JSON.stringify(w)}>
              <div className="field-grid">
                {(["start", "end"] as const).flatMap((point) =>
                  [0, 1].map((axis) => (
                    <label key={point + axis} className="field">
                      {point === "start" ? "Início" : "Fim"} {axis ? "Z" : "X"}{" "}
                      (m)
                      <input
                        type="number"
                        step=".01"
                        defaultValue={w[point][axis]}
                        onBlur={(e) => {
                          const next = structuredClone(w);
                          next[point][axis] = +e.target.value;
                          updateWall(next);
                        }}
                      />
                    </label>
                  )),
                )}
                <label className="field">
                  Altura (m)
                  <input
                    type="number"
                    step=".01"
                    defaultValue={w.height}
                    onBlur={(e) =>
                      updateWall({ ...w, height: +e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Espessura (m)
                  <input
                    type="number"
                    step=".01"
                    defaultValue={w.thickness}
                    onBlur={(e) =>
                      updateWall({ ...w, thickness: +e.target.value })
                    }
                  />
                </label>
              </div>
              <button
                className="text-button danger"
                onClick={() => {
                  const next = {
                    ...scene,
                    walls: scene.walls.filter((x) => x.id !== w.id),
                    openings: scene.openings.filter((o) => o.wallId !== w.id),
                  };
                  change(
                    next,
                    [{ type: "remove_wall", id: w.id }],
                    "Removeu parede",
                  );
                  setSelected(next.walls[0]?.id);
                }}
              >
                <Trash2 size={13} /> Remover parede
              </button>
            </div>
          )}
          <button
            className="secondary full"
            onClick={() => {
              const wall: Wall = {
                id: crypto.randomUUID(),
                start: [b.minX + 0.3, b.minZ + 0.3],
                end: [b.minX + 1.3, b.minZ + 0.3],
                height: 2.6,
                thickness: 0.12,
                color: "#e9e4d8",
                structural: false,
              };
              updateWall(wall);
              setSelected(wall.id);
            }}
          >
            <Plus size={14} /> Adicionar parede
          </button>
        </>
      )}
      {tab === "rooms" &&
        scene.rooms.map((r) => (
          <details key={r.id} className="geometry-room">
            <summary>{r.name}</summary>
            <div className="field-grid">
              {(["x", "z", "width", "depth", "height"] as const).map(
                (key, i) => (
                  <label className="field" key={key}>
                    {["X", "Z", "Largura", "Profundidade", "Altura"][i]} (m)
                    <input
                      key={r[key]}
                      type="number"
                      step=".01"
                      defaultValue={r[key]}
                      onBlur={(e) => {
                        const changes = { [key]: +e.target.value };
                        change(
                          {
                            ...scene,
                            rooms: scene.rooms.map((x) =>
                              x.id === r.id ? { ...x, ...changes } : x,
                            ),
                          },
                          [{ type: "set_room", id: r.id, changes }],
                          `Ajustou ${r.name}`,
                        );
                      }}
                    />
                  </label>
                ),
              )}
            </div>
          </details>
        ))}
      {tab === "openings" && (
        <>
          {scene.openings.map((o) => (
            <details key={o.id} className="geometry-room">
              <summary>
                {o.kind === "door" ? "Porta" : "Janela"} · {o.wallId}
              </summary>
              <label className="field">
                Parede
                <select
                  value={o.wallId}
                  onChange={(e) => {
                    const opening = { ...o, wallId: e.target.value };
                    change(
                      {
                        ...scene,
                        openings: scene.openings.map((x) =>
                          x.id === o.id ? opening : x,
                        ),
                      },
                      [{ type: "set_opening", opening }],
                      "Ajustou abertura",
                    );
                  }}
                >
                  {scene.walls.map((w) => (
                    <option key={w.id}>{w.id}</option>
                  ))}
                </select>
              </label>
              <div className="field-grid">
                {(["offset", "width", "height", "sill"] as const).map(
                  (key, i) => (
                    <label className="field" key={key}>
                      {
                        ["Distância inicial", "Largura", "Altura", "Peitoril"][
                          i
                        ]
                      }{" "}
                      (m)
                      <input
                        key={o[key]}
                        type="number"
                        step=".01"
                        defaultValue={o[key]}
                        onBlur={(e) => {
                          const opening = { ...o, [key]: +e.target.value };
                          change(
                            {
                              ...scene,
                              openings: scene.openings.map((x) =>
                                x.id === o.id ? opening : x,
                              ),
                            },
                            [{ type: "set_opening", opening }],
                            "Ajustou abertura",
                          );
                        }}
                      />
                    </label>
                  ),
                )}
              </div>
              <button
                className="text-button danger"
                onClick={() =>
                  change(
                    {
                      ...scene,
                      openings: scene.openings.filter((x) => x.id !== o.id),
                    },
                    [{ type: "remove_opening", id: o.id }],
                    "Removeu abertura",
                  )
                }
              >
                <Trash2 size={12} /> Remover
              </button>
            </details>
          ))}
          <button
            className="secondary full"
            disabled={!w}
            onClick={() => {
              if (!w) return;
              const opening = {
                id: crypto.randomUUID(),
                wallId: w.id,
                kind: "door" as const,
                offset: 0.1,
                width: 0.7,
                height: 2.1,
                sill: 0,
              };
              change(
                { ...scene, openings: [...scene.openings, opening] },
                [{ type: "set_opening", opening }],
                "Adicionou porta",
              );
            }}
          >
            <Plus size={14} /> Adicionar porta
          </button>
          <button
            className="secondary full"
            disabled={!w}
            onClick={() => {
              if (!w) return;
              const opening = {
                id: crypto.randomUUID(),
                wallId: w.id,
                kind: "window" as const,
                offset: 0.1,
                width: 0.7,
                height: 1,
                sill: 1,
              };
              change(
                { ...scene, openings: [...scene.openings, opening] },
                [{ type: "set_opening", opening }],
                "Adicionou janela",
              );
            }}
          >
            <Plus size={14} /> Adicionar janela
          </button>
        </>
      )}
      <details className="geometry-room">
        <summary>
          <ScanLine size={14} /> Calibrar escala horizontal
        </summary>
        <div className="field-grid">
          <label className="field">
            Medida no modelo (m)
            <input
              type="number"
              min=".1"
              step=".01"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="field">
            Medida real (m)
            <input
              type="number"
              min=".1"
              step=".01"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </label>
        </div>
        <button
          className="secondary full"
          onClick={async () => {
            try {
              const { applyOperations } =
                await import("../../../packages/domain/src/index");
              const ops: SceneOperation[] = [
                { type: "calibrate", factor: +actual / +current },
              ];
              change(
                applyOperations(scene, ops, { geometry: true }),
                ops,
                "Calibrou a escala",
              );
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          Aplicar escala
        </button>
      </details>
      {error && <p className="inline-error">{error}</p>}
    </div>
  );
}
