import type { Editor } from "tldraw";

/** Усечённый снимок страницы для Claude (без тяжёлых полей). */
export function getCanvasSnapshotForAgent(editor: Editor, maxShapes = 80) {
  const shapes = editor.getCurrentPageShapes();
  return shapes.slice(0, maxShapes).map((s) => {
    const base = {
      id: s.id,
      type: s.type,
      x: Math.round(s.x),
      y: Math.round(s.y),
    };
    if (s.type === "note") {
      const props = s.props as { color?: string };
      return { ...base, color: props.color };
    }
    if (s.type === "frame") {
      const props = s.props as { w: number; h: number; name?: string };
      return { ...base, w: props.w, h: props.h, name: props.name };
    }
    if (s.type === "text") {
      return { ...base, hasText: true };
    }
    return base;
  });
}
