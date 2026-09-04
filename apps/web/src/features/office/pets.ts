export type PetSpecies = "dog" | "cat";
export type EarShape = "point" | "floppy" | "round";
export type Pattern =
  "solid" | "spots" | "stripes" | "mask" | "tuxedo" | "patches" | "points" | "blaze";
export type Accessory =
  "collar" | "tag" | "scarf" | "bow" | "glasses" | "bandana" | "crown" | "flower";

export type PetDesign = {
  id: string;
  species: PetSpecies;
  breed: string;
  name: string;
  body: string;
  secondary: string;
  accent: string;
  ear: EarShape;
  pattern: Pattern;
  accessories: Accessory[];
};

export const PETS: PetDesign[] = [
  {
    id: "dog-shiba",
    species: "dog",
    breed: "시바견",
    name: "단풍",
    body: "#c8793b",
    secondary: "#fff0cf",
    accent: "#df5252",
    ear: "point",
    pattern: "points",
    accessories: ["bandana", "tag"],
  },
  {
    id: "dog-dalmatian",
    species: "dog",
    breed: "달마시안",
    name: "도트",
    body: "#f5f0df",
    secondary: "#292c38",
    accent: "#e8505b",
    ear: "floppy",
    pattern: "spots",
    accessories: ["collar", "tag"],
  },
  {
    id: "dog-beagle",
    species: "dog",
    breed: "비글",
    name: "호두",
    body: "#b96d38",
    secondary: "#f6e7c5",
    accent: "#4b77be",
    ear: "floppy",
    pattern: "patches",
    accessories: ["collar", "tag"],
  },
  {
    id: "dog-poodle",
    species: "dog",
    breed: "푸들",
    name: "모카",
    body: "#8b553f",
    secondary: "#d8a878",
    accent: "#ee8caf",
    ear: "round",
    pattern: "solid",
    accessories: ["bow", "collar"],
  },
  {
    id: "dog-corgi",
    species: "dog",
    breed: "웰시코기",
    name: "버터",
    body: "#d99145",
    secondary: "#fff2ce",
    accent: "#55a68c",
    ear: "point",
    pattern: "blaze",
    accessories: ["scarf", "tag"],
  },
  {
    id: "dog-schnauzer",
    species: "dog",
    breed: "슈나우저",
    name: "후추",
    body: "#777b83",
    secondary: "#d5d3ca",
    accent: "#df9d45",
    ear: "round",
    pattern: "blaze",
    accessories: ["glasses", "bow"],
  },
  {
    id: "dog-retriever",
    species: "dog",
    breed: "골든리트리버",
    name: "햇살",
    body: "#dba95c",
    secondary: "#ffe2a3",
    accent: "#579b68",
    ear: "floppy",
    pattern: "solid",
    accessories: ["collar", "flower"],
  },
  {
    id: "dog-husky",
    species: "dog",
    breed: "허스키",
    name: "설이",
    body: "#707786",
    secondary: "#ecf0ef",
    accent: "#579bd3",
    ear: "point",
    pattern: "mask",
    accessories: ["scarf", "tag"],
  },
  {
    id: "dog-collie",
    species: "dog",
    breed: "보더콜리",
    name: "구름",
    body: "#292e39",
    secondary: "#f2eee2",
    accent: "#d95858",
    ear: "point",
    pattern: "blaze",
    accessories: ["bandana", "flower"],
  },
  {
    id: "dog-maltese",
    species: "dog",
    breed: "말티즈",
    name: "솜이",
    body: "#f3f0e9",
    secondary: "#d9dce1",
    accent: "#e986ad",
    ear: "round",
    pattern: "solid",
    accessories: ["bow", "collar", "tag"],
  },
  {
    id: "cat-orange-tabby",
    species: "cat",
    breed: "치즈태비",
    name: "치즈",
    body: "#e39842",
    secondary: "#ffe2a4",
    accent: "#4c9c73",
    ear: "point",
    pattern: "stripes",
    accessories: ["collar", "tag"],
  },
  {
    id: "cat-tuxedo",
    species: "cat",
    breed: "턱시도",
    name: "연미",
    body: "#272c36",
    secondary: "#f2eee2",
    accent: "#d75b68",
    ear: "point",
    pattern: "tuxedo",
    accessories: ["bow", "tag"],
  },
  {
    id: "cat-siamese",
    species: "cat",
    breed: "샴",
    name: "라떼",
    body: "#ead6ad",
    secondary: "#65564f",
    accent: "#5d9bcf",
    ear: "point",
    pattern: "points",
    accessories: ["collar", "tag"],
  },
  {
    id: "cat-russian-blue",
    species: "cat",
    breed: "러시안블루",
    name: "안개",
    body: "#78838e",
    secondary: "#aeb7bc",
    accent: "#dfaa4b",
    ear: "point",
    pattern: "solid",
    accessories: ["scarf", "flower"],
  },
  {
    id: "cat-calico",
    species: "cat",
    breed: "삼색이",
    name: "송이",
    body: "#f2ead7",
    secondary: "#d47d43",
    accent: "#e3819c",
    ear: "point",
    pattern: "patches",
    accessories: ["collar", "flower"],
  },
  {
    id: "cat-black",
    species: "cat",
    breed: "블랙캣",
    name: "밤이",
    body: "#252938",
    secondary: "#60677b",
    accent: "#b688df",
    ear: "point",
    pattern: "solid",
    accessories: ["collar", "tag", "crown"],
  },
  {
    id: "cat-white",
    species: "cat",
    breed: "터키시앙고라",
    name: "소금",
    body: "#f6f2e9",
    secondary: "#dbe5e8",
    accent: "#e7b54d",
    ear: "point",
    pattern: "solid",
    accessories: ["crown", "collar"],
  },
  {
    id: "cat-brown-tabby",
    species: "cat",
    breed: "고등어태비",
    name: "보리",
    body: "#9b7c5d",
    secondary: "#d6bd90",
    accent: "#507f95",
    ear: "point",
    pattern: "stripes",
    accessories: ["glasses", "bandana"],
  },
  {
    id: "cat-ragdoll",
    species: "cat",
    breed: "랙돌",
    name: "마시멜로",
    body: "#eee3cf",
    secondary: "#8b8491",
    accent: "#7aa6d3",
    ear: "point",
    pattern: "mask",
    accessories: ["bow", "tag"],
  },
  {
    id: "cat-bicolor",
    species: "cat",
    breed: "브리티시숏헤어",
    name: "자갈",
    body: "#8e98a5",
    secondary: "#f1eee6",
    accent: "#dc775f",
    ear: "round",
    pattern: "tuxedo",
    accessories: ["bandana", "collar", "tag"],
  },
];

export type PixelPlotter = (
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) => void;

export function getPet(id?: string, fallbackIndex = 0): PetDesign {
  return PETS.find((pet) => pet.id === id) ?? PETS[Math.abs(fallbackIndex) % PETS.length]!;
}

export function plotPet(pet: PetDesign, plot: PixelPlotter): void {
  const dark = "#31313a";
  const light = pet.secondary;
  const isCat = pet.species === "cat";

  plot(5, 4, 7, 6, pet.body);
  plot(4, 9, 9, 6, pet.body);
  plot(5, 14, 3, 2, pet.body);
  plot(10, 14, 3, 2, pet.body);

  if (pet.ear === "point") {
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

  if (isCat) {
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
