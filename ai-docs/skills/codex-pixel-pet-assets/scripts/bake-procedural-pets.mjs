import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const gallery = resolve(root, "packages/pet/pet-gallery-preview.html");
const outputDirectories = [
  resolve(root, "packages/pet/assets/baked"),
  resolve(root, "apps/web/public/pets/baked"),
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file:///${gallery.replaceAll("\\", "/")}`);
const assets = await page.evaluate(() => {
  const pets = window.PET_CATALOG;
  return pets.map((pet) => {
    const canvas = document.createElement("canvas");
    canvas.width = 54;
    canvas.height = 54;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    window.plotPet(pet, (x, y, width, height, color) => {
      context.fillStyle = color;
      context.fillRect((x + 1) * 3, (y + 1) * 3, width * 3, height * 3);
    });
    return { id: pet.id, dataUrl: canvas.toDataURL("image/png") };
  });
});
await browser.close();

for (const directory of outputDirectories) await mkdir(directory, { recursive: true });
for (const asset of assets) {
  const data = Buffer.from(asset.dataUrl.slice("data:image/png;base64,".length), "base64");
  for (const directory of outputDirectories) await writeFile(resolve(directory, `${asset.id}.png`), data);
}
console.log(`Baked ${assets.length} procedural pets`);
