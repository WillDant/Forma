import React, { useEffect, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Sofa,
  Paintbrush,
  History,
  Images,
  SlidersHorizontal,
  House,
  ChevronDown,
  Plus,
  Undo2,
  Redo2,
  Download,
  Box,
  Layers,
  PersonStanding,
  ScanLine,
  Maximize,
  Eye,
  EyeOff,
  Check,
  ArrowUpRight,
  Loader2,
  X,
  FolderOpen,
  Upload,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  Link,
  ExternalLink,
} from "lucide-react";
import { useEditor, api, stream, download } from "./state";
import { Viewport } from "./Viewport";
import { SidePanel } from "./Panels";
import { Chat } from "./Chat";
import { ImportWizard } from "./ImportWizard";
import "./styles.css";

function Tip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" side="right" sideOffset={8}>
          {label}
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
function Brand() {
  return (
    <div className="brand">
      <svg width="24" height="26" viewBox="0 0 24 26" fill="none">
        <path
          d="M3 23V3h18v7H9v5h10v8"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <path d="M9 23V10M3 16h6" stroke="currentColor" strokeWidth="2.2" />
      </svg>
      <span>
        forma<span className="brand-period">.</span>
      </span>
    </div>
  );
}
function App() {
  const editor = useEditor();
  const {
    project,
    projects,
    roomId,
    view,
    set,
    load,
    notify,
    panel,
    hideWalls,
    canUndo,
    canRedo,
    busy,
    compare,
    account,
  } = editor;
  const [importOpen, setImportOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [projectMenu, setProjectMenu] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(348);
  async function connection() {
    setConnectionBusy(true);
    try {
      const status = await api("/agent/status");
      set({ account: status });
      if (status.connected) {
        const models = await api("/agent/models");
        set({ models });
      }
    } catch (e: any) {
      notify(e.message);
    } finally {
      setConnectionBusy(false);
    }
  }
  useEffect(() => {
    void load();
    void connection();
    let eventSource: EventSource | undefined;
    let dead = false;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    const connectStream = async () => {
      try {
        const source = await stream();
        if (dead) {
          source.close();
          return;
        }
        eventSource = source;
        source.addEventListener("scene", (e) => {
          if (
            JSON.parse((e as MessageEvent).data).projectId ===
            useEditor.getState().project?.id
          )
            void useEditor.getState().load();
        });
        source.addEventListener("job", (e) => {
          if (
            JSON.parse((e as MessageEvent).data).projectId ===
            useEditor.getState().project?.id
          )
            void useEditor.getState().load();
        });
        source.addEventListener("progress", (e) => {
          const d = JSON.parse((e as MessageEvent).data);
          if (d.projectId === useEditor.getState().project?.id)
            set({
              progress: (useEditor.getState().progress + d.text).slice(-3000),
            });
        });
        source.addEventListener("account", () => void connection());
        source.onerror = () => {
          source.close();
          if (!dead)
            reconnect = setTimeout(() => {
              void load();
              void connection();
              void connectStream();
            }, 3000);
        };
      } catch {
        if (!dead) reconnect = setTimeout(() => void connectStream(), 3000);
      }
    };
    void connectStream();
    return () => {
      dead = true;
      eventSource?.close();
      if (reconnect) clearTimeout(reconnect);
    };
  }, []);
  async function navigate(direction: "undo" | "redo") {
    if (!project) return;
    try {
      await api(`/projects/${project.id}/history`, {
        direction,
        baseId: project.headId,
      });
      await load();
    } catch (e: any) {
      notify(e.message);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void navigate(e.shiftKey ? "redo" : "undo");
      }
      if (e.key === "Escape")
        set({ selectedId: undefined, compare: undefined });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [project?.headId]);
  function resize(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = e.clientX,
      w = chatWidth;
    const move = (ev: PointerEvent) =>
      setChatWidth(Math.min(520, Math.max(300, w + start - ev.clientX)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  return (
    <Tooltip.Provider delayDuration={200}>
      <div
        className="app"
        style={{ "--chat-width": chatWidth + "px" } as React.CSSProperties}
      >
        <header className="topbar">
          <Brand />
          <div className="topbar-divider" />
          <div className="project-switcher">
            <button onClick={() => setProjectMenu(!projectMenu)}>
              <span>{project?.name || "Meu apartamento"}</span>
              <ChevronDown size={13} />
            </button>
            {projectMenu && (
              <div className="project-menu">
                <span className="eyebrow">SEUS ESPAÇOS</span>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      void load(p.id);
                      setProjectMenu(false);
                    }}
                  >
                    <House size={14} />
                    {p.name}
                    {p.id === project?.id && <Check size={13} />}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setImportOpen(true);
                    setProjectMenu(false);
                  }}
                >
                  <Plus size={14} /> Novo projeto a partir de planta
                </button>
                <label>
                  <FolderOpen size={14} /> Importar projeto Forma
                  <input
                    type="file"
                    accept=".json,.forma"
                    hidden
                    onChange={async (e) => {
                      try {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const p = await api(
                          "/import",
                          JSON.parse(await f.text()),
                        );
                        await load(p.id);
                        setProjectMenu(false);
                      } catch (e: any) {
                        notify(e.message);
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>
          <span className="project-badge">PESSOAL</span>
          <div className="topbar-spacer" />
          <span className="save-status">
            {busy ? (
              <Loader2 size={12} className="spin" />
            ) : (
              <span className="status-dot" />
            )}
            {busy ? "Salvando…" : "Tudo salvo"}
          </span>
          <div className="header-actions">
            <button
              className="icon-button"
              title="Desfazer (⌘Z)"
              disabled={!canUndo || busy}
              onClick={() => navigate("undo")}
            >
              <Undo2 size={16} />
            </button>
            <button
              className="icon-button"
              title="Refazer (⇧⌘Z)"
              disabled={!canRedo || busy}
              onClick={() => navigate("redo")}
            >
              <Redo2 size={16} />
            </button>
          </div>
          <button className="export-button" onClick={() => setExportOpen(true)}>
            <Download size={14} />
            <span>Exportar</span>
          </button>
          <button
            className={`avatar ${account.connected ? "connected" : ""}`}
            title="Conexão com sua conta"
            onClick={() => setConnectOpen(true)}
          >
            {account.account?.email?.[0]?.toUpperCase() || "W"}
          </button>
        </header>
        <div className="workspace">
          <nav className="rail">
            <div className="rail-main">
              {(
                [
                  { key: "catalog", label: "Móveis", Icon: Sofa },
                  { key: "styles", label: "Estilos", Icon: Paintbrush },
                  { key: "references", label: "Inspirações", Icon: Images },
                  { key: "history", label: "Histórico", Icon: History },
                ] as const
              ).map(({ key, label, Icon }) => (
                <Tip key={key} label={label}>
                  <button
                    className={`rail-button ${panel === key ? "active" : ""}`}
                    onClick={() =>
                      set({
                        panel: panel === key ? null : key,
                        geometry: false,
                      })
                    }
                  >
                    <Icon size={20} strokeWidth={1.5} />
                    <span>{label}</span>
                  </button>
                </Tip>
              ))}
            </div>
            <div className="rail-bottom">
              <Tip label="Importar uma planta">
                <button
                  className="rail-button"
                  onClick={() => setImportOpen(true)}
                >
                  <Plus size={20} />
                  <span>Planta</span>
                </button>
              </Tip>
              <Tip label="Editar geometria">
                <button
                  className={`rail-button ${panel === "geometry" ? "active" : ""}`}
                  onClick={() =>
                    set({
                      panel: panel === "geometry" ? null : "geometry",
                      geometry: panel !== "geometry",
                      view: "2d",
                    })
                  }
                >
                  <ScanLine size={20} strokeWidth={1.5} />
                  <span>Editar</span>
                </button>
              </Tip>
              <button
                className="rail-button"
                onClick={() => setConnectOpen(true)}
                title="Configurações"
              >
                <Settings2 size={20} strokeWidth={1.5} />
              </button>
            </div>
          </nav>
          <SidePanel />
          <main className="main-workspace">
            <div className="canvas-top">
              <div>
                <div className="breadcrumbs">
                  MEUS ESPAÇOS <span>/</span>{" "}
                  {project?.scene.source.label || "SEU APARTAMENTO"}
                </div>
                <h1>
                  {project?.scene.source.label || "Seu apartamento"}
                  <span>Seu espaço. Suas possibilidades.</span>
                </h1>
              </div>
              <button
                className="canvas-icon"
                title={chatOpen ? "Ocultar chat" : "Mostrar chat"}
                onClick={() => setChatOpen(!chatOpen)}
              >
                {chatOpen ? (
                  <PanelRightClose size={18} />
                ) : (
                  <PanelRightOpen size={18} />
                )}
              </button>
            </div>
            <div className="room-tabs">
              <button
                className={!roomId ? "active" : ""}
                onClick={() =>
                  set({ roomId: undefined, selectedId: undefined })
                }
              >
                <House size={13} /> Visão geral
              </button>
              {project?.scene.rooms
                .filter((r) => !["entry", "lavabo"].includes(r.id))
                .map((r) => (
                  <button
                    key={r.id}
                    className={roomId === r.id ? "active" : ""}
                    onClick={() => set({ roomId: r.id, selectedId: undefined })}
                  >
                    {r.name}
                  </button>
                ))}
            </div>
            <div className={`viewport-shell ${compare ? "comparing" : ""}`}>
              {project ? (
                <>
                  {compare ? (
                    <>
                      <div className="compare-pane">
                        <span className="compare-label">Atual</span>
                        <Viewport scene={project.scene} sync />
                      </div>
                      <div className="compare-pane">
                        <span className="compare-label">{compare.summary}</span>
                        <Viewport
                          scene={compare.scene}
                          interactive={false}
                          sync
                        />
                      </div>
                      <button
                        className="compare-close"
                        onClick={() => set({ compare: undefined })}
                      >
                        <X size={14} /> Fechar comparação
                      </button>
                    </>
                  ) : (
                    <Viewport scene={project.scene} />
                  )}
                </>
              ) : (
                <div className="loading">
                  <Loader2 className="spin" size={25} />
                  <p>Preparando seu espaço…</p>
                  <button className="secondary" onClick={() => load()}>
                    Tentar novamente
                  </button>
                </div>
              )}
              <div className="canvas-caption">
                <span className="caption-line" />
                <span>
                  {view === "2d"
                    ? "CADA DETALHE COMEÇA COM UMA IDEIA"
                    : view === "inside"
                      ? "UMA NOVA PERSPECTIVA DO SEU LAR"
                      : "IMAGINE. EXPERIMENTE. SINTA-SE EM CASA."}
                </span>
              </div>
              <div className="view-toolbar">
                <div className="view-modes">
                  {(["2d", "3d", "inside"] as const).map((v, i) => {
                    const Icon = [Layers, Box, PersonStanding][i];
                    return (
                      <button
                        key={v}
                        className={view === v ? "active" : ""}
                        onClick={() => set({ view: v })}
                      >
                        <Icon size={15} />
                        {["Planta 2D", "Maquete 3D", "Visão interna"][i]}
                      </button>
                    );
                  })}
                </div>
                <div className="toolbar-separator" />
                <button
                  className={`canvas-tool ${hideWalls ? "active" : ""}`}
                  title="Ocultar paredes da frente"
                  onClick={() => set({ hideWalls: !hideWalls })}
                >
                  {hideWalls ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  className="canvas-tool"
                  title="Propriedades e iluminação"
                  onClick={() =>
                    set({
                      panel: panel === "properties" ? null : "properties",
                      geometry: false,
                    })
                  }
                >
                  <SlidersHorizontal size={16} />
                </button>
                <button
                  className="canvas-tool"
                  title="Visão geral"
                  onClick={() =>
                    set({
                      roomId: undefined,
                      selectedId: undefined,
                      view: "3d",
                    })
                  }
                >
                  <Maximize size={16} />
                </button>
              </div>
            </div>
            <footer className="workspace-status">
              <span>
                <span className="status-dot light" />
                {project?.scene.source.area.toFixed(2).replace(".", ",")} m²
                <span className="status-divider" />{" "}
                {project?.scene.source.confidence === "calibrated"
                  ? "Escala calibrada"
                  : "Medidas aproximadas"}
              </span>
              <span className="navigation-hint">
                {view === "inside"
                  ? "W A S D para caminhar · arraste para olhar"
                  : "Arraste para orbitar · role para aproximar"}
              </span>
              <button
                onClick={() =>
                  set({ panel: "geometry", geometry: true, view: "2d" })
                }
              >
                Conferir medidas <ArrowUpRight size={12} />
              </button>
            </footer>
          </main>
          {chatOpen && (
            <>
              <div className="chat-resizer" onPointerDown={resize} />
              <Chat onConnect={() => setConnectOpen(true)} />
            </>
          )}
        </div>
        {editor.toast && (
          <div className="toast" role="status">
            <span>{editor.toast}</span>
            <button
              onClick={() => set({ toast: undefined })}
              aria-label="Fechar aviso"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />
      <Dialog.Root open={connectOpen} onOpenChange={setConnectOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog connection-dialog">
            <div className="dialog-heading">
              <div>
                <span className="eyebrow">INTELIGÊNCIA, DO SEU JEITO</span>
                <Dialog.Title>Conecte suas ideias.</Dialog.Title>
                <Dialog.Description>
                  Use o Codex com sua assinatura ChatGPT.
                </Dialog.Description>
              </div>
              <Dialog.Close className="icon-button" aria-label="Fechar conexão">
                <X size={18} />
              </Dialog.Close>
            </div>
            <div className="connection-content">
              <div className="connection-card">
                <span className="openai-symbol">✳</span>
                <div>
                  <strong>
                    {account.connected
                      ? "Sua conta está conectada"
                      : "Conectar ao ChatGPT"}
                  </strong>
                  <p>
                    {account.account?.email ||
                      "Login gerenciado pelo Codex local"}
                  </p>
                  {account.account?.planType && (
                    <span className="plan-tag">{account.account.planType}</span>
                  )}
                </div>
                {account.connected && <Check size={20} />}
              </div>
              <p className="muted">
                Astra é recomendado para interpretar plantas e desenvolver sua
                decoração. Os modelos disponíveis dependem da sua conta.
              </p>
              {account.error && <p className="inline-error">{account.error}</p>}
              {!account.connected && (
                <button
                  className="primary full"
                  disabled={connectionBusy}
                  onClick={async () => {
                    setConnectionBusy(true);
                    try {
                      const r = await api("/agent/login", {});
                      setLoginUrl(r.authUrl || r.verificationUrl || "");
                      if (r.authUrl)
                        window.open(r.authUrl, "_blank", "noopener");
                    } catch (e: any) {
                      notify(e.message);
                    } finally {
                      setConnectionBusy(false);
                    }
                  }}
                >
                  {connectionBusy ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <Link size={16} />
                  )}{" "}
                  Entrar com ChatGPT
                </button>
              )}
              {loginUrl && (
                <a
                  className="text-button"
                  href={loginUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir página de login <ExternalLink size={14} />
                </a>
              )}
              <button
                className="secondary full"
                disabled={connectionBusy}
                onClick={connection}
              >
                {connectionBusy ? (
                  <Loader2 className="spin" size={14} />
                ) : (
                  <Check size={14} />
                )}{" "}
                Verificar conexão
              </button>
              <p className="muted small">
                Seus projetos ficam neste computador. O conteúdo enviado no chat
                é processado pelo modelo escolhido e consome os limites da sua
                assinatura.
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={exportOpen} onOpenChange={setExportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog export-dialog">
            <div className="dialog-heading">
              <div>
                <Dialog.Title>Leve suas ideias com você.</Dialog.Title>
                <Dialog.Description>
                  Exporte uma imagem ou guarde o projeto completo.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="icon-button"
                aria-label="Fechar exportação"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
            <div className="export-options">
              <button
                onClick={() => {
                  try {
                    const image = editor.capture?.();
                    if (image) download("meu-apartamento.png", image);
                    setExportOpen(false);
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                <Images size={25} />
                <span>
                  <strong>Imagem da visualização</strong>
                  <small>PNG · câmera e acabamentos atuais</small>
                </span>
                <Download size={16} />
              </button>
              <button
                onClick={async () => {
                  try {
                    const bundle = await api(`/projects/${project!.id}/export`);
                    download(
                      "meu-apartamento.forma",
                      new Blob([JSON.stringify(bundle)], {
                        type: "application/json",
                      }),
                    );
                    setExportOpen(false);
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                <Box size={25} />
                <span>
                  <strong>Projeto completo</strong>
                  <small>Cena, versões, conversas e referências</small>
                </span>
                <Download size={16} />
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Tooltip.Provider>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error?: string }
> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <Brand />
        <h1>Não foi possível abrir a visualização.</h1>
        <p>{this.state.error}</p>
        <button className="primary" onClick={() => location.reload()}>
          Tentar novamente
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function FormaApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
