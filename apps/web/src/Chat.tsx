import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Plus,
  Paperclip,
  Sparkles,
  X,
  Square,
  Image,
  ChevronDown,
  Loader2,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { useEditor, api, upload } from "./state";
export function Chat({ onConnect }: { onConnect: () => void }) {
  const {
    project,
    messages,
    attachments,
    jobs,
    model,
    models,
    account,
    set,
    load,
    notify,
    roomId,
    selectedId,
    capture,
    progress,
  } = useEditor();
  const [text, setText] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [showRefs, setShowRefs] = useState(false);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const active = jobs.find((j) => ["queued", "running"].includes(j.status));
  const latestDesignJob = jobs.find((j) => j.kind === "design");
  const failed =
    latestDesignJob?.status === "failed" ? latestDesignJob : undefined;
  const selected = project?.scene.objects.find((o) => o.id === selectedId);
  const room = project?.scene.rooms.find((r) => r.id === roomId);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, active?.status]);
  async function send(prompt = text) {
    if (!prompt.trim() || !project || sending || active) return;
    if (!account.connected) {
      onConnect();
      return;
    }
    setSending(true);
    try {
      let screenshot: string | undefined;
      try {
        screenshot = capture?.();
      } catch {}
      await api(`/projects/${project.id}/chat`, {
        prompt,
        model,
        baseId: project.headId,
        roomId: room?.id,
        selectedId: selected?.id,
        attachments: refs,
        screenshot,
      });
      setText("");
      setRefs([]);
      set({ progress: "" });
      await load();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setSending(false);
    }
  }
  return (
    <aside className="chat-panel">
      <div className="chat-heading">
        <div className="spark-icon">
          <Sparkles size={17} />
        </div>
        <div>
          <h2>Seu parceiro de ideias</h2>
          <span>
            <i
              className={
                account.connected ? "status-dot" : "status-dot offline"
              }
            />
            {account.connected
              ? "Conectado ao seu Codex"
              : "Conecte sua conta para começar"}
          </span>
        </div>
        <button
          className="icon-button"
          aria-label="Configurar conexão"
          onClick={onConnect}
        >
          <SlidersIcon />
        </button>
      </div>
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="welcome-symbol">
              <Sparkles size={26} strokeWidth={1.2} />
            </div>
            <span className="eyebrow">UM ESPAÇO QUE É SEU</span>
            <h3>
              Vamos dar vida
              <br />
              às suas ideias.
            </h3>
            <p>
              Seu apartamento está pronto para ganhar a sua cara. Por onde
              começamos?
            </p>
            <div className="chat-plan">
              <img
                src={
                  project?.scene.source.imageId
                    ? `/api/assets/${project.scene.source.imageId}`
                    : "/hm-plan.png"
                }
                alt="Sua planta original"
              />
              <div>
                <strong>Seu ponto de partida</strong>
                <span>
                  {project?.scene.source.area.toFixed(2).replace(".", ",")} m² ·{" "}
                  {project?.scene.rooms.length} ambientes
                </span>
                <small>
                  <Check size={10} /> Planta modelada
                </small>
              </div>
            </div>
            <div className="chat-suggestions">
              {[
                "Quero uma sala mais aconchegante",
                "Experimente o estilo japandi",
                "Troque o sofá por um bege",
              ].map((p, i) => (
                <button
                  key={p}
                  onClick={() => {
                    setText(p);
                  }}
                >
                  <span>{p}</span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`message ${m.role}`}>
              <div className="message-byline">
                {m.role === "assistant" ? (
                  <>
                    <Sparkles size={12} /> Forma
                  </>
                ) : (
                  <>Você</>
                )}
                <time>
                  {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              {m.attachments.length > 0 && (
                <div className="message-images">
                  {m.attachments.map((id) => (
                    <img
                      key={id}
                      src={`/api/assets/${id}`}
                      alt="Referência enviada"
                    />
                  ))}
                </div>
              )}
              <p>{m.text}</p>
              {m.role === "assistant" && m.revisionId && (
                <button
                  className="message-revision"
                  onClick={() => set({ panel: "history" })}
                >
                  <Check size={12} /> Ver no histórico
                </button>
              )}
            </div>
          ))
        )}
        {active && (
          <div className="message assistant generating">
            <div className="message-byline">
              <Sparkles className="pulse" size={13} />{" "}
              {active.status === "queued"
                ? "Na fila"
                : "Explorando possibilidades"}
            </div>
            <p>
              {progress
                ? progress.slice(-450)
                : "Analisando seu espaço e suas referências…"}
            </p>
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        {failed &&
          (!messages.length ||
            new Date(failed.created_at) >
              new Date(messages[messages.length - 1].createdAt)) && (
            <div className="inline-error">
              {failed.error}
              <button
                className="text-button"
                onClick={() =>
                  setText(
                    messages.filter((m) => m.role === "user").at(-1)?.text ||
                      "",
                  )
                }
              >
                Editar e tentar novamente
              </button>
            </div>
          )}
        <div ref={end} />
      </div>
      <div className="composer-wrap">
        {selected || room ? (
          <div className="context-chip">
            <Square size={11} />
            {selected?.name || room?.name}
            <button
              aria-label="Remover seleção do chat"
              onClick={() => set({ selectedId: undefined, roomId: undefined })}
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <div className="chat-scope">
            <span />
            Apartamento inteiro
          </div>
        )}
        {refs.length > 0 && (
          <div className="attached-references">
            {refs.map((id) => (
              <div key={id}>
                <img src={`/api/assets/${id}`} alt="Referência selecionada" />
                <button
                  aria-label="Remover referência"
                  onClick={() => setRefs(refs.filter((x) => x !== id))}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        {showRefs && (
          <div className="reference-picker">
            <div>
              <strong>Suas referências</strong>
              <button
                className="icon-button"
                onClick={() => setShowRefs(false)}
                aria-label="Fechar referências"
              >
                <X size={13} />
              </button>
            </div>
            {attachments.filter((a) => a.mime.startsWith("image")).length ? (
              attachments
                .filter((a) => a.mime.startsWith("image"))
                .map((a) => (
                  <button
                    className={refs.includes(a.id) ? "selected" : ""}
                    key={a.id}
                    onClick={() =>
                      setRefs(
                        refs.includes(a.id)
                          ? refs.filter((id) => id !== a.id)
                          : [...refs, a.id].slice(0, 8),
                      )
                    }
                  >
                    <img src={`/api/assets/${a.id}`} alt={a.name} />
                    <span>{a.name}</span>
                    {refs.includes(a.id) && <Check size={13} />}
                  </button>
                ))
            ) : (
              <p>Envie uma imagem pelo ícone de anexo.</p>
            )}
          </div>
        )}
        <div className="composer">
          <textarea
            aria-label="Mensagem para a IA"
            placeholder="Descreva o que você imagina…"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="composer-tools">
            <div>
              <label className="icon-button" title="Anexar uma referência">
                <Paperclip size={17} />
                <input
                  aria-label="Anexar referência"
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  hidden
                  onChange={async (e) => {
                    try {
                      const ids = [];
                      for (const f of Array.from(e.target.files || []).slice(
                        0,
                        8,
                      )) {
                        const a = await upload(project!.id, f);
                        ids.push(a.id);
                      }
                      setRefs([...refs, ...ids].slice(0, 8));
                      await load();
                    } catch (e: any) {
                      notify(e.message);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="icon-button"
                aria-label="Escolher referência salva"
                onClick={() => setShowRefs(!showRefs)}
              >
                <Image size={17} />
              </button>
            </div>
            {active ? (
              <button
                className="send-button stop"
                aria-label="Cancelar geração"
                onClick={() =>
                  api(`/jobs/${active.id}/cancel`, {}).then(() => load())
                }
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                className="send-button"
                aria-label="Enviar mensagem"
                disabled={!text.trim() || sending}
                onClick={() => send()}
              >
                {sending ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            )}
          </div>
        </div>
        <div className="model-row">
          <span className="model-mark">✳</span>
          <select
            aria-label="Modelo de IA"
            value={model}
            onChange={(e) => set({ model: e.target.value })}
          >
            {!models.some((m) => m.model === "gpt-6-astra") && (
              <option value="gpt-6-astra" disabled>
                Astra · indisponível
              </option>
            )}
            {models.map((m) => (
              <option key={m.model} value={m.model}>
                {m.model === "gpt-6-astra"
                  ? "Astra · recomendado"
                  : m.displayName || m.model}
              </option>
            ))}
          </select>
          <span>via sua assinatura</span>
        </div>
        <p className="composer-note">
          Cada mudança é salva. Você pode voltar quando quiser.
        </p>
      </div>
    </aside>
  );
}
function SlidersIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="#1a1c1a" />
      <circle cx="15" cy="17" r="2" fill="#1a1c1a" />
    </svg>
  );
}
