import { Container, Graphics, Text } from "pixi.js";
import type { Agent } from "@ai-pixel-office/domain/entities";
import { getPet, plotPet } from "@ai-pixel-office/pet";
import { RUNTIME } from "../../../shared/config/presentation.ts";

export const OFFICE_WIDTH = 760;
const COLUMN_X = [68, 244, 420, 596] as const;
const FIRST_ROW_Y = 188;
const ROW_GAP = 142;

export function officeLayout(agentCount: number): {
  positions: Array<[number, number]>;
  height: number;
} {
  const slotCount = Math.max(4, Math.ceil(agentCount / COLUMN_X.length) * COLUMN_X.length);
  const positions = Array.from({ length: slotCount }, (_, index) => [
    COLUMN_X[index % COLUMN_X.length]!,
    FIRST_ROW_Y + Math.floor(index / COLUMN_X.length) * ROW_GAP,
  ]) as Array<[number, number]>;
  const rows = slotCount / COLUMN_X.length;
  return { positions, height: Math.max(420, 278 + rows * ROW_GAP) };
}

export function hash(value: string): number {
  return [...value].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) | 0, 0);
}

export function petGraphic(agent: Agent): Container {
  const pet = getPet(agent.avatarId, hash(agent.id));
  const character = new Container();
  const pixels = new Graphics();
  const scale = 3;
  plotPet(pet, (x, y, width, height, color) => {
    pixels.rect(x * scale, y * scale, width * scale, height * scale).fill(color);
  });
  character.addChild(pixels);
  return character;
}

export function roomBackground(height: number): Container {
  const room = new Container();
  const wall = new Graphics().rect(0, 0, 760, 126).fill("#f2dfbf");
  const trim = new Graphics().rect(0, 122, 760, 8).fill("#9f6d4e");
  const floor = new Graphics().rect(0, 130, 760, height - 130).fill("#d6aa76");
  for (let y = 130; y < height; y += 32) {
    for (let x = (Math.floor(y / 32) % 2) * -32; x < 760; x += 64) {
      floor.rect(x, y, 31, 31).fill("#dfb782");
    }
  }
  const windowFrame = new Graphics()
    .roundRect(46, 24, 170, 76, 4)
    .fill("#6f4c42")
    .rect(53, 31, 156, 62)
    .fill("#9bd3d6")
    .rect(128, 31, 6, 62)
    .fill("#f6e7ce")
    .rect(53, 60, 156, 6)
    .fill("#f6e7ce");
  const board = new Graphics()
    .roundRect(508, 24, 190, 76, 4)
    .fill("#b17856")
    .rect(516, 32, 174, 60)
    .fill("#f4ead5");
  const title = new Text({
    text: "AI PIXEL OFFICE",
    style: { fontFamily: "monospace", fontSize: 17, fontWeight: "700", fill: "#5b4b42" },
  });
  title.position.set(531, 51);
  const rug = new Graphics()
    .roundRect(276, 139, 208, 24, 7)
    .fill("#bc695b")
    .rect(288, 146, 184, 4)
    .fill("#e5b56e");
  const plant = new Graphics()
    .rect(719, 86, 7, 42)
    .fill("#78543e")
    .rect(707, 109, 31, 20)
    .fill("#b66d48")
    .rect(711, 72, 9, 33)
    .fill("#568362")
    .rect(725, 65, 9, 40)
    .fill("#65976c")
    .rect(718, 57, 8, 49)
    .fill("#76a978");
  const lights = new Graphics();
  const lightCount = 4;
  const lightGap = 760 / lightCount;
  for (let index = 0; index < lightCount; index += 1) {
    const cx = lightGap * index + lightGap / 2;
    lights
      .roundRect(cx - 21, 6, 42, 9, 3)
      .fill("#f6ecd0")
      .roundRect(cx - 21, 6, 42, 9, 3)
      .stroke({ width: 1, color: "#c9a15c" });
  }
  const clock = new Graphics()
    .circle(362, 62, 22)
    .fill("#f6ecd9")
    .circle(362, 62, 22)
    .stroke({ width: 3, color: "#6f4c42" })
    .rect(360, 46, 3, 17)
    .fill("#4b3b32")
    .rect(362, 60, 14, 3)
    .fill("#4b3b32")
    .circle(362, 62, 2)
    .fill("#4b3b32");
  const cabinet = new Graphics()
    .rect(226, 70, 34, 60)
    .fill("#8a6a4c")
    .rect(230, 76, 26, 3)
    .fill("#e8d7ba")
    .rect(230, 88, 26, 3)
    .fill("#e8d7ba")
    .rect(230, 100, 26, 3)
    .fill("#e8d7ba")
    .rect(230, 112, 26, 3)
    .fill("#e8d7ba");
  room.addChild(wall, lights, trim, floor, windowFrame, board, clock, cabinet, rug, plant, title);
  return room;
}

function drawMonitorGlyph(graphics: Graphics, model: Agent["model"]): void {
  const points =
    model === "codex"
      ? [
          [1, 0],
          [2, 0],
          [0, 1],
          [0, 2],
          [0, 3],
          [1, 4],
          [2, 4],
        ]
      : [
          [1, 0],
          [0, 1],
          [2, 1],
          [0, 2],
          [1, 2],
          [2, 2],
          [0, 3],
          [2, 3],
          [0, 4],
          [2, 4],
        ];
  for (const [px, py] of points) graphics.rect(59 + px! * 4, -16 + py! * 3, 4, 3).fill("#fffaf0");
}

export function desk(x: number, y: number, model?: Agent["model"]): Container {
  const item = new Container();
  const screenColor = model ? RUNTIME[model].color : "#a9d7ce";
  const shape = new Graphics()
    .rect(-11, -30, 8, 72)
    .fill("#c7bda9")
    .rect(-11, -30, 8, 4)
    .fill("#a7987d")
    .rect(127, -30, 8, 72)
    .fill("#c7bda9")
    .rect(127, -30, 8, 4)
    .fill("#a7987d")
    .roundRect(0, 0, 124, 42, 5)
    .fill("#9b6849")
    .rect(8, 38, 9, 44)
    .fill("#6c493c")
    .rect(107, 38, 9, 44)
    .fill("#6c493c")
    .rect(40, -23, 46, 28)
    .fill("#4e5965")
    .rect(45, -18, 36, 18)
    .fill(screenColor)
    .rect(60, 5, 7, 10)
    .fill("#59636c");
  if (model) drawMonitorGlyph(shape, model);
  item.addChild(shape);
  item.position.set(x, y);
  return item;
}
