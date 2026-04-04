import { defaultColorNames, type TLDefaultColorStyle } from "@tldraw/tlschema";
import type { Editor, TLNoteShape, TLShapeId } from "tldraw";
import { createShapeId, toRichText } from "tldraw";

const COLOR_SET = new Set<string>(defaultColorNames);

function normalizeColor(raw: unknown): TLDefaultColorStyle {
  if (typeof raw !== "string") return "yellow";
  const c = raw.trim().toLowerCase();
  if (COLOR_SET.has(c)) return c as TLDefaultColorStyle;
  if (c.includes("violet") || c.includes("purple")) return "violet";
  if (c.includes("blue")) return "light-blue";
  if (c.includes("green")) return "light-green";
  if (c.includes("red")) return "light-red";
  if (c.includes("orange")) return "orange";
  return "yellow";
}

function asShapeId(id: unknown): TLShapeId | null {
  if (typeof id !== "string" || !id.startsWith("shape:")) return null;
  return id as TLShapeId;
}

export type AgentToolUse = { name: string; input: unknown };

export function applyAgentToolUses(editor: Editor, uses: AgentToolUse[]): string[] {
  const logs: string[] = [];
  editor.run(() => {
    for (const u of uses) {
      try {
        logs.push(applyOne(editor, u.name, u.input));
      } catch (e) {
        logs.push(`${u.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });
  return logs;
}

function applyOne(editor: Editor, name: string, input: unknown): string {
  const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  switch (name) {
    case "create_sticky": {
      const x = Number(data.x);
      const y = Number(data.y);
      const text = typeof data.text === "string" ? data.text : "";
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("create_sticky: неверные x/y");
      const noteUtil = editor.getShapeUtil("note");
      const props: TLNoteShape["props"] = {
        ...noteUtil.getDefaultProps(),
        richText: toRichText(text.slice(0, 2000)),
        color: normalizeColor(data.color),
      };
      editor.createShape({
        id: createShapeId(),
        type: "note",
        x,
        y,
        parentId: editor.getCurrentPageId(),
        props,
      });
      return `create_sticky: «${text.slice(0, 40)}${text.length > 40 ? "…" : ""}»`;
    }
    case "move_element": {
      const id = asShapeId(data.id);
      if (!id) throw new Error("move_element: неверный id");
      const x = Number(data.x);
      const y = Number(data.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("move_element: неверные x/y");
      const shape = editor.getShape(id);
      if (!shape) throw new Error(`move_element: нет фигуры ${id}`);
      editor.updateShapes([{ id, type: shape.type, x, y }]);
      return `move_element: ${id}`;
    }
    case "group_elements": {
      const idsRaw = data.ids;
      if (!Array.isArray(idsRaw) || idsRaw.length === 0) throw new Error("group_elements: пустой ids");
      const label = typeof data.label === "string" ? data.label : "Группа";
      const ids = idsRaw.map(asShapeId).filter(Boolean) as TLShapeId[];
      if (ids.length === 0) throw new Error("group_elements: нет валидных id");
      let box = editor.getShapePageBounds(ids[0]);
      if (!box) throw new Error("group_elements: нет bounds");
      for (let i = 1; i < ids.length; i++) {
        const b = editor.getShapePageBounds(ids[i]);
        if (b) box = box.union(b);
      }
      const pad = 24;
      const frameId = createShapeId();
      const frameUtil = editor.getShapeUtil("frame");
      const fp = frameUtil.getDefaultProps();
      editor.createShape({
        id: frameId,
        type: "frame",
        x: box.x - pad,
        y: box.y - pad,
        parentId: editor.getCurrentPageId(),
        props: {
          ...fp,
          w: box.w + pad * 2,
          h: box.h + pad * 2,
          name: label.slice(0, 200),
          color: "blue",
        },
      });
      editor.reparentShapes(ids, frameId);
      return `group_elements: ${ids.length} → ${frameId}`;
    }
    case "draw_connection": {
      const from = asShapeId(data.from_id);
      const to = asShapeId(data.to_id);
      if (!from || !to) throw new Error("draw_connection: неверные from_id/to_id");
      const b1 = editor.getShapePageBounds(from);
      const b2 = editor.getShapePageBounds(to);
      if (!b1 || !b2) throw new Error("draw_connection: нет bounds");
      const p1 = b1.center;
      const p2 = b2.center;
      const ax = Math.min(p1.x, p2.x);
      const ay = Math.min(p1.y, p2.y);
      const arrowUtil = editor.getShapeUtil("arrow");
      const ap = arrowUtil.getDefaultProps();
      editor.createShape({
        id: createShapeId(),
        type: "arrow",
        x: ax,
        y: ay,
        parentId: editor.getCurrentPageId(),
        props: {
          ...ap,
          start: { x: p1.x - ax, y: p1.y - ay },
          end: { x: p2.x - ax, y: p2.y - ay },
        },
      });
      return `draw_connection: ${from} → ${to}`;
    }
    case "generate_image_placeholder": {
      const x = Number(data.x);
      const y = Number(data.y);
      const prompt = typeof data.prompt === "string" ? data.prompt : "";
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("placeholder: неверные x/y");
      const noteUtil = editor.getShapeUtil("note");
      const props: TLNoteShape["props"] = {
        ...noteUtil.getDefaultProps(),
        richText: toRichText(`🖼 ${prompt.slice(0, 500)}`),
        color: "violet",
      };
      editor.createShape({
        id: createShapeId(),
        type: "note",
        x,
        y,
        parentId: editor.getCurrentPageId(),
        props,
      });
      return "generate_image_placeholder";
    }
    default:
      return `Пропуск неизвестного tool: ${name}`;
  }
}
