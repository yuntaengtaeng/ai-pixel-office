import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { Agent } from "@ai-pixel-office/domain/entities";
import { fontFamily } from "@ai-pixel-office/design-system";
import { getPet, plotPet } from "@ai-pixel-office/pet";
import { RUNTIME } from "../../../shared/config/presentation.ts";
import type { OfficeFloorPlan, Rect } from "./officeFloorPlan.ts";
import { OFFICE_PALETTE } from "./officePalette.ts";

const WALL_WIDTH = 6;
const INNER_WALL_WIDTH = 4;
const DOOR_WIDTH = 50;

export function hash(value: string): number {
  return [...value].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) | 0, 0);
}

export function petGraphic(agent: Agent, texture?: Texture): Container {
  const pet = getPet(agent.avatarId, hash(agent.id));
  const character = new Container();
  if (texture) {
    const sprite = new Sprite(texture);
    sprite.width = 54;
    sprite.height = 54;
    character.addChild(sprite);
    return character;
  }
  const pixels = new Graphics();
  const scale = 3;
  plotPet(pet, (x, y, width, height, color) => {
    pixels.rect(x * scale, y * scale, width * scale, height * scale).fill(color);
  });
  character.addChild(pixels);
  return character;
}

function label(text: string, x: number, y: number, color: string): Text {
  const item = new Text({
    text,
    style: { fontFamily: fontFamily.base, fontSize: 12, fontWeight: "600", fill: color },
  });
  item.position.set(x, y);
  return item;
}

/** 유리벽 표기 (평행한 두 줄) */
function verticalGlassWall(graphics: Graphics, x: number, y: number, length: number): void {
  graphics.rect(x, y, 1, length).fill(OFFICE_PALETTE.glass);
  graphics.rect(x + 3, y, 1, length).fill(OFFICE_PALETTE.glass);
}

/** 점선 테두리 */
function dashedRect(graphics: Graphics, area: Rect, color: string): void {
  const dash = 8;
  const gap = 6;
  const right = area.x + area.width;
  const bottom = area.y + area.height;
  for (let x = area.x; x < right; x += dash + gap) {
    const length = Math.min(dash, right - x);
    graphics.rect(x, area.y, length, 2).fill(color);
    graphics.rect(x, bottom - 2, length, 2).fill(color);
  }
  for (let y = area.y; y < bottom; y += dash + gap) {
    const length = Math.min(dash, bottom - y);
    graphics.rect(area.x, y, 2, length).fill(color);
    graphics.rect(right - 2, y, 2, length).fill(color);
  }
}

function furniture(graphics: Graphics, x: number, y: number, width: number, height: number): void {
  graphics
    .roundRect(x, y, width, height, 4)
    .fill(OFFICE_PALETTE.furniture)
    .roundRect(x, y, width, height, 4)
    .stroke({ width: 1, color: OFFICE_PALETTE.furnitureLine });
}

function planningRoom(room: Rect): Container {
  const doorX = room.x + room.width - DOOR_WIDTH - 24;
  const wallY = room.y + room.height;
  const shape = new Graphics()
    .rect(room.x, room.y, room.width, room.height)
    .fill({ color: OFFICE_PALETTE.glass, alpha: 0.06 })
    .rect(room.x, wallY, doorX - room.x, INNER_WALL_WIDTH)
    .fill(OFFICE_PALETTE.wall)
    .rect(doorX + DOOR_WIDTH, wallY, room.x + room.width - doorX - DOOR_WIDTH, INNER_WALL_WIDTH)
    .fill(OFFICE_PALETTE.wall)
    .moveTo(doorX, wallY + INNER_WALL_WIDTH)
    .arc(doorX + DOOR_WIDTH, wallY + INNER_WALL_WIDTH, DOOR_WIDTH, Math.PI, Math.PI / 2, true)
    .stroke({ width: 1, color: OFFICE_PALETTE.labelMuted });
  furniture(shape, room.x + 56, room.y + 60, 124, 52);
  verticalGlassWall(shape, room.x + room.width, room.y, room.height);
  const item = new Container();
  item.addChild(shape, label("기획실", room.x + 14, room.y + 12, OFFICE_PALETTE.glassLabel));
  return item;
}

function testRoom(room: Rect): Container {
  const shape = new Graphics()
    .rect(room.x, room.y, room.width, room.height)
    .fill({ color: OFFICE_PALETTE.glass, alpha: 0.06 })
    .rect(room.x, room.y + room.height, room.width, INNER_WALL_WIDTH)
    .fill(OFFICE_PALETTE.wall);
  verticalGlassWall(shape, room.x - 4, room.y, room.height);
  for (const x of [room.x + 26, room.x + 76, room.x + 126]) {
    furniture(shape, x, room.y + 48, 36, 80);
    shape.rect(x, room.y + 48, 36, 4).fill(OFFICE_PALETTE.working);
  }
  const item = new Container();
  item.addChild(shape, label("테스트실", room.x + 14, room.y + 12, OFFICE_PALETTE.glassLabel));
  return item;
}

function pantry(room: Rect): Container {
  const shape = new Graphics()
    .rect(room.x, room.y, room.width, INNER_WALL_WIDTH)
    .fill(OFFICE_PALETTE.wall)
    .rect(room.x + room.width, room.y, INNER_WALL_WIDTH, room.height)
    .fill(OFFICE_PALETTE.wall)
    .circle(room.x + 140, room.y + 120, 32)
    .fill(OFFICE_PALETTE.furniture)
    .circle(room.x + 140, room.y + 120, 32)
    .stroke({ width: 1, color: OFFICE_PALETTE.furnitureLine })
    .circle(room.x + 190, room.y + 42, 12)
    .fill(OFFICE_PALETTE.plant)
    .circle(room.x + 190, room.y + 42, 7)
    .fill(OFFICE_PALETTE.plantLeaf);
  furniture(shape, room.x + 24, room.y + 44, 40, 40);
  const item = new Container();
  item.addChild(shape, label("탕비실", room.x + 14, room.y + 16, OFFICE_PALETTE.label));
  return item;
}

function myDeskZone(zone: Rect): Container {
  const deskX = zone.x + zone.width - 112;
  const deskY = zone.y + 96;
  const shape = new Graphics()
    .rect(zone.x, zone.y, zone.width, zone.height)
    .fill({ color: OFFICE_PALETTE.myDesk, alpha: 0.05 });
  furniture(shape, deskX, deskY, 100, 56);
  shape
    .rect(deskX, deskY, 100, INNER_WALL_WIDTH)
    .fill(OFFICE_PALETTE.wall)
    .rect(deskX + 14, deskY + 14, 36, 26)
    .fill(OFFICE_PALETTE.tray)
    .rect(deskX + 18, deskY + 10, 28, 4)
    .fill(OFFICE_PALETTE.paper)
    .rect(deskX + 18, deskY + 5, 28, 4)
    .fill(OFFICE_PALETTE.paper)
    .roundRect(deskX + 56, deskY - 14, 36, 22, 3)
    .fill(OFFICE_PALETTE.screenFrame)
    .rect(deskX + 60, deskY - 10, 28, 14)
    .fill({ color: OFFICE_PALETTE.glass, alpha: 0.7 });
  dashedRect(shape, zone, OFFICE_PALETTE.myDesk);
  const item = new Container();
  item.addChild(shape, label("내 자리 · 결재함", zone.x + 14, zone.y + 12, OFFICE_PALETTE.myDesk));
  return item;
}

function entrance(gate: Rect): Container {
  const shape = new Graphics()
    .rect(gate.x, gate.y, gate.width, gate.height)
    .fill(OFFICE_PALETTE.floor);
  for (const x of [gate.x + 14, gate.x + 54, gate.x + 94]) {
    shape.rect(x, gate.y - 34, 4, 26).fill(OFFICE_PALETTE.wall);
  }
  const item = new Container();
  item.addChild(shape, label("출입 게이트", gate.x + 18, gate.y - 54, OFFICE_PALETTE.labelMuted));
  return item;
}

/** 오피스 평면도 (외벽, 창, 기획실, 테스트실, 탕비실, 내 자리, 출입 게이트) */
export function roomBackground(plan: OfficeFloorPlan): Container {
  const floor = new Graphics().rect(0, 0, plan.width, plan.height).fill(OFFICE_PALETTE.floor);
  for (let x = 0; x <= plan.width; x += 40) {
    floor.rect(x, 0, 1, plan.height).fill(OFFICE_PALETTE.floorGrid);
  }
  for (let y = 0; y <= plan.height; y += 40) {
    floor.rect(0, y, plan.width, 1).fill(OFFICE_PALETTE.floorGrid);
  }
  const walls = new Graphics()
    .rect(WALL_WIDTH / 2, WALL_WIDTH / 2, plan.width - WALL_WIDTH, plan.height - WALL_WIDTH)
    .stroke({ width: WALL_WIDTH, color: OFFICE_PALETTE.wall });
  for (const x of [270, 370, 470]) {
    walls.rect(x, 0, 80, WALL_WIDTH).fill(OFFICE_PALETTE.floor);
    walls.rect(x, 1, 80, 4).fill({ color: OFFICE_PALETTE.glass, alpha: 0.7 });
  }
  const screen = new Graphics();
  furniture(screen, 290, 44, 180, 52);
  const screenTitle = new Text({
    text: "PIXEL OFFICE",
    style: {
      fontFamily: fontFamily.pixel,
      fontSize: 14,
      fontWeight: "700",
      fill: OFFICE_PALETTE.label,
    },
  });
  screenTitle.position.set(326, 62);
  const firstDesk = plan.desks[0]!;
  const room = new Container();
  room.addChild(
    floor,
    walls,
    planningRoom(plan.planningRoom),
    testRoom(plan.testRoom),
    screen,
    screenTitle,
    label("자리", firstDesk.x - 8, firstDesk.y - 100, OFFICE_PALETTE.labelMuted),
    pantry(plan.pantry),
    myDeskZone(plan.myDeskZone),
    entrance(plan.entrance),
  );
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
  for (const [px, py] of points) {
    graphics.rect(59 + px! * 4, -16 + py! * 3, 4, 3).fill(OFFICE_PALETTE.screenFrame);
  }
}

/** 책상 하나 (유리 칸막이, 모니터, 의자). 모니터 색은 담당 동료의 런타임 색 */
export function desk(x: number, y: number, model?: Agent["model"]): Container {
  const screenColor = model ? RUNTIME[model].color : OFFICE_PALETTE.furnitureLine;
  const shape = new Graphics()
    .rect(-11, -30, 3, 72)
    .fill({ color: OFFICE_PALETTE.glass, alpha: 0.3 })
    .rect(132, -30, 3, 72)
    .fill({ color: OFFICE_PALETTE.glass, alpha: 0.3 });
  furniture(shape, 0, 0, 124, 42);
  shape
    .rect(0, 0, 124, INNER_WALL_WIDTH)
    .fill(OFFICE_PALETTE.wall)
    .roundRect(40, -23, 46, 28, 3)
    .fill(OFFICE_PALETTE.screenFrame)
    .rect(45, -18, 36, 18)
    .fill(screenColor)
    .circle(62, 64, 11)
    .fill(OFFICE_PALETTE.chair);
  if (model) drawMonitorGlyph(shape, model);
  const item = new Container();
  item.addChild(shape);
  item.position.set(x, y);
  return item;
}
