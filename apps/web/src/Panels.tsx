import { useState, useEffect } from "react";
import {
  Sofa,
  BedDouble,
  Armchair,
  Table2,
  Refrigerator,
  LampFloor,
  Flower2,
  Frame,
  Columns3,
  Search,
  Plus,
  X,
  LockKeyhole,
  Unlock,
  Copy,
  Trash2,
  RotateCcw,
  GitCompareArrows,
  Check,
  Upload,
  SlidersHorizontal,
  ChevronRight,
  Move3D,
  Rotate3D,
  Scaling,
  Sun,
  Paintbrush,
  History,
  Image,
  SquareDashedBottom,
} from "lucide-react";
import { useEditor, api, upload } from "./state";
import {
  catalog,
  createObject,
  mat,
  styleNames,
  type Material,
  type SceneObject,
  placementWarnings,
} from "../../../packages/domain/src/index";
import { GeometryEditor } from "./GeometryEditor";

const icons: Record<string, any> = {
  sofa: Sofa,
  bed: BedDouble,
  chair: Armchair,
  table: Table2,
  fridge: Refrigerator,
  lamp: LampFloor,
  plant: Flower2,
  art: Frame,
};
export function FurnitureIcon({
  kind,
  size = 40,
}: {
  kind: string;
  size?: number;
}) {
  const Icon = icons[kind] || Columns3;
  return <Icon size={size} strokeWidth={1.1} />;
}
function NumberField({
  label,
  value,
  onChange,
  unit = "cm",
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="unit-input">
        <input
          key={value}
          type="number"
          step={step}
          defaultValue={Math.round(value * 100) / 100}
          onBlur={(e) => {
            const n = e.currentTarget.valueAsNumber;
            // Keep the saved value visible until a valid change is committed.
            e.currentTarget.value = String(Math.round(value * 100) / 100);
            if (Number.isFinite(n) && n !== value) onChange(n);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}
function MaterialEditor({
  material,
  onChange,
}: {
  material: Material;
  onChange: (m: Material) => void;
}) {
  const [c, setC] = useState(material.color);
  useEffect(() => setC(material.color), [material.color]);
  return (
    <div className="material-editor">
      <label className="color-field">
        <input
          aria-label="Cor do material"
          type="color"
          value={c}
          onChange={(e) => setC(e.target.value)}
          onBlur={() => {
            if (c !== material.color) onChange({ ...material, color: c });
          }}
        />
        <span>{material.color.toUpperCase()}</span>
      </label>
      <select
        aria-label="Acabamento"
        value={material.finish}
        onChange={(e) =>
          onChange({
            ...material,
            finish: e.target.value as Material["finish"],
          })
        }
      >
        {(
          ["matte", "wood", "fabric", "metal", "ceramic", "glass"] as const
        ).map((f, i) => (
          <option key={f} value={f}>
            {["Fosco", "Madeira", "Tecido", "Metal", "Cerâmica", "Vidro"][i]}
          </option>
        ))}
      </select>
    </div>
  );
}
function Catalog() {
  const { project, roomId, mutate, set, notify } = useEditor();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  if (!project) return null;
  const scene = project.scene;
  const rooms = scene.rooms;
  const selectedRoom =
    rooms.find((r) => r.id === roomId) ||
    rooms.find((r) => r.id === "living") ||
    rooms[0];
  return (
    <>
      <div className="search">
        <Search size={15} />
        <input
          placeholder="Encontre um móvel"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="category-scroll">
        {["Todos", ...new Set(catalog.map((c) => c.category))].map((c) => (
          <button
            className={category === c ? "active" : ""}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <label className="field">
        Adicionar em
        <select
          value={selectedRoom.id}
          onChange={(e) => set({ roomId: e.target.value })}
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="catalog-grid">
        {catalog
          .filter(
            (c) =>
              (category === "Todos" || c.category === category) &&
              c.name.toLowerCase().includes(query.toLowerCase()),
          )
          .map((c, i) => (
            <button
              key={c.name}
              className="catalog-item"
              onClick={async () => {
                const object = createObject(c, selectedRoom);
                await mutate(
                  [{ type: "add_object", object }],
                  `Adicionou ${object.name}`,
                );
                set({ selectedId: object.id, panel: "properties" });
              }}
            >
              <div className="catalog-preview" style={{ color: c.color }}>
                <FurnitureIcon kind={c.kind} />
                <span className="catalog-add">
                  <Plus size={12} />
                </span>
              </div>
              <strong>{c.name}</strong>
              <small>
                {c.dimensions.map((v) => Math.round(v * 100)).join(" × ")} cm
              </small>
            </button>
          ))}
      </div>
      <p className="muted small">
        Peças paramétricas. Ajuste medidas e materiais para combinar com suas
        referências.
      </p>
    </>
  );
}
function Properties() {
  const { project, selectedId, roomId, mutate, transform, set, load, notify } =
    useEditor();
  if (!project) return null;
  const s = project.scene;
  const o = s.objects.find((o) => o.id === selectedId);
  const r = s.rooms.find((r) => r.id === (o?.roomId || roomId));
  const update = (changes: Partial<SceneObject>) =>
    o &&
    mutate([{ type: "update_object", id: o.id, changes }], `Ajustou ${o.name}`);
  return (
    <>
      {o ? (
        <>
          <div className="selected-object">
            <div>
              <FurnitureIcon kind={o.kind} size={45} />
            </div>
            <span>
              <strong>{o.name}</strong>
              <small>{r?.name}</small>
            </span>
            <button
              className={`icon-button ${o.locked ? "active" : ""}`}
              title={o.locked ? "Desbloquear objeto" : "Bloquear objeto"}
              onClick={() => update({ locked: !o.locked })}
            >
              {o.locked ? <LockKeyhole size={15} /> : <Unlock size={15} />}
            </button>
          </div>
          <label className="field">
            Nome
            <input
              key={o.id}
              defaultValue={o.name}
              onBlur={(e) =>
                e.target.value !== o.name && update({ name: e.target.value })
              }
            />
          </label>
          <div className="segmented">
            {(["translate", "rotate", "scale"] as const).map((mode, i) => {
              const Icon = [Move3D, Rotate3D, Scaling][i];
              return (
                <button
                  key={mode}
                  className={transform === mode ? "active" : ""}
                  onClick={() => set({ transform: mode })}
                >
                  <Icon size={14} />
                  {["Mover", "Girar", "Escala"][i]}
                </button>
              );
            })}
          </div>
          <h4>Dimensões</h4>
          <div className="field-grid three">
            {["Largura", "Altura", "Profund."].map((label, i) => (
              <NumberField
                key={label}
                label={label}
                value={o.dimensions[i] * 100}
                onChange={(n) => {
                  const dimensions = [...o.dimensions] as [
                    number,
                    number,
                    number,
                  ];
                  dimensions[i] = n / 100;
                  update({ dimensions });
                }}
              />
            ))}
          </div>
          <h4>Posição</h4>
          <div className="field-grid three">
            {["X", "Elevação", "Z"].map((label, i) => (
              <NumberField
                key={label}
                label={label}
                value={o.position[i] * 100}
                onChange={(n) => {
                  const position = [...o.position] as [number, number, number];
                  position[i] = n / 100;
                  update({ position });
                }}
              />
            ))}
          </div>
          <NumberField
            label="Rotação"
            value={o.rotation}
            unit="°"
            onChange={(rotation) => update({ rotation })}
          />
          <label className="field">
            Ambiente
            <select
              value={o.roomId}
              onChange={(e) => {
                const next = s.rooms.find((r) => r.id === e.target.value)!;
                update({
                  roomId: next.id,
                  position: [
                    next.x + next.width / 2,
                    0,
                    next.z + next.depth / 2,
                  ],
                });
              }}
            >
              {s.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <h4>Material principal</h4>
          <MaterialEditor
            material={o.material}
            onChange={(material) => update({ material })}
          />
          <details className="geometry-room">
            <summary>Materiais por parte</summary>
            {[
              "frame",
              "legs",
              "accent",
              "fabric",
              "bedding",
              "detail",
              "top",
            ].map((key, i) => (
              <div key={key}>
                <label className="field">
                  {
                    [
                      "Estrutura",
                      "Pés",
                      "Detalhes de cor",
                      "Estofado",
                      "Roupa de cama",
                      "Ferragens",
                      "Tampo",
                    ][i]
                  }
                </label>
                <MaterialEditor
                  material={
                    o.parts[key] ||
                    mat(key === "bedding" ? "#efede5" : o.material.color)
                  }
                  onChange={(material) =>
                    update({ parts: { ...o.parts, [key]: material } })
                  }
                />
              </div>
            ))}
          </details>
          <div className="actions-row">
            <button
              className="secondary"
              onClick={() => {
                const copy = {
                  ...structuredClone(o),
                  id: crypto.randomUUID(),
                  name: o.name + " · cópia",
                  locked: false,
                  position: [
                    o.position[0] + 0.12,
                    o.position[1],
                    o.position[2] + 0.12,
                  ] as [number, number, number],
                };
                void mutate(
                  [{ type: "add_object", object: copy }],
                  "Duplicou " + o.name,
                );
              }}
            >
              <Copy size={14} /> Duplicar
            </button>
            <button
              className="secondary danger"
              onClick={() => {
                void mutate(
                  [{ type: "remove_object", id: o.id }],
                  `Removeu ${o.name}`,
                );
                set({ selectedId: undefined });
              }}
            >
              <Trash2 size={14} /> Remover
            </button>
          </div>
          {placementWarnings(s)
            .filter((w) => w.startsWith(o.name + ":"))
            .map((w) => (
              <p className="inline-warning" key={w}>
                {w}
              </p>
            ))}
        </>
      ) : (
        <div className="empty-state">
          <SlidersHorizontal size={28} />
          <strong>Os detalhes fazem o espaço.</strong>
          <p>
            Selecione um móvel no 3D para ajustar medidas, posição e
            acabamentos.
          </p>
        </div>
      )}
      {r && (
        <>
          <h4>Acabamentos · {r.name}</h4>
          <label className="field">Piso</label>
          <MaterialEditor
            material={r.floor}
            onChange={(floor) =>
              mutate(
                [{ type: "set_room", id: r.id, changes: { floor } }],
                `Mudou o piso de ${r.name}`,
              )
            }
          />
          <label className="field">Cor das paredes</label>
          <MaterialEditor
            material={mat(r.wallColor)}
            onChange={(m) =>
              mutate(
                [
                  {
                    type: "set_room",
                    id: r.id,
                    changes: { wallColor: m.color },
                  },
                ],
                `Mudou as paredes de ${r.name}`,
              )
            }
          />
        </>
      )}
      <h4>Iluminação do apartamento</h4>
      <label className="field">
        Atmosfera
        <select
          value={s.lighting.time}
          onChange={(e) =>
            mutate(
              [
                {
                  type: "set_lighting",
                  lighting: {
                    ...s.lighting,
                    time: e.target.value as "day" | "evening",
                  },
                },
              ],
              "Mudou a iluminação",
            )
          }
        >
          <option value="day">Luz do dia</option>
          <option value="evening">Fim de tarde</option>
        </select>
      </label>
      <NumberField
        label="Intensidade"
        unit="×"
        step={0.1}
        value={s.lighting.intensity}
        onChange={(intensity) =>
          mutate(
            [{ type: "set_lighting", lighting: { ...s.lighting, intensity } }],
            "Ajustou a luz",
          )
        }
      />
      <NumberField
        label="Temperatura"
        unit="K"
        step={100}
        value={s.lighting.warmth}
        onChange={(warmth) =>
          mutate(
            [{ type: "set_lighting", lighting: { ...s.lighting, warmth } }],
            "Ajustou a temperatura da luz",
          )
        }
      />
      <h4>Preferências para a IA</h4>
      <label className="field">
        Seu estilo, rotina e prioridades
        <textarea
          key={project.id}
          defaultValue={project.preferences || ""}
          placeholder="Ex.: materiais claros, plantas e espaço para trabalhar."
          rows={4}
          onBlur={async (e) => {
            try {
              await api(
                `/projects/${project.id}/preferences`,
                { preferences: e.target.value },
                "PATCH",
              );
              await load();
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      </label>
      <p className="muted small">
        Estas preferências acompanham o projeto, mesmo ao restaurar versões.
      </p>
    </>
  );
}
function Styles() {
  const { roomId, project, mutate } = useEditor();
  const colors = [
    ["#eee9df", "#c5b79f", "#929981"],
    ["#ddd9d0", "#8c7660", "#5f6765"],
    ["#f4f0e5", "#cdbc9d", "#98a58f"],
    ["#aaa9a2", "#8c6747", "#424946"],
    ["#e9e2d2", "#a28761", "#777d58"],
  ];
  return (
    <>
      <p className="panel-intro">Uma nova atmosfera, sem mudar seu espaço.</p>
      <span className="scope-label">
        Aplicar em{" "}
        {project?.scene.rooms.find((r) => r.id === roomId)?.name ||
          "todo o apartamento"}
      </span>
      {styleNames.map((style, i) => (
        <button
          key={style}
          className="style-item"
          onClick={() =>
            mutate(
              [{ type: "apply_style", style, ...(roomId ? { roomId } : {}) }],
              `Estilo ${style}`,
            )
          }
        >
          <div className="style-swatch" style={{ background: colors[i][0] }}>
            <span style={{ background: colors[i][1] }} />
            <i style={{ background: colors[i][2] }} />
            <b />
          </div>
          <span>
            <strong>{style[0].toUpperCase() + style.slice(1)}</strong>
            <small>
              {
                [
                  "Calmo, leve e atemporal",
                  "Linhas limpas, tons sofisticados",
                  "Luz natural e madeira clara",
                  "Texturas brutas e contraste",
                  "O essencial, com aconchego",
                ][i]
              }
            </small>
          </span>
          <ChevronRight size={15} />
        </button>
      ))}
      <p className="muted small">
        Objetos bloqueados são preservados. Cada estilo cria uma versão que você
        pode desfazer.
      </p>
    </>
  );
}
function Versions() {
  const { project, revisions, load, set, notify, compare } = useEditor();
  const [renaming, setRenaming] = useState<string>();
  if (!project) return null;
  return (
    <>
      <p className="panel-intro">
        Toda ideia tem seu lugar. Volte a qualquer momento.
      </p>
      {revisions.map((r, i) => (
        <div
          className={`version-item ${project.headId === r.id ? "current" : ""}`}
          key={r.id}
        >
          <div className="version-marker" />
          <div className="version-meta">
            <div>
              <span className="version-number">
                VERSÃO {String(revisions.length - i).padStart(2, "0")}
              </span>
              {project.headId === r.id && (
                <span className="current-tag">Atual</span>
              )}
            </div>
            {renaming === r.id ? (
              <input
                autoFocus
                defaultValue={r.summary}
                onBlur={async (e) => {
                  try {
                    await api(
                      `/projects/${project.id}/revisions/${r.id}`,
                      { name: e.target.value },
                      "PATCH",
                    );
                    await load();
                    setRenaming(undefined);
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            ) : (
              <button
                className="version-name"
                title="Renomear versão"
                onClick={() => setRenaming(r.id)}
              >
                {r.summary}
              </button>
            )}
            <small>
              {new Date(r.createdAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              ·{" "}
              {r.source === "ai"
                ? "IA"
                : r.source === "manual"
                  ? "Você"
                  : r.source === "restore"
                    ? "Restauração"
                    : "Planta"}
            </small>
            {r.thumbnail && <img src={r.thumbnail} alt={r.summary} />}
            <div className="actions-row">
              <button
                className="text-button"
                disabled={r.id === project.headId}
                onClick={async () => {
                  try {
                    await api(`/projects/${project.id}/restore`, {
                      revisionId: r.id,
                      baseId: project.headId,
                    });
                    await load();
                    notify(
                      "Versão restaurada. As outras ideias continuam salvas.",
                    );
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                <RotateCcw size={12} /> Restaurar
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    const revision = await api(
                      `/projects/${project.id}/revisions/${r.id}`,
                    );
                    set({ compare: revision });
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                <GitCompareArrows size={12} /> Comparar
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
function References() {
  const { attachments, project, load, notify } = useEditor();
  return (
    <>
      <p className="panel-intro">
        Cores, texturas, lugares. Traga o que inspira você.
      </p>
      <label className="upload-area compact">
        <Upload size={21} />
        <strong>Adicionar referência</strong>
        <span>PNG ou JPEG</span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          multiple
          onChange={async (e) => {
            try {
              for (const file of Array.from(e.target.files || []))
                await upload(project!.id, file);
              await load();
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      </label>
      <div className="reference-grid">
        {attachments
          .filter((a) => a.mime.startsWith("image"))
          .map((a) => (
            <figure key={a.id}>
              <img src={`/api/assets/${a.id}`} alt={a.name} />
              <figcaption>{a.name}</figcaption>
            </figure>
          ))}
      </div>
      {!attachments.length && (
        <div className="empty-state">
          <Image size={28} />
          <p>
            Suas referências ficam guardadas aqui. Anexe-as no chat para
            orientar a IA.
          </p>
        </div>
      )}
      <details className="geometry-room">
        <summary>Planta original · HM Smart</summary>
        <img
          className="source-plan"
          src="/hm-plan.png"
          alt="Unidade tipo Ponta de 36,15 m²"
        />
      </details>
    </>
  );
}
export function SidePanel() {
  const { panel, set, project, mutate } = useEditor();
  if (!panel || !project) return null;
  const title = {
    catalog: "Móveis e objetos",
    styles: "Explore estilos",
    history: "Suas versões",
    references: "Suas inspirações",
    properties: "Detalhes do espaço",
    geometry: "Editar planta",
  }[panel];
  return (
    <aside className="side-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Fechar painel"
          onClick={() => set({ panel: null, geometry: false })}
        >
          <X size={16} />
        </button>
      </div>
      <div className="panel-body">
        {panel === "catalog" ? (
          <Catalog />
        ) : panel === "styles" ? (
          <Styles />
        ) : panel === "history" ? (
          <Versions />
        ) : panel === "references" ? (
          <References />
        ) : panel === "properties" ? (
          <Properties />
        ) : (
          <>
            <p className="inline-warning">
              A geometria está desbloqueada. Mudanças também ficam no histórico.
            </p>
            <GeometryEditor
              scene={project.scene}
              sourceUrl={
                project.scene.source.imageId
                  ? `/api/assets/${project.scene.source.imageId}`
                  : undefined
              }
              onChange={(_s, ops, summary) => void mutate(ops, summary)}
            />
          </>
        )}
      </div>
    </aside>
  );
}
