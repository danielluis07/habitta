import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Room = { label: string; x: number; y: number; width: number; height: number; outdoor?: boolean };
type Diagram = { slug: string; residence: string; note: string; rooms: Room[] };

const diagrams: Diagram[] = [
  {
    slug: "crest",
    residence: "Horizon",
    note: "South-facing loggia · level 10",
    rooms: [
      { label: "Kitchen + dining", x: 100, y: 190, width: 330, height: 190 },
      { label: "Services", x: 430, y: 190, width: 300, height: 120 },
      { label: "Bedroom 2", x: 730, y: 190, width: 370, height: 190 },
      { label: "Living", x: 100, y: 380, width: 330, height: 190 },
      { label: "Hall + entry", x: 430, y: 310, width: 300, height: 260 },
      { label: "Main bedroom", x: 730, y: 380, width: 370, height: 190 },
      { label: "Recessed loggia", x: 100, y: 570, width: 330, height: 120, outdoor: true },
    ],
  },
  {
    slug: "contour",
    residence: "Terrace",
    note: "South terrace · western end · level 2",
    rooms: [
      { label: "Bedroom 2", x: 100, y: 190, width: 215, height: 140 },
      { label: "Bedroom 3", x: 100, y: 330, width: 215, height: 140 },
      { label: "Services", x: 315, y: 190, width: 390, height: 115 },
      { label: "Hall + entry", x: 315, y: 305, width: 390, height: 165 },
      { label: "Kitchen + dining", x: 705, y: 190, width: 395, height: 200 },
      { label: "Living", x: 100, y: 470, width: 605, height: 130 },
      { label: "Main bedroom", x: 705, y: 390, width: 395, height: 210 },
      { label: "Deep south terrace", x: 100, y: 600, width: 1000, height: 90, outdoor: true },
    ],
  },
  {
    slug: "grove",
    residence: "Garden",
    note: "Court-facing patio · ground floor",
    rooms: [
      { label: "Private patio", x: 100, y: 340, width: 200, height: 280, outdoor: true },
      { label: "Kitchen", x: 300, y: 190, width: 280, height: 150 },
      { label: "Services", x: 580, y: 190, width: 230, height: 150 },
      { label: "Bedroom 2", x: 810, y: 190, width: 290, height: 210 },
      { label: "Living + dining", x: 300, y: 340, width: 280, height: 280 },
      { label: "Hall + entry", x: 580, y: 340, width: 230, height: 280 },
      { label: "Main bedroom", x: 810, y: 400, width: 290, height: 220 },
    ],
  },
];

function render({ residence, note, rooms }: Diagram): string {
  const roomMarkup = rooms.map(({ label, x, y, width, height, outdoor }) => `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${outdoor ? "#DCE0D3" : "#FBF9F5"}" stroke="#1F1D1A" stroke-width="3"/>
    <text x="${x + width / 2}" y="${y + height / 2 + 7}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#1F1D1A">${label}</text>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="Schematic arrangement of the ${residence} residence">
  <rect width="1200" height="800" fill="#F4F1EA"/>
  <text x="100" y="90" font-family="Georgia, serif" font-size="40" fill="#1F1D1A">${residence}</text>
  <text x="100" y="130" font-family="Arial, sans-serif" font-size="17" fill="#5E5850">${note}</text>
  <text x="1060" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#1F1D1A">N ↑</text>
${roomMarkup}
  <text x="100" y="750" font-family="Arial, sans-serif" font-size="16" fill="#5E5850">SCHEMATIC · NOT TO SCALE</text>
</svg>`;
}

for (const diagram of diagrams) {
  const directory = join(import.meta.dir, "..", "public", "concepts", diagram.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${diagram.slug}-diagram-r1.svg`), render(diagram));
}
