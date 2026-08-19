export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function webOpenFile(): Promise<Uint8Array | null> {
  return webOpenTextFile(".mind,application/json,application/zip");
}

function webSaveFile(data: Uint8Array, suggestedName: string) {
  const blob = new Blob([data as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function openMindFile(): Promise<Uint8Array | null> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<number[] | null>("open_mind_file");
    return bytes ? new Uint8Array(bytes) : null;
  }
  return webOpenFile();
}

function webOpenTextFile(accept: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    let done = false;
    const finish = (v: Uint8Array | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    input.addEventListener("change", () => {
      const f = input.files?.[0];
      if (!f) return finish(null);
      f.arrayBuffer()
        .then((b) => finish(new Uint8Array(b)))
        .catch(() => finish(null));
    });
    window.addEventListener(
      "focus",
      () => setTimeout(() => finish(null), 300),
      { once: true }
    );
    input.click();
  });
}

export async function openMarkdownFile(): Promise<Uint8Array | null> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<number[] | null>("open_mind_file");
    return bytes ? new Uint8Array(bytes) : null;
  }
  return webOpenTextFile(".md,.markdown,text/markdown,text/plain");
}

export async function saveMindFile(
  data: Uint8Array,
  suggestedName: string
): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_mind_file", {
      data: Array.from(data),
      suggestedName,
    });
    return;
  }
  webSaveFile(data, suggestedName);
}

/** Trigger a browser download of an arbitrary blob (works in web + Tauri webview). */
export function saveBlob(blob: Blob, suggestedName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
