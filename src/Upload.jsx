import { useState, useRef } from "react";
import { Icon } from "./ui";

// Files you attach are never poured into the notes box. A textbook is thousands
// of words and nobody wants to scroll through that to reach the Launch button.
// We keep the text on the side and only join it up when the mission is built.

export const MAX_CHARS = 60000;
export const ACCEPT = ".txt,.md,.pdf";

const OK = /\.(txt|md|pdf)$/i;

// Pull the text out of one file. A PDF needs a library. Everything else is
// already text, so the browser can hand it over on its own.
export async function readFile(file) {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    const text = await file.text();
    if (!text.trim()) throw new Error("that file is empty");
    return text.trim();
  }

  const buf = await file.arrayBuffer();
  // Loaded only when a PDF actually arrives. It is 400KB, so nobody who never
  // uploads one has to download it.
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(" ") + "\n";
  }
  if (!text.trim()) throw new Error("no text in it, so it is probably a scan");
  return text.trim();
}

export function isReadable(file) {
  return OK.test(file.name);
}

// Drag and drop. The browser fires dragleave every time the pointer crosses
// onto a child element, so a plain true/false flag flickers. Counting enters
// against leaves fixes it.
export function useFileDrop(onFiles) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const props = {
    onDragEnter(e) {
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver(e) {
      e.preventDefault();
    },
    onDragLeave(e) {
      e.preventDefault();
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDragging(false);
      }
    },
    onDrop(e) {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      onFiles([...e.dataTransfer.files]);
    },
  };

  return [dragging, props];
}

// One row per attached file. The character count is the useful part: it is how
// you tell a real document from a scan that gave us nothing.
export function FileList({ files, onRemove }) {
  if (files.length === 0) return null;

  return (
    <ul className="filelist">
      {files.map((f) => (
        <li key={f.id} className={`filerow ${f.status}`}>
          <Icon name={f.status === "error" ? "x" : "file"} size={16} />
          <span className="filename">{f.name}</span>
          <span className="filestate">
            {f.status === "reading" && "reading"}
            {f.status === "ready" && `${f.text.length.toLocaleString()} characters`}
            {f.status === "error" && f.note}
          </span>
          <button className="filex" onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`}>
            <Icon name="x" size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
