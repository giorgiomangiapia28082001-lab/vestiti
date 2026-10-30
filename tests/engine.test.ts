import { describe, expect, it } from "vitest";
import { analyzeColors } from "@/lib/engine/color";
import { generateCandidates, rankAlternatives, validateItemIds } from "@/lib/engine/generate";
import { explainOutfit } from "@/lib/engine/explain";
import type { EngineItem } from "@/lib/engine/types";
import { generateRequestSchema } from "@/lib/schemas";

let n = 0;
function item(p: Partial<EngineItem> & Pick<EngineItem, "category" | "slot">): EngineItem {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name: `Capo ${n}`,
    subcategory: null,
    primary_color: "black",
    secondary_colors: [],
    material: null,
    pattern: "solid",
    seasons: [],
    styles: [],
    fit: null,
    formality: 2,
    is_favorite: false,
    wear_count: 0,
    last_worn_at: null,
    ...p,
  };
}

const wardrobe: EngineItem[] = [
  item({ name: "T-shirt bianca", category: "tshirt_polo", slot: "top", primary_color: "white", styles: ["casual", "minimal"], seasons: ["spring", "summer"] }),
  item({ name: "Camicia oxford azzurra", category: "shirt", slot: "top", primary_color: "light_blue", formality: 3, styles: ["smart_casual"] }),
  item({ name: "Maglione in lana blu", category: "knitwear", slot: "top", primary_color: "navy", material: "lana", seasons: ["autumn", "winter"], styles: ["smart_casual", "old_money"] }),
  item({ name: "Jeans scuri", category: "trousers", slot: "bottom", primary_color: "denim", styles: ["casual"] }),
  item({ name: "Chino beige", category: "trousers", slot: "bottom", primary_color: "beige", formality: 3, styles: ["smart_casual", "old_money"] }),
  item({ name: "Shorts kaki", category: "shorts", slot: "bottom", primary_color: "olive", formality: 1, seasons: ["summer"] }),
  item({ name: "Sneakers bianche", category: "shoes", slot: "shoes", primary_color: "white", styles: ["casual", "minimal"] }),
  item({ name: "Mocassini marroni", category: "shoes", slot: "shoes", primary_color: "brown", formality: 4, styles: ["old_money", "elegant"] }),
  item({ name: "Cappotto cammello", category: "outerwear", slot: "outer", primary_color: "camel", formality: 4, seasons: ["autumn", "winter"], styles: ["elegant", "old_money"] }),
  item({ name: "Orologio", category: "accessories", slot: "accessory", primary_color: "grey", formality: 3 }),
];
const byId = new Map(wardrobe.map((i) => [i.id, i]));

describe("analyzeColors", () => {
  it("premia un solo accento su neutri rispetto a molti accenti", () => {
    const accent = analyzeColors([
      { primary_color: "red", slot: "top" },
      { primary_color: "navy", slot: "bottom" },
      { primary_color: "white", slot: "shoes" },
    ]);
    const busy = analyzeColors([
      { primary_color: "red", slot: "top" },
      { primary_color: "green", slot: "bottom" },
      { primary_color: "purple", slot: "shoes" },
    ]);
    expect(accent.score).toBeGreaterThan(busy.score);
    expect(accent.kind).toBe("accent");
    expect(busy.kind).toBe("busy");
  });

  it("penalizza più fantasie vistose", () => {
    const one = analyzeColors([{ primary_color: "navy", pattern: "checked" }, { primary_color: "beige" }]);
    const two = analyzeColors([{ primary_color: "navy", pattern: "checked" }, { primary_color: "beige", pattern: "floral" }]);
    expect(one.score).toBeGreaterThan(two.score);
  });
});

describe("generateCandidates", () => {
  it("usa solo capi esistenti e struttura completa", () => {
    const req = generateRequestSchema.parse({ occasion: "everyday", season: "spring", count: 3 });
    const { candidates } = generateCandidates(wardrobe, { request: req });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      for (const p of c.pieces) expect(byId.has(p.item_id)).toBe(true);
      const roles = c.pieces.map((p) => p.role);
      expect(roles.filter((r) => r === "bottom").length).toBe(1);
      expect(roles).toContain("shoes");
    }
  });

  it("in inverno esclude i pantaloncini e aggiunge il capospalla", () => {
    const req = generateRequestSchema.parse({ occasion: "work", season: "winter", temperature: 3, count: 3 });
    const { candidates } = generateCandidates(wardrobe, { request: req });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      const names = c.items.map((i) => i.name);
      expect(names).not.toContain("Shorts kaki");
      expect(c.pieces.some((p) => p.role === "outer")).toBe(true);
    }
  });

  it("rispetta capi obbligatori ed esclusi", () => {
    const jeans = wardrobe.find((i) => i.name === "Jeans scuri")!;
    const sneakers = wardrobe.find((i) => i.name === "Sneakers bianche")!;
    const req = generateRequestSchema.parse({
      occasion: "everyday",
      season: "spring",
      include_item_ids: [jeans.id],
      exclude_item_ids: [sneakers.id],
    });
    const { candidates } = generateCandidates(wardrobe, { request: req });
    for (const c of candidates) {
      const ids = c.pieces.map((p) => p.item_id);
      expect(ids).toContain(jeans.id);
      expect(ids).not.toContain(sneakers.id);
    }
  });

  it("segnala quando mancano le scarpe", () => {
    const noShoes = wardrobe.filter((i) => i.slot !== "shoes");
    const req = generateRequestSchema.parse({ occasion: "everyday", season: "spring" });
    const { candidates, notices } = generateCandidates(noShoes, { request: req });
    expect(candidates.length).toBeGreaterThan(0);
    expect(notices.join(" ")).toMatch(/scarpe/);
  });

  it("produce testi esplicativi", () => {
    const req = generateRequestSchema.parse({ occasion: "date", season: "autumn" });
    const { candidates } = generateCandidates(wardrobe, { request: req });
    const text = explainOutfit(candidates[0].pieces, byId, req);
    expect(text.name.length).toBeGreaterThan(3);
    expect(text.tips.length).toBeGreaterThanOrEqual(2);
  });
});

describe("validateItemIds", () => {
  const allowed = byId;
  it("rifiuta identificativi inventati", () => {
    const res = validateItemIds(["inventato"], allowed);
    expect(res.ok).toBe(false);
  });

  it("assegna lo strato intermedio al capo in maglia", () => {
    const shirt = wardrobe.find((i) => i.category === "shirt")!;
    const knit = wardrobe.find((i) => i.category === "knitwear")!;
    const chino = wardrobe.find((i) => i.name === "Chino beige")!;
    const res = validateItemIds([knit.id, shirt.id, chino.id], allowed);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.pieces.find((p) => p.item_id === knit.id)?.role).toBe("mid");
      expect(res.pieces.find((p) => p.item_id === shirt.id)?.role).toBe("top");
    }
  });

  it("rifiuta outfit senza parte inferiore", () => {
    const shirt = wardrobe.find((i) => i.category === "shirt")!;
    expect(validateItemIds([shirt.id], allowed).ok).toBe(false);
  });
});

describe("rankAlternatives", () => {
  it("propone solo capi dello stesso tipo", () => {
    const req = generateRequestSchema.parse({ occasion: "everyday", season: "spring" });
    const { candidates } = generateCandidates(wardrobe, { request: req });
    const shoesPiece = candidates[0].pieces.find((p) => p.role === "shoes")!;
    const alts = rankAlternatives(candidates[0].pieces, shoesPiece.item_id, wardrobe, { request: req });
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) expect(a.item.slot).toBe("shoes");
  });
});

describe("acceptAiOutfits", () => {
  it("scarta capi inventati, strutture non valide e duplicati", async () => {
    const { acceptAiOutfits } = await import("@/lib/engine/accept-ai");
    const { buildAffinity } = await import("@/lib/engine/score");
    const req = generateRequestSchema.parse({ occasion: "work", season: "autumn" });
    const shirt = wardrobe.find((i) => i.category === "shirt")!;
    const chino = wardrobe.find((i) => i.name === "Chino beige")!;
    const loafers = wardrobe.find((i) => i.name === "Mocassini marroni")!;
    const base = { name: "Prova", description: "d", color_story: "c", tips: ["t"] };
    const result = acceptAiOutfits(
      {
        outfits: [
          { ...base, item_ids: [shirt.id, chino.id, loafers.id] },
          { ...base, item_ids: [loafers.id, chino.id, shirt.id] }, // duplicato
          { ...base, item_ids: [shirt.id, "giacca-inventata", chino.id] },
          { ...base, item_ids: [shirt.id, loafers.id] }, // manca la parte inferiore
        ],
        missing: [],
      },
      { allowed: byId, byId, ctx: { request: req }, affinity: buildAffinity() },
    );
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("ai");
    expect(result[0].pieces.map((p) => p.item_id).sort()).toEqual([shirt.id, chino.id, loafers.id].sort());
  });
});
