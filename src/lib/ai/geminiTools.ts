import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

/** Объявления функций для Gemini (function calling). */
export const brainstormGeminiFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "create_sticky",
    description:
      "Создать стикер (заметку) на холсте в указанных координатах страницы. Текст — краткая формулировка идеи.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        x: { type: SchemaType.NUMBER, description: "X в координатах страницы" },
        y: { type: SchemaType.NUMBER, description: "Y в координатах страницы" },
        text: { type: SchemaType.STRING, description: "Текст на стикере" },
        color: {
          type: SchemaType.STRING,
          description:
            "Цвет tldraw: black, grey, light-violet, violet, blue, light-blue, yellow, orange, green, light-green, light-red, red, white",
        },
      },
      required: ["x", "y", "text"],
    },
  },
  {
    name: "move_element",
    description: "Переместить существующий элемент по id (shape:id из снимка холста).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        x: { type: SchemaType.NUMBER },
        y: { type: SchemaType.NUMBER },
      },
      required: ["id", "x", "y"],
    },
  },
  {
    name: "group_elements",
    description: "Сгруппировать фигуры в рамку (frame) с подписью.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ids: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Массив id фигур",
        },
        label: { type: SchemaType.STRING, description: "Заголовок рамки" },
      },
      required: ["ids", "label"],
    },
  },
  {
    name: "draw_connection",
    description: "Нарисовать стрелку между двумя элементами (от центра к центру).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        from_id: { type: SchemaType.STRING },
        to_id: { type: SchemaType.STRING },
      },
      required: ["from_id", "to_id"],
    },
  },
  {
    name: "generate_image_placeholder",
    description: "Поставить на холсте заметку-заглушку под будущее изображение (промпт для генерации).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        x: { type: SchemaType.NUMBER },
        y: { type: SchemaType.NUMBER },
        prompt: { type: SchemaType.STRING },
      },
      required: ["x", "y", "prompt"],
    },
  },
];
