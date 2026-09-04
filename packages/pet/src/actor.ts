import { getPet, type PetDesign } from "./catalog.ts";

export type PetPosition = Readonly<{
  x: number;
  y: number;
}>;

export type PetDirection = "left" | "right";
export type PetMotion = "idle" | "moving";

export type PetActorSnapshot = Readonly<{
  design: PetDesign;
  position: PetPosition;
  direction: PetDirection;
  motion: PetMotion;
}>;

export type CreatePetOptions = Readonly<{
  designId?: string;
  fallbackIndex?: number;
  position?: PetPosition;
  speedPxPerSecond?: number;
}>;

const DEFAULT_SPEED_PX_PER_SECOND = 48;

/** 렌더러와 독립된 펫 이동 상태 */
export class PetActor {
  readonly design: PetDesign;
  readonly speedPxPerSecond: number;

  #position: PetPosition;
  #target: PetPosition | null = null;
  #direction: PetDirection = "right";

  constructor({
    designId,
    fallbackIndex = 0,
    position = { x: 0, y: 0 },
    speedPxPerSecond = DEFAULT_SPEED_PX_PER_SECOND,
  }: CreatePetOptions = {}) {
    if (!Number.isFinite(speedPxPerSecond) || speedPxPerSecond <= 0) {
      throw new RangeError("speedPxPerSecond must be greater than zero");
    }

    this.design = getPet(designId, fallbackIndex);
    this.speedPxPerSecond = speedPxPerSecond;
    this.#position = { ...position };
  }

  /** 지정 위치로 이동 시작 */
  move(target: PetPosition): void {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) {
      throw new RangeError("target position must contain finite coordinates");
    }

    if (target.x !== this.#position.x) {
      this.#direction = target.x < this.#position.x ? "left" : "right";
    }
    this.#target = { ...target };
  }

  /** 현재 위치에서 이동 중지 */
  stop(): void {
    this.#target = null;
  }

  /** 경과 시간 기준 이동 상태 갱신 */
  tick(deltaMs: number): PetActorSnapshot {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError("deltaMs must be a finite non-negative number");
    }
    if (this.#target === null || deltaMs === 0) return this.snapshot();

    const deltaX = this.#target.x - this.#position.x;
    const deltaY = this.#target.y - this.#position.y;
    const distance = Math.hypot(deltaX, deltaY);
    const travelDistance = (this.speedPxPerSecond * deltaMs) / 1000;

    if (distance <= travelDistance) {
      this.#position = this.#target;
      this.#target = null;
      return this.snapshot();
    }

    const ratio = travelDistance / distance;
    this.#position = {
      x: this.#position.x + deltaX * ratio,
      y: this.#position.y + deltaY * ratio,
    };
    return this.snapshot();
  }

  /** 외부 렌더러용 불변 상태 조회 */
  snapshot(): PetActorSnapshot {
    return {
      design: this.design,
      position: { ...this.#position },
      direction: this.#direction,
      motion: this.#target === null ? "idle" : "moving",
    };
  }
}

/** 렌더러와 독립된 펫 생성 */
export const createPet = (options?: CreatePetOptions): PetActor => new PetActor(options);
