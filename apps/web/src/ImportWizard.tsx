import { useRef, useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Upload,
  X,
  FileImage,
  Crop,
  ArrowRight,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, upload, useEditor } from "./state";
import { GeometryEditor } from "./GeometryEditor";
import type { SceneDocument } from "../../../packages/domain/src/index";

export function ImportWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { project, model, jobs, load, notify } = useEditor();
  const [image, setImage] = useState("");
  const [pdf, setPdf] = useState<any>();
  const [page, setPage] = useState(1);
  const [filename, setFilename] = useState("planta");
  const [rect, setRect] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [start, setStart] = useState<{ x: number; y: number }>();
  const [area, setArea] = useState("36.15");
  const [width, setWidth] = useState("");
  const [jobId, setJobId] = useState<string>();
  const [draft, setDraft] = useState<SceneDocument>();
  const [imageId, setImageId] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Novo apartamento");
  const img = useRef<HTMLImageElement>(null);
  const job = jobs.find((j) => j.id === jobId);
  useEffect(() => {
    if (job?.status === "completed" && job.result?.scene && !draft) {
      setDraft(job.result.scene);
      setName(job.result.scene.name);
      setBusy(false);
    }
    if (job?.status === "failed" || job?.status === "cancelled") {
      setBusy(false);
      setError(job.error || "Pedido cancelado.");
    }
  }, [job?.status]);
  async function renderPdf(doc: any, num: number) {
    const p = await doc.getPage(num);
    const v = p.getViewport({
      scale: Math.min(2, 2000 / p.getViewport({ scale: 1 }).width),
    });
    const canvas = document.createElement("canvas");
    canvas.width = v.width;
    canvas.height = v.height;
    await p.render({
      canvas,
      canvasContext: canvas.getContext("2d"),
      viewport: v,
    }).promise;
    setImage(canvas.toDataURL());
    setRect({ x: 0, y: 0, w: 1, h: 1 });
  }
  async function fileChanged(file?: File) {
    if (!file) return;
    setError("");
    setBusy(true);
    setFilename(file.name);
    setDraft(undefined);
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Use um arquivo de até 20 MB.");
      if (file.type === "application/pdf") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() })
          .promise;
        setPdf(doc);
        setPage(1);
        await renderPdf(doc, 1);
      } else if (["image/png", "image/jpeg"].includes(file.type)) {
        setPdf(undefined);
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onload = () => {
            setImage(String(reader.result));
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setRect({ x: 0, y: 0, w: 1, h: 1 });
      } else throw new Error("Selecione PNG, JPEG ou PDF.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function point(e: React.PointerEvent) {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
    };
  }
  async function analyze() {
    if (!project || !img.current) return;
    setBusy(true);
    setError("");
    try {
      if (!(Number(area) > 0))
        throw new Error("Informe uma área de referência válida.");
      if (rect.w < 0.03 || rect.h < 0.03)
        throw new Error("O recorte está muito pequeno.");
      const canvas = document.createElement("canvas");
      canvas.width = img.current.naturalWidth * rect.w;
      canvas.height = img.current.naturalHeight * rect.h;
      canvas
        .getContext("2d")!
        .drawImage(
          img.current,
          img.current.naturalWidth * rect.x,
          img.current.naturalHeight * rect.y,
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      const blob = await new Promise<Blob>((r) =>
        canvas.toBlob((b) => r(b!), "image/png"),
      );
      const asset = await upload(
        project.id,
        new File([blob], `Recorte · ${filename}.png`, { type: "image/png" }),
      );
      setImageId(asset.id);
      const result = await api(`/projects/${project.id}/chat`, {
        prompt: `Analise exclusivamente a planta anexada e reconstrua sua geometria, diferente da cena de exemplo. Nome do projeto: ${name}. Área declarada de referência: ${area} m², não necessariamente área útil. ${width ? `Largura total conhecida do recorte: ${width} metros.` : "Sem cotas: estime proporções com base na área, identificando como estimativas."} Crie ambientes, paredes, portas e janelas. Pé-direito estimado 2.6 m salvo indicação na imagem. Objetos vazios. Use stage_floorplan.`,
        model,
        baseId: project.headId,
        attachments: [asset.id],
        kind: "floorplan",
      });
      setJobId(result.id);
      await load();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  async function accept() {
    setBusy(true);
    try {
      const p = await api(`/jobs/${jobId}/accept`, {
        scene: { ...draft!, name },
      });
      await load(p.id);
      onClose();
      notify("Sua nova planta está pronta para decorar.");
      setDraft(undefined);
      setImage("");
      setJobId(undefined);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog import-dialog">
          <div className="dialog-heading">
            <div>
              <span className="eyebrow">SEU PRÓXIMO ESPAÇO</span>
              <Dialog.Title>
                {draft ? "Revise sua planta" : "Da planta para o seu espaço"}
              </Dialog.Title>
              <Dialog.Description>
                {draft
                  ? "Confira paredes, ambientes e aberturas antes de criar o projeto."
                  : "Envie uma imagem ou PDF. A IA transforma as linhas em possibilidades."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label="Fechar importação"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="import-body">
            {draft ? (
              <>
                <label className="field">
                  Nome do projeto
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <GeometryEditor
                  scene={draft}
                  onChange={(s) => setDraft(s)}
                  sourceUrl={imageId ? `/api/assets/${imageId}` : undefined}
                />
                <button
                  className="primary full"
                  disabled={busy}
                  onClick={accept}
                >
                  <Check size={16} /> Criar projeto 3D
                </button>
              </>
            ) : (
              <>
                <label className={`upload-area ${image ? "compact" : ""}`}>
                  <Upload size={24} />
                  <strong>
                    {image
                      ? "Trocar arquivo"
                      : "Solte sua planta aqui ou escolha um arquivo"}
                  </strong>
                  <span>PNG, JPEG ou PDF · até 20 MB</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={(e) => void fileChanged(e.target.files?.[0])}
                  />
                </label>
                {image && (
                  <>
                    {pdf && (
                      <div className="pdf-pages">
                        <button
                          className="icon-button"
                          disabled={page <= 1 || busy}
                          onClick={() => {
                            setPage(page - 1);
                            void renderPdf(pdf, page - 1);
                          }}
                          aria-label="Página anterior"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span>
                          Página {page} de {pdf.numPages}
                        </span>
                        <button
                          className="icon-button"
                          disabled={page >= pdf.numPages || busy}
                          onClick={() => {
                            setPage(page + 1);
                            void renderPdf(pdf, page + 1);
                          }}
                          aria-label="Próxima página"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                    <div className="crop-note">
                      <Crop size={14} /> Arraste para selecionar somente a
                      planta desejada.
                    </div>
                    <div
                      className="crop-image"
                      onPointerDown={(e) => {
                        if (busy) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        const p = point(e);
                        setStart(p);
                        setRect({ x: p.x, y: p.y, w: 0, h: 0 });
                      }}
                      onPointerMove={(e) => {
                        if (!start) return;
                        const p = point(e);
                        setRect({
                          x: Math.min(p.x, start.x),
                          y: Math.min(p.y, start.y),
                          w: Math.abs(p.x - start.x),
                          h: Math.abs(p.y - start.y),
                        });
                      }}
                      onPointerUp={() => setStart(undefined)}
                    >
                      <img
                        ref={img}
                        src={image}
                        alt="Planta a recortar"
                        draggable={false}
                      />
                      <div
                        className="crop-selection"
                        style={{
                          left: rect.x * 100 + "%",
                          top: rect.y * 100 + "%",
                          width: rect.w * 100 + "%",
                          height: rect.h * 100 + "%",
                        }}
                      />
                    </div>
                    <div className="field-grid">
                      <label className="field">
                        Área de referência (m²)
                        <input
                          type="number"
                          min="1"
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Largura total conhecida (m)
                        <input
                          type="number"
                          min="1"
                          value={width}
                          placeholder="Opcional"
                          onChange={(e) => setWidth(e.target.value)}
                        />
                      </label>
                    </div>
                    <label className="field">
                      Nome do projeto
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <p className="muted small">
                      Você poderá revisar a geometria. Medidas inferidas serão
                      marcadas como aproximadas.
                    </p>
                    <button
                      className="primary full"
                      disabled={busy}
                      onClick={analyze}
                    >
                      {busy ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <ArrowRight size={16} />
                      )}{" "}
                      {busy ? "Interpretando a planta…" : "Gerar minha planta"}
                    </button>
                    {busy && jobId && (
                      <button
                        className="text-button"
                        onClick={() => api(`/jobs/${jobId}/cancel`, {})}
                      >
                        Cancelar análise
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            {error && <p className="inline-error">{error}</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
