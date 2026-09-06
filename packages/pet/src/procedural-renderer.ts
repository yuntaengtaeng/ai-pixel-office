import type { PetDesign } from "./catalog.ts";

export type PixelPlotter = (
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) => void;

/** PetDesign 데이터만으로 픽셀을 좌표 기반으로 그리는 절차적 렌더러 */
export function plotPet(pet: PetDesign, plot: PixelPlotter): void {
  const dark = "#31313a";
  const light = pet.secondary;
  const isCat = pet.species === "cat";

  if (pet.species === "rabbit") {
    plot(5, 0, 2, 6, pet.body);
    plot(10, 0, 2, 6, pet.body);
    plot(6, 1, 1, 4, pet.secondary);
    plot(10, 1, 1, 4, pet.secondary);
  }

  plot(5, 4, 7, 6, pet.body);
  plot(4, 9, 9, 6, pet.body);
  plot(5, 14, 3, 2, pet.body);
  plot(10, 14, 3, 2, pet.body);

  if (pet.species === "rabbit") {
    // 긴 귀는 몸통보다 먼저 그려 위쪽 실루엣을 유지
  } else if (pet.ear === "point") {
    plot(5, 2, 2, 3, pet.body);
    plot(10, 2, 2, 3, pet.body);
    plot(5, 2, 1, 1, light);
    plot(11, 2, 1, 1, light);
  } else if (pet.ear === "floppy") {
    plot(3, 4, 3, 5, pet.secondary);
    plot(11, 4, 3, 5, pet.secondary);
  } else {
    plot(4, 3, 3, 3, pet.body);
    plot(10, 3, 3, 3, pet.body);
  }

  if (pet.species === "rabbit") {
    plot(12, 11, 3, 3, pet.secondary);
  } else if (pet.species === "capybara") {
    plot(12, 10, 4, 3, pet.body);
    plot(13, 9, 3, 2, pet.body);
    plot(14, 11, 1, 1, dark);
    plot(7, 1, 3, 2, pet.accent);
    plot(8, 0, 2, 1, pet.accent);
  } else if (pet.species === "quokka") {
    plot(12, 10, 3, 3, pet.body);
    plot(13, 9, 2, 2, pet.body);
  } else if (isCat) {
    plot(13, 10, 2, 2, pet.body);
    plot(14, 8, 2, 3, pet.body);
  } else {
    plot(12, 10, 3, 2, pet.body);
    plot(14, 9, 2, 2, pet.body);
  }

  if (pet.pattern === "spots" || pet.pattern === "patches") {
    plot(6, 4, 2, 2, pet.secondary);
    plot(10, 10, 2, 3, pet.secondary);
    if (pet.pattern === "spots") plot(6, 12, 1, 1, pet.secondary);
  }
  if (pet.pattern === "stripes") {
    plot(6, 4, 1, 2, pet.secondary);
    plot(8, 3, 1, 2, pet.secondary);
    plot(10, 4, 1, 2, pet.secondary);
    plot(5, 10, 2, 1, pet.secondary);
    plot(10, 12, 2, 1, pet.secondary);
  }
  if (pet.pattern === "mask") {
    plot(5, 4, 3, 3, pet.secondary);
    plot(9, 4, 3, 3, pet.secondary);
  }
  if (pet.pattern === "tuxedo") {
    plot(7, 7, 3, 6, light);
    plot(6, 13, 5, 2, light);
  }
  if (pet.pattern === "points") {
    plot(7, 7, 3, 2, light);
    plot(5, 14, 2, 1, light);
    plot(11, 14, 2, 1, light);
  }
  if (pet.pattern === "blaze") {
    plot(8, 4, 2, 5, light);
    plot(7, 11, 3, 3, light);
  }

  plot(6, 6, 1, 1, dark);
  plot(10, 6, 1, 1, dark);
  plot(8, 8, 2, 1, dark);
  plot(6, 9, 1, 1, isCat ? dark : pet.body);
  plot(10, 9, 1, 1, isCat ? dark : pet.body);

  if (pet.species === "rabbit") {
    plot(4, 8, 2, 1, "#ef8f9d");
    plot(11, 8, 2, 1, "#ef8f9d");
  }

  if (pet.species === "quokka") {
    plot(7, 9, 1, 1, dark);
    plot(9, 9, 1, 1, dark);
    plot(8, 10, 1, 1, dark);
  }

  for (const accessory of pet.accessories) {
    if (accessory === "collar") plot(5, 9, 7, 1, pet.accent);
    if (accessory === "tag") plot(8, 10, 2, 2, pet.accent);
    if (accessory === "scarf") {
      plot(4, 9, 9, 2, pet.accent);
      plot(10, 11, 2, 3, pet.accent);
    }
    if (accessory === "bow") {
      plot(5, 9, 3, 2, pet.accent);
      plot(10, 9, 3, 2, pet.accent);
      plot(8, 9, 2, 2, "#f2c65c");
    }
    if (accessory === "glasses") {
      plot(5, 5, 3, 2, dark);
      plot(9, 5, 3, 2, dark);
      plot(8, 5, 1, 1, dark);
      plot(6, 6, 1, 1, "#d8eff1");
      plot(10, 6, 1, 1, "#d8eff1");
    }
    if (accessory === "bandana") {
      plot(5, 9, 7, 2, pet.accent);
      plot(7, 11, 4, 2, pet.accent);
    }
    if (accessory === "crown") {
      plot(6, 1, 6, 2, pet.accent);
      plot(6, 0, 1, 2, pet.accent);
      plot(9, 0, 1, 2, pet.accent);
      plot(11, 0, 1, 2, pet.accent);
    }
    if (accessory === "flower") {
      plot(11, 3, 1, 3, pet.accent);
      plot(10, 4, 3, 1, pet.accent);
      plot(11, 4, 1, 1, "#f6d15f");
    }
  }
}
