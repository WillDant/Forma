import { create } from "zustand";
import type {
  Project,
  SceneDocument,
  SceneOperation,
  ChatMessage,
  Attachment,
  SceneRevision,
} from "../../../packages/domain/src/index";
let token = "";
let sessionPromise: Promise<void> | undefined;
async function ensureSession() {
  if (token) return;
  if (!sessionPromise)
    sessionPromise = (async () => {
      const r = await fetch("/api/session");
      if (!r.ok)
        throw new Error(
          "O servidor local está indisponível. Inicie o Forma e tente novamente.",
        );
      token = (await r.json()).token;
      await fetch("/api/cookie", {
        method: "POST",
        headers: { "x-forma-session": token },
      });
    })().finally(() => {
      sessionPromise = undefined;
    });
  await sessionPromise;
}
export async function api<T = any>(
  url: string,
  body?: unknown,
  method?: string,
  retry = true,
): Promise<T> {
  await ensureSession();
  const r = await fetch("/api" + url, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", "x-forma-session": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401 && retry) {
    token = "";
    return api(url, body, method, false);
  }
  if (!r.ok) {
    let e: any;
    try {
      e = await r.json();
    } catch {
      throw new Error("Não foi possível conectar ao servidor local.");
    }
    throw new Error(e.error || "Não foi possível conectar.");
  }
  return r.json();
}
export async function stream() {
  token = "";
  await ensureSession();
  return new EventSource("/api/events?token=" + encodeURIComponent(token));
}
export async function upload(projectId: string, file: File) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  return api<Attachment>(`/projects/${projectId}/assets`, {
    name: file.name,
    mime: file.type,
    base64,
  });
}
export function download(name: string, data: Blob | string) {
  const href = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  if (typeof data !== "string")
    setTimeout(() => URL.revokeObjectURL(href), 1000);
}
type State = {
  project?: Project;
  projects: { id: string; name: string }[];
  revisions: Omit<SceneRevision, "scene" | "operations">[];
  messages: ChatMessage[];
  attachments: Attachment[];
  jobs: any[];
  canUndo: boolean;
  canRedo: boolean;
  selectedId?: string;
  roomId?: string;
  view: "3d" | "2d" | "inside";
  panel:
    | "catalog"
    | "styles"
    | "history"
    | "references"
    | "properties"
    | "geometry"
    | null;
  geometry: boolean;
  hideWalls: boolean;
  transform: "translate" | "rotate" | "scale";
  model: string;
  models: any[];
  account: any;
  busy: boolean;
  toast?: string;
  progress: string;
  compare?: SceneRevision;
  capture?: () => string;
  load: (id?: string) => Promise<void>;
  mutate: (ops: SceneOperation[], summary: string) => Promise<void>;
  notify: (message: string) => void;
  set: (next: Partial<State>) => void;
};
export const useEditor = create<State>((set, get) => ({
  projects: [],
  revisions: [],
  messages: [],
  attachments: [],
  jobs: [],
  canUndo: false,
  canRedo: false,
  view: "3d",
  panel: null,
  geometry: false,
  hideWalls: true,
  transform: "translate",
  model: "gpt-6-astra",
  models: [],
  account: { connected: false },
  busy: false,
  progress: "",
  set: (next) => set(next),
  notify: (toast) => {
    set({ toast });
    setTimeout(() => {
      if (get().toast === toast) set({ toast: undefined });
    }, 6000);
  },
  load: async (id) => {
    try {
      const projects = await api("/projects");
      id =
        id ||
        get().project?.id ||
        localStorage.getItem("forma-project") ||
        projects[0]?.id;
      if (!projects.some((p: any) => p.id === id)) id = projects[0]?.id;
      if (!id) return;
      const data = await api(`/projects/${id}`);
      const changed = get().project?.id !== id;
      set({
        ...data,
        projects,
        ...(changed
          ? { selectedId: undefined, roomId: undefined, compare: undefined }
          : {
              selectedId: data.project.scene.objects.some(
                (o: { id: string }) => o.id === get().selectedId,
              )
                ? get().selectedId
                : undefined,
              roomId: data.project.scene.rooms.some(
                (r: { id: string }) => r.id === get().roomId,
              )
                ? get().roomId
                : undefined,
            }),
      });
      localStorage.setItem("forma-project", id);
    } catch (e: any) {
      get().notify(e.message);
    }
  },
  mutate: async (ops, summary) => {
    const p = get().project;
    if (!p || get().busy) return;
    set({ busy: true });
    try {
      await api(`/projects/${p.id}/operations`, {
        baseId: p.headId,
        operations: ops,
        summary,
        geometry: get().geometry,
      });
      await get().load(p.id);
    } catch (e: any) {
      get().notify(e.message);
    } finally {
      set({ busy: false });
    }
  },
}));
