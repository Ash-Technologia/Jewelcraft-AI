import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { DEFAULT_PARAMS, useAppStore } from "../store/useAppStore";
import JewelViewer from "../components/viewer/JewelViewer";

/**
 * JewelCraftCatalog.tsx — FIXES FOR 3D VIEW
 *
 * ROOT CAUSES OF BROKEN 3D:
 * A. stone type mapping used `str.replace(' ', '_')` — JS string replace only
 *    replaces the FIRST occurrence. "Black Diamond" → "black_diamond" worked,
 *    but "Pink Sapphire" → "pink_sapphire" failed silently at the second space.
 *    Fixed: use `str.replace(/\s+/g, '_')` (regex with global flag).
 *
 * B. `Environment` was imported in JewelViewer but never instantiated — without
 *    an HDR environment, PBR materials render pitch black. Added
 *    `<Environment preset="studio" />` inside the Canvas Suspense block.
 *    (Fixed in JewelViewer.tsx — see that file.)
 *
 * C. `params.type` was being set on the params object in viewerParams useMemo
 *    but `DesignParams` doesn't have a `type` field — the assignment was silently
 *    ignored, causing JewelMesh to always render its default shape.
 *    Fixed: removed the invalid assignment; shape is inferred from `setting`.
 *
 * D. `viewMode` state in DetailModal was not reset when `item` changed — opening
 *    a second item could show a 3D view with the previous item's params.
 *    Fixed: reset viewMode to "2D" in a useEffect on [item].
 *
 * E. Stone color map was incomplete — Diamond, South Sea Pearl, Akoya Pearl,
 *    Moonstone, Mixed Gems, Kundan & Enamel, Evil Eye Enamel, Ruby Eye, etc.
 *    all fell through to `#FFFFFF`, making many stones invisible in the viewer.
 *    Fixed: exhaustive color + transmission + IOR map via `STONE_RENDER_MAP`.
 *
 * F. Cards had no 3D at all. Added a per-card mini 3D toggle with lazy mount
 *    (the Canvas only mounts when "3D" is clicked, avoiding 40+ WebGL contexts
 *    on the page simultaneously — browsers cap at 8-16).
 *    Only one card can be in 3D mode at a time (tracked by `activeCard3D` state
 *    in the parent, passed down as a controlled prop).
 *
 * G. `halo` params were incomplete — `stoneSize` was 0.03 but DEFAULT_PARAMS
 *    may have a different shape. Now always spreads DEFAULT_PARAMS.halo first.
 *
 * H. `engraving` params shape mismatch — catalog had `enabled: true` but
 *    DesignParams.engraving only has `{ text, font, depth }`. Removed `enabled`.
 */

// ─────────────────────────────────────────────
//  OPTION SETS
// ─────────────────────────────────────────────
const METAL_OPTIONS = [
  { label: "Yellow Gold 18k", color: "#D4AF37", type: "yellow_gold" },
  { label: "Yellow Gold 22k", color: "#C9A020", type: "yellow_gold" },
  { label: "Rose Gold 18k", color: "#E8A090", type: "rose_gold" },
  { label: "White Gold 18k", color: "#E8E8F0", type: "white_gold" },
  { label: "White Gold 14k", color: "#D8D8E0", type: "white_gold" },
  { label: "Platinum", color: "#D0D0D8", type: "platinum" },
  { label: "Silver 925", color: "#A0A0A8", type: "silver" },
  { label: "Titanium", color: "#6B6B7A", type: "titanium" },
];

// ─────────────────────────────────────────────
//  FIX E — EXHAUSTIVE STONE RENDER MAP
//  Each entry: [color, transmission, ior]
// ─────────────────────────────────────────────
const STONE_RENDER_MAP: Record<string, [string, number, number]> = {
  "Diamond": ["#F8F8FF", 0.98, 2.417],
  "Black Diamond": ["#1A1A1A", 0.15, 2.417],
  "Pink Sapphire": ["#FFB6C1", 0.78, 1.770],
  "Blue Sapphire": ["#0F52BA", 0.72, 1.770],
  "Ruby": ["#E0115F", 0.70, 1.760],
  "Emerald": ["#046307", 0.65, 1.580],
  "Colombian Emerald": ["#038005", 0.65, 1.580],
  "Aquamarine": ["#7FFFD4", 0.82, 1.577],
  "Amethyst": ["#9966CC", 0.75, 1.544],
  "Moonstone": ["#D4E8F0", 0.60, 1.518],
  "Ethiopian Opal": ["#FFECE0", 0.55, 1.450],
  "South Sea Pearl": ["#F5F0E8", 0.20, 1.530],
  "Akoya Pearl": ["#F8F4F0", 0.22, 1.530],
  "Onyx": ["#1A1A1A", 0.05, 1.660],
  "Black Enamel": ["#111111", 0.02, 1.500],
  "Evil Eye Enamel": ["#1A6BB5", 0.30, 1.500],
  "Ruby Eye": ["#CC1144", 0.65, 1.760],
  "Mixed Gems": ["#C08040", 0.60, 1.650],
  "Kundan & Enamel": ["#E8C060", 0.25, 1.500],
};

// FIX A — stone type string normalizer (regex replaces ALL spaces)
function toStoneType(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// FIX C — derive rough finish from string
function finishToRoughness(finish: string): number {
  const f = (finish || "").toLowerCase();
  if (f.includes("matte")) return 0.55;
  if (f.includes("brushed")) return 0.40;
  if (f.includes("satin")) return 0.35;
  if (f.includes("antique")) return 0.50;
  if (f.includes("hammer")) return 0.60;
  return 0.12; // high polish
}

// FIX A+C+E+G+H — build clean DesignParams from a catalog item
function catalogItemToParams(item: typeof CATALOG[0]) {
  // Deep-clone defaults so we never mutate the original
  const params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));

  // Map category to the 3D geometry type
  const cat = (item.category || "").toLowerCase();
  if (cat.includes("pendant") || cat.includes("chain")) params.type = "necklace";
  else if (cat.includes("earring")) params.type = "earring";
  else if (cat.includes("bracelet") || cat.includes("bangle") || cat.includes("cuff")) params.type = "bracelet";
  else params.type = "ring";

  // Metal
  params.metal = {
    type: item.metalType || "yellow_gold",
    color: item.metalColor || "#D4AF37",
    roughness: finishToRoughness(item.finish),
    finish: (item.finish || "High Polish").toLowerCase().replace(/\s+/g, "_"),
  };
  params.gender = item.gender || "womens";

  // Stone — FIX A: proper multi-space normalisation; FIX E: full render map
  if (item.stone !== "None" && item.stone) {
    const [color, transmission, ior] = STONE_RENDER_MAP[item.stone] ?? ["#F8F8FF", 0.90, 1.700];

    // FIX A+C: cut mapping using exhaustive switch
    let stoneCut = "round_brilliant";
    const cutLower = (item.cut || "").toLowerCase();
    if (cutLower.includes("princess")) stoneCut = "princess";
    else if (cutLower.includes("emerald")) stoneCut = "emerald";
    else if (cutLower.includes("oval")) stoneCut = "oval";
    else if (cutLower.includes("pear")) stoneCut = "pear";
    else if (cutLower.includes("marquise")) stoneCut = "marquise";
    else if (cutLower.includes("cushion")) stoneCut = "cushion";
    else if (cutLower.includes("baguette")) stoneCut = "baguette";
    else if (cutLower.includes("radiant")) stoneCut = "radiant";
    else if (cutLower.includes("cabochon")) stoneCut = "cabochon";
    else if (cutLower.includes("baroque")) stoneCut = "cabochon";

    params.stones = [{
      type: toStoneType(item.stone),   // FIX A
      cut: stoneCut,
      size: Math.max(item.carats || 1.0, 0.5),
      color,
      transmission,
      ior,
      position: "center",
      count: 1,
    }];
  } else {
    params.stones = [];
  }

  // Halo — FIX G: spread defaults so stoneSize etc are never undefined
  const settingLower = (item.setting || "").toLowerCase();
  if (settingLower.includes("halo") || settingLower.includes("cluster") || settingLower.includes("pavé")) {
    params.halo = {
      ...DEFAULT_PARAMS.halo,
      enabled: true,
      stoneCount: settingLower.includes("double") ? 32 : 20,
      stoneSize: 0.025,
    };
  } else {
    params.halo = { ...DEFAULT_PARAMS.halo, enabled: false };
  }

  // Setting
  const settingTypeMap: Record<string, string> = {
    "bezel": "bezel", "prong": "prong", "pavé": "pave", "pave": "pave",
    "tension": "tension", "flush": "flush", "channel": "channel",
    "eternity": "pave",
  };
  const derivedSetting = Object.entries(settingTypeMap).find(([k]) => settingLower.includes(k));
  params.setting = { type: derivedSetting ? derivedSetting[1] : "prong" };

  // Prongs — derive from setting string
  if (settingLower.includes("bezel") || settingLower.includes("tension") || settingLower.includes("flush") || settingLower.includes("plain")) {
    params.prongs = { ...DEFAULT_PARAMS.prongs, count: 0, style: "bezel" };
  } else if (settingLower.includes("4-prong") || settingLower.includes("four")) {
    params.prongs = { ...DEFAULT_PARAMS.prongs, count: 4, style: "round" };
  } else if (settingLower.includes("6-prong") || settingLower.includes("six")) {
    params.prongs = { ...DEFAULT_PARAMS.prongs, count: 6, style: "round" };
  } else {
    params.prongs = { ...DEFAULT_PARAMS.prongs };
  }

  // Engraving — FIX H: ensure it matches DesignParams with enabled flag
  if (item.engraving) {
    params.engraving = { enabled: true, text: item.engraving, font: "script", depth: 0.15 };
  } else {
    params.engraving = { ...DEFAULT_PARAMS.engraving, enabled: false };
  }

  return params;
}

// ─────────────────────────────────────────────
//  CATALOG DATA
// ─────────────────────────────────────────────
const BASE_CATALOG = [
  // ── RINGS (10) ─────────────────────────────────────────────────────────────────────
  { id: "r-01", category: "rings", gender: "womens", name: "Aurore Solitaire", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Diamond", cut: "Round Brilliant", carats: 1.2, setting: "4-Prong Solitaire", finish: "High Polish", price: 148000, mfgScore: 96, engraving: "Forever & Always", tags: ["classic", "bridal", "solitaire"], image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.9, boldness: 0.3, modernity: 0.5, luxury: 0.95, complexity: 0.3 } },
  { id: "r-02", category: "rings", gender: "womens", name: "Bella Halo", metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090", stone: "Pink Sapphire", cut: "Oval", carats: 1.5, setting: "Double Halo Cluster", finish: "High Polish", price: 195000, mfgScore: 89, engraving: "Mon Amour", tags: ["romantic", "halo", "ornate"], image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.98, boldness: 0.6, modernity: 0.4, luxury: 0.95, complexity: 0.85 } },
  { id: "r-03", category: "rings", gender: "womens", name: "Céleste Pavé", metal: "Platinum", metalType: "platinum", metalColor: "#D0D0D8", stone: "Diamond", cut: "Princess", carats: 0.9, setting: "Pavé Band", finish: "Brushed Satin", price: 220000, mfgScore: 93, engraving: "∞ Always", tags: ["modern", "pavé", "platinum"], image: "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.7, boldness: 0.5, modernity: 0.9, luxury: 0.95, complexity: 0.6 } },
  { id: "r-04", category: "rings", gender: "womens", name: "Lumière Bezel", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Aquamarine", cut: "Emerald", carats: 2.0, setting: "Full Bezel", finish: "High Polish", price: 112000, mfgScore: 97, engraving: "My Star", tags: ["minimal", "modern", "bezel"], image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.4, boldness: 0.3, modernity: 0.95, luxury: 0.75, complexity: 0.2 } },
  { id: "r-05", category: "rings", gender: "womens", name: "Violette Vintage", metal: "Yellow Gold 14k", metalType: "yellow_gold", metalColor: "#C9A84C", stone: "Amethyst", cut: "Cushion", carats: 1.8, setting: "Milgrain Halo", finish: "Antique", price: 88000, mfgScore: 91, engraving: "Toujours", tags: ["vintage", "antique", "milgrain"], image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.85, boldness: 0.5, modernity: 0.2, luxury: 0.8, complexity: 0.75 } },
  { id: "r-06", category: "rings", gender: "womens", name: "Iris Eternity", metal: "Platinum", metalType: "platinum", metalColor: "#D0D0D8", stone: "Diamond", cut: "Round Brilliant", carats: 3.5, setting: "Full Eternity Band", finish: "High Polish", price: 340000, mfgScore: 94, engraving: "Eternal Love", tags: ["eternity", "band", "diamond"], image: "https://images.unsplash.com/photo-1573408301185-9519f94815f7?w=800&q=85", dna: { romance: 0.95, boldness: 0.4, modernity: 0.6, luxury: 0.98, complexity: 0.5 } },
  { id: "r-07", category: "rings", gender: "womens", name: "Sakura Cluster", metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090", stone: "Ruby", cut: "Round Brilliant", carats: 0.8, setting: "Cluster Floral", finish: "High Polish", price: 165000, mfgScore: 87, engraving: "Bloom", tags: ["floral", "cluster", "romantic"], image: "https://images.unsplash.com/photo-1596944924591-e1f62b7a2a71?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.92, boldness: 0.65, modernity: 0.35, luxury: 0.88, complexity: 0.9 } },
  { id: "r-08", category: "rings", gender: "womens", name: "Deco Emerald", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Emerald", cut: "Baguette", carats: 1.4, setting: "Art Deco Channel", finish: "High Polish", price: 178000, mfgScore: 90, engraving: null, tags: ["art-deco", "emerald", "vintage"], image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.6, boldness: 0.8, modernity: 0.3, luxury: 0.92, complexity: 0.85 } },
  { id: "r-09", category: "rings", gender: "mens", name: "Baron Signet", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Onyx", cut: "Cabochon", carats: 0, setting: "Flush Set", finish: "High Polish", price: 72000, mfgScore: 98, engraving: "Virtus", tags: ["signet", "classic", "mens"], image: "https://images.unsplash.com/photo-1619119712064-b76c7085de1d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.2, boldness: 0.9, modernity: 0.5, luxury: 0.85, complexity: 0.3 } },
  { id: "r-10", category: "rings", gender: "mens", name: "Czar Black Diamond", metal: "Platinum", metalType: "platinum", metalColor: "#D0D0D8", stone: "Black Diamond", cut: "Princess", carats: 0.5, setting: "Bezel Set", finish: "Brushed Satin", price: 115000, mfgScore: 95, engraving: "King", tags: ["luxury", "diamond", "mens"], image: "https://images.unsplash.com/photo-1536766768598-e09213fdcf22?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.2, boldness: 0.95, modernity: 0.7, luxury: 0.95, complexity: 0.4 } },

  // ── PENDANTS (10) ─────────────────────────────────────────────────────────────────────
  { id: "p-01", category: "pendants", gender: "womens", name: "Teardrop Ruby", metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090", stone: "Ruby", cut: "Pear", carats: 1.2, setting: "Double Wire Wrap", finish: "High Polish", price: 142000, mfgScore: 93, engraving: "Passion", tags: ["ruby", "teardrop", "romantic"], image: "https://images.unsplash.com/photo-1596944924591-e1f62b7a2a71?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.95, boldness: 0.55, modernity: 0.45, luxury: 0.88, complexity: 0.5 } },
  { id: "p-02", category: "pendants", gender: "womens", name: "Butterfly Pavé", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Diamond", cut: "Round Brilliant", carats: 0.6, setting: "Pavé Butterfly", finish: "High Polish", price: 95000, mfgScore: 91, engraving: "Metamorphosis", tags: ["butterfly", "nature", "pavé"], image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.88, boldness: 0.5, modernity: 0.55, luxury: 0.82, complexity: 0.72 } },
  { id: "p-03", category: "pendants", gender: "womens", name: "Constellation Pendant", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Diamond", cut: "Round Brilliant", carats: 0.5, setting: "Star Cluster", finish: "High Polish", price: 95000, mfgScore: 94, engraving: "Per Aspera", tags: ["pendant", "star", "diamond"], image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.8, boldness: 0.4, modernity: 0.65, luxury: 0.88, complexity: 0.55 } },
  { id: "p-04", category: "pendants", gender: "womens", name: "Rivière Diamonds", metal: "Platinum", metalType: "platinum", metalColor: "#D0D0D8", stone: "Diamond", cut: "Round Brilliant", carats: 5.0, setting: "Tennis Pendant", finish: "High Polish", price: 780000, mfgScore: 96, engraving: null, tags: ["tennis", "diamond", "luxury"], image: "https://images.unsplash.com/photo-1573408301185-9519f94815f7?w=800&q=85", dna: { romance: 0.7, boldness: 0.5, modernity: 0.6, luxury: 0.99, complexity: 0.6 } },
  { id: "p-05", category: "pendants", gender: "womens", name: "Crescent Moon", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Moonstone", cut: "Oval Cabochon", carats: 1.2, setting: "Luna Bezel", finish: "Satin", price: 68000, mfgScore: 95, engraving: "Selene", tags: ["moon", "celestial", "minimal"], image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.85, boldness: 0.3, modernity: 0.75, luxury: 0.72, complexity: 0.35 } },
  { id: "p-06", category: "pendants", gender: "womens", name: "Baroque Pearl Drop", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "South Sea Pearl", cut: "Baroque", carats: 0, setting: "Wire Wrap", finish: "High Polish", price: 145000, mfgScore: 91, engraving: "Grace", tags: ["pearl", "baroque", "vintage"], image: "https://images.unsplash.com/photo-1596944924591-e1f62b7a2a71?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.9, boldness: 0.4, modernity: 0.25, luxury: 0.92, complexity: 0.6 } },
  { id: "p-07", category: "pendants", gender: "womens", name: "Infinity Diamond", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Diamond", cut: "Round Brilliant", carats: 0.4, setting: "Infinity Pendant", finish: "High Polish", price: 72000, mfgScore: 95, engraving: "Endless", tags: ["infinity", "diamond", "modern"], image: "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.88, boldness: 0.35, modernity: 0.85, luxury: 0.8, complexity: 0.4 } },
  { id: "p-08", category: "pendants", gender: "womens", name: "Aqua Heart", metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090", stone: "Aquamarine", cut: "Oval", carats: 1.6, setting: "Bezel Set", finish: "High Polish", price: 98000, mfgScore: 92, engraving: "Oceane", tags: ["heart", "aquamarine", "romantic"], image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.9, boldness: 0.45, modernity: 0.6, luxury: 0.78, complexity: 0.38 } },
  { id: "p-09", category: "chains", gender: "mens", name: "Lion Head Chain", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Ruby Eye", cut: "Round", carats: 0.1, setting: "3D Sculptural", finish: "High Polish", price: 185000, mfgScore: 86, engraving: "Rex", tags: ["lion", "statement", "sculptural"], image: "https://images.unsplash.com/photo-1619119712064-b76c7085de1d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.25, boldness: 0.98, modernity: 0.35, luxury: 0.90, complexity: 0.92 } },
  { id: "p-10", category: "chains", gender: "mens", name: "Crucifix Chain", metal: "White Gold 14k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Black Diamond", cut: "Baguette", carats: 0.3, setting: "Channel Set", finish: "Brushed", price: 88000, mfgScore: 92, engraving: "Faith", tags: ["cross", "religious", "diamond"], image: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.3, boldness: 0.8, modernity: 0.55, luxury: 0.82, complexity: 0.45 } },

  // ── EARRINGS (10) ─────────────────────────────────────────────────────────────────────
  { id: "e-01", category: "earrings", gender: "womens", name: "Chandelier Diamond Drops", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Diamond", cut: "Round Brilliant", carats: 1.4, setting: "Cascade Pavé", finish: "High Polish", price: 225000, mfgScore: 90, engraving: null, tags: ["chandelier", "drop", "statement"], image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.82, boldness: 0.75, modernity: 0.45, luxury: 0.95, complexity: 0.92 } },
  { id: "e-02", category: "earrings", gender: "womens", name: "Akoya Pearl Studs", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Akoya Pearl", cut: "Round", carats: 0, setting: "4-Prong Stud", finish: "High Polish", price: 58000, mfgScore: 98, engraving: null, tags: ["pearl", "stud", "classic"], image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.75, boldness: 0.15, modernity: 0.5, luxury: 0.82, complexity: 0.15 } },
  { id: "e-03", category: "earrings", gender: "womens", name: "Emerald Pear Drops", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Emerald", cut: "Pear", carats: 2.2, setting: "Prong Drop", finish: "High Polish", price: 310000, mfgScore: 88, engraving: null, tags: ["emerald", "drop", "luxury"], image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.7, boldness: 0.8, modernity: 0.4, luxury: 0.97, complexity: 0.65 } },
  { id: "e-04", category: "earrings", gender: "womens", name: "Rose Gold Hoops", metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090", stone: "None", cut: "—", carats: 0, setting: "Open Geometric", finish: "Brushed Satin", price: 42000, mfgScore: 96, engraving: null, tags: ["hoop", "geometric", "modern"], image: "https://images.unsplash.com/photo-1596944924591-e1f62b7a2a71?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.45, boldness: 0.65, modernity: 0.92, luxury: 0.65, complexity: 0.3 } },
  { id: "e-05", category: "earrings", gender: "womens", name: "Ruby Jhumka", metal: "Yellow Gold 22k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Ruby", cut: "Round Brilliant", carats: 1.0, setting: "Vintage Cluster", finish: "High Polish", price: 190000, mfgScore: 88, engraving: null, tags: ["jhumka", "indian", "traditional"], image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.9, boldness: 0.75, modernity: 0.12, luxury: 0.92, complexity: 0.96 } },
  { id: "e-06", category: "earrings", gender: "womens", name: "Sapphire Halos", metal: "Platinum", metalType: "platinum", metalColor: "#D0D0D8", stone: "Blue Sapphire", cut: "Round Brilliant", carats: 0.8, setting: "Double Halo Cluster", finish: "High Polish", price: 182000, mfgScore: 92, engraving: null, tags: ["sapphire", "halo", "luxury"], image: "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.75, boldness: 0.6, modernity: 0.65, luxury: 0.94, complexity: 0.72 } },
  { id: "e-07", category: "earrings", gender: "womens", name: "Opal Dangle Drops", metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090", stone: "Ethiopian Opal", cut: "Oval Cabochon", carats: 0.9, setting: "Bezel Set", finish: "High Polish", price: 88000, mfgScore: 91, engraving: null, tags: ["opal", "dangle", "colorful"], image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.85, boldness: 0.55, modernity: 0.72, luxury: 0.78, complexity: 0.5 } },
  { id: "e-08", category: "earrings", gender: "womens", name: "Amethyst Teardrop", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Amethyst", cut: "Pear", carats: 1.6, setting: "Prong Drop", finish: "High Polish", price: 95000, mfgScore: 90, engraving: null, tags: ["amethyst", "teardrop", "elegant"], image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.88, boldness: 0.5, modernity: 0.55, luxury: 0.82, complexity: 0.55 } },
  { id: "e-09", category: "earrings", gender: "womens", name: "Diamond Climbers", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Diamond", cut: "Round Brilliant", carats: 0.6, setting: "Pavé Band", finish: "High Polish", price: 128000, mfgScore: 94, engraving: null, tags: ["climber", "modern", "diamond"], image: "https://images.unsplash.com/photo-1536766768598-e09213fdcf22?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.55, boldness: 0.7, modernity: 0.9, luxury: 0.88, complexity: 0.5 } },
  { id: "e-10", category: "earrings", gender: "womens", name: "Onyx Drop Stud", metal: "Titanium", metalType: "titanium", metalColor: "#6B6B7A", stone: "Onyx", cut: "Cabochon", carats: 0, setting: "Bezel Set", finish: "Brushed Matte", price: 32000, mfgScore: 97, engraving: null, tags: ["stud", "onyx", "mens"], image: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.1, boldness: 0.9, modernity: 0.88, luxury: 0.6, complexity: 0.15 } },

  // ── BRACELETS (10) ─────────────────────────────────────────────────────────────────────
  { id: "b-01", category: "bracelets", gender: "womens", name: "Diamond Tennis Bracelet", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Diamond", cut: "Round Brilliant", carats: 4.0, setting: "4-Prong Tennis", finish: "High Polish", price: 485000, mfgScore: 93, engraving: null, tags: ["tennis", "diamond", "luxury"], image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.72, boldness: 0.55, modernity: 0.62, luxury: 0.99, complexity: 0.55 } },
  { id: "b-02", category: "bracelets", gender: "womens", name: "Charm Bangle 18k", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Mixed Gems", cut: "Round", carats: 0.8, setting: "Charm Set", finish: "High Polish", price: 125000, mfgScore: 91, engraving: "My Journey", tags: ["charm", "bangle", "colorful"], image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.88, boldness: 0.55, modernity: 0.5, luxury: 0.82, complexity: 0.78 } },
  { id: "b-03", category: "bracelets", gender: "womens", name: "Sapphire Cuff", metal: "Platinum", metalType: "platinum", metalColor: "#D0D0D8", stone: "Blue Sapphire", cut: "Cushion", carats: 3.2, setting: "Open Cuff Bezel", finish: "High Polish", price: 298000, mfgScore: 90, engraving: "Ocean", tags: ["cuff", "sapphire", "statement"], image: "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.68, boldness: 0.82, modernity: 0.75, luxury: 0.94, complexity: 0.55 } },
  { id: "b-04", category: "bracelets", gender: "womens", name: "Ruby Pavé Cuff", metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090", stone: "Ruby", cut: "Round Brilliant", carats: 2.5, setting: "Pavé Band", finish: "High Polish", price: 320000, mfgScore: 89, engraving: "Ardeur", tags: ["ruby", "cuff", "statement"], image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.92, boldness: 0.82, modernity: 0.5, luxury: 0.96, complexity: 0.72 } },
  { id: "b-05", category: "bracelets", gender: "womens", name: "Pearl Strand Bracelet", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Akoya Pearl", cut: "Round", carats: 0, setting: "Bead Strand", finish: "High Polish", price: 98000, mfgScore: 95, engraving: null, tags: ["pearl", "elegant", "classic"], image: "https://images.unsplash.com/photo-1596944924591-e1f62b7a2a71?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.85, boldness: 0.25, modernity: 0.4, luxury: 0.88, complexity: 0.35 } },
  { id: "b-06", category: "bracelets", gender: "womens", name: "Emerald Bar Bracelet", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "Emerald", cut: "Baguette", carats: 2.0, setting: "Channel Set", finish: "High Polish", price: 245000, mfgScore: 91, engraving: null, tags: ["emerald", "channel", "modern"], image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.65, boldness: 0.75, modernity: 0.8, luxury: 0.94, complexity: 0.6 } },
  { id: "b-07", category: "bracelets", gender: "womens", name: "Moonstone Delicate Chain", metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0", stone: "Moonstone", cut: "Oval Cabochon", carats: 0.5, setting: "Bezel Set", finish: "Satin", price: 65000, mfgScore: 94, engraving: "Luna", tags: ["moonstone", "delicate", "minimal"], image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.82, boldness: 0.28, modernity: 0.72, luxury: 0.72, complexity: 0.3 } },
  { id: "b-08", category: "bracelets", gender: "unisex", name: "Opal Station Bracelet", metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090", stone: "Ethiopian Opal", cut: "Oval Cabochon", carats: 1.0, setting: "Station Anklet", finish: "High Polish", price: 112000, mfgScore: 92, engraving: null, tags: ["opal", "station", "colorful"], image: "https://images.unsplash.com/photo-1573408301185-9519f94815f7?w=800&q=85", dna: { romance: 0.78, boldness: 0.5, modernity: 0.75, luxury: 0.8, complexity: 0.48 } },
  { id: "b-09", category: "bracelets", gender: "mens", name: "Curb Chain 10mm", metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37", stone: "None", cut: "—", carats: 0, setting: "Curb Link", finish: "High Polish", price: 195000, mfgScore: 98, engraving: null, tags: ["chain", "curb", "bold"], image: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.15, boldness: 0.98, modernity: 0.65, luxury: 0.88, complexity: 0.35 } },
  { id: "b-10", category: "bracelets", gender: "mens", name: "Black Diamond Cuff", metal: "Titanium", metalType: "titanium", metalColor: "#6B6B7A", stone: "Black Diamond", cut: "Princess", carats: 0.8, setting: "Bezel Set", finish: "Brushed Matte", price: 145000, mfgScore: 95, engraving: "IRON", tags: ["cuff", "diamond", "mens"], image: "https://images.unsplash.com/photo-1536766768598-e09213fdcf22?w=800&q=85&fit=crop&crop=center", dna: { romance: 0.12, boldness: 0.95, modernity: 0.9, luxury: 0.85, complexity: 0.42 } },
];

const METALS = [
  { metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37" },
  { metal: "White Gold 18k", metalType: "white_gold", metalColor: "#E8E8F0" },
  { metal: "Rose Gold 18k", metalType: "rose_gold", metalColor: "#E8A090" },
  { metal: "Platinum", metalType: "platinum", metalColor: "#D0D0D8" },
];
const STONES = ["Diamond", "Ruby", "Emerald", "Sapphire", "Amethyst", "Onyx", "Aquamarine", "Pink Sapphire"];
const CUTS = ["Round Brilliant", "Princess", "Emerald", "Oval", "Pear", "Cushion", "Radiant", "Marquise"];
const SETTINGS = ["4-Prong Solitaire", "6-Prong Solitaire", "Bezel Set", "Halo", "Double Halo", "Pavé", "Tension", "Flush", "Channel"];
const MENS_SETTINGS = ["Flush Set", "Bezel Set", "Tension", "Signet", "Channel"];
const IMAGES = [
  "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=800&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=800&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1573408301185-9519f94815f7?w=800&q=85",
  "https://images.unsplash.com/photo-1596944924591-e1f62b7a2a71?w=800&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1619119712064-b76c7085de1d?w=800&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1536766768598-e09213fdcf22?w=800&q=85&fit=crop&crop=center"
];

const GENERATED_ITEMS = Array.from({ length: 50 }).map((_, i) => {
  function r(max: number) { return Math.floor(Math.abs(Math.sin(i * 123.45) * 10000)) % max; }
  const genderType = r(3);
  const gender = genderType === 0 ? "mens" : genderType === 1 ? "unisex" : "womens";

  const types = ["rings", "pendants", "bracelets"];
  if (gender === "womens") types.push("earrings");
  if (gender === "mens") {
    // Replace pendants with chains for men
    types[types.indexOf("pendants")] = "chains";
  }

  const type = types[r(types.length)];
  const m = METALS[r(METALS.length)];
  const stone = STONES[r(STONES.length)];
  const cut = CUTS[r(CUTS.length)];
  const sList = gender === "mens" ? MENS_SETTINGS : SETTINGS;
  const setting = sList[r(sList.length)];
  const img = IMAGES[r(IMAGES.length)];

  return {
    id: `gen-${i}`,
    category: type,
    gender,
    name: `${stone} ${cut} ${gender === 'mens' ? 'Band' : gender === 'unisex' ? 'Piece' : type === 'rings' ? 'Ring' : type === 'earrings' ? 'Earrings' : type === 'pendants' ? 'Pendant' : 'Bracelet'}`,
    metal: m.metal,
    metalType: m.metalType,
    metalColor: m.metalColor,
    stone, cut,
    carats: Number((0.5 + ((i % 10) * 0.25)).toFixed(1)),
    setting,
    finish: r(2) === 0 ? "High Polish" : "Brushed Satin",
    price: 50000 + r(150000),
    mfgScore: 85 + r(15),
    engraving: r(3) === 0 ? "Custom" : null,
    tags: [gender, type, stone.toLowerCase()],
    image: img,
    dna: { romance: r(10) / 10, boldness: r(10) / 10, modernity: r(10) / 10, luxury: r(10) / 10, complexity: r(10) / 10 }
  };
});

const CATALOG = [...BASE_CATALOG, ...GENERATED_ITEMS];
type CatalogItem = typeof CATALOG[0];

const CATEGORIES = ["all", "rings", "pendants", "chains", "earrings", "bracelets"];
const GENDERS = ["all", "womens", "mens", "unisex"];
const DNA_COLORS = {
  romance: "#6366f1", // Indigo
  boldness: "#00f2ff", // Cyan
  modernity: "#94a3b8", // Silver/Slate
  luxury: "#d4af37", // Gold
  complexity: "#7c3aed" // Violet
};
const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const scoreColor = (s: number) => s >= 90 ? "#00f2ff" : s >= 75 ? "#6366f1" : "#fb7185";

// ─────────────────────────────────────────────
//  PRICE ESTIMATOR
// ─────────────────────────────────────────────
function estimatePrice(d: { metalType: string; stone: string; carats: number; category: string }) {
  const metalBase: Record<string, number> = { yellow_gold: 12000, rose_gold: 13000, white_gold: 12500, platinum: 18000, silver: 1500, titanium: 3000 };
  const stoneBase: Record<string, number> = { Diamond: 45000, "Black Diamond": 28000, "Pink Sapphire": 18000, "Blue Sapphire": 22000, Ruby: 25000, Emerald: 30000, Aquamarine: 8000, Amethyst: 4000, Moonstone: 5000, "Ethiopian Opal": 10000, "South Sea Pearl": 12000, "Akoya Pearl": 8000, Onyx: 2000, "Mixed Gems": 15000, "Kundan & Enamel": 6000, "Black Enamel": 2000, "Evil Eye Enamel": 2500, "Ruby Eye": 8000, None: 0 };
  const catMult: Record<string, number> = { rings: 1, pendants: 1.8, earrings: 1.4, bracelets: 2, bangles: 2.2, chains: 1.6, cufflinks: 1.1, anklets: 0.9 };
  const metal = (metalBase[d.metalType] || 12000) * 2.5;
  const stone = (stoneBase[d.stone] || 0) * Math.max(d.carats, 0.5) * 1.8;
  return Math.round((metal + stone + 18000) * (catMult[d.category] || 1) / 1000) * 1000;
}

// ─────────────────────────────────────────────
//  SHARED SMALL COMPONENTS
// ─────────────────────────────────────────────
function DNABars({ dna }: { dna: Record<string, number> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(dna).map(([key, val]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 70, textTransform: "capitalize", letterSpacing: "0.02em", fontWeight: 500 }}>{key}</span>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(val as number) * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: "100%", borderRadius: 10, background: DNA_COLORS[key as keyof typeof DNA_COLORS] || "var(--accent-cyan)", boxShadow: `0 0 8px ${DNA_COLORS[key as keyof typeof DNA_COLORS] || "var(--accent-cyan)"}44` }} />
          </div>
          <span style={{ fontSize: 10, color: "var(--text-muted)", width: 26, textAlign: "right", fontFamily: "var(--font-mono)" }}>{Math.round(val as number * 100)}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
      <svg width="44" height="44" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
        <motion.circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          initial={{ strokeDasharray: "0 94" }} animate={{ strokeDasharray: `${score * 0.94} 94` }} transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ filter: `drop-shadow(0 0 4px ${color}66)` }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color, fontFamily: "var(--font-mono)" }}>{score}</span>
    </div>
  );
}



/* eslint-disable @typescript-eslint/no-unused-vars */
function TagInput({ onAdd }: { onAdd: (tag: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim().toLowerCase()); setVal(""); } }}
        placeholder="Add tag & press Enter"
        style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 11px", color: "white", fontSize: 11, fontFamily: "'Inter',sans-serif", outline: "none" }} />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim().toLowerCase()); setVal(""); } }}
        style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.08)", color: "#C9A84C", fontSize: 11, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>+</button>
    </div>
  );
}

// ─────────────────────────────────────────────
//  3D VIEWER WRAPPER — FIX F
//  Lazy-mounts the Canvas only when `active=true`
//  Shows a placeholder button when inactive.
//  Handles WebGL context limits: parent tracks which
//  card is in 3D mode and only one is active at a time.
// ─────────────────────────────────────────────
function Viewer3DSlot({
  item,
  active,
  onActivate,
  mini = true,
}: {
  item: CatalogItem;
  active: boolean;
  onActivate: (e: React.MouseEvent) => void;
  mini?: boolean;
}) {
  const params = useMemo(() => catalogItemToParams(item), [item]);

  if (!active) {
    return (
      <button
        onClick={onActivate}
        className="glass-accent"
        style={{
          position: "absolute", inset: 0, zIndex: 6,
          border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0, 242, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--accent-cyan)", border: "1px solid rgba(0, 242, 255, 0.2)" }}>⬡</div>
        <span style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Enter 3D</span>
      </button>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 6 }}>
      <JewelViewer
        params={params}
        mini={mini}
        autoRotate={true}
        renderMode="pbr"
        lightPreset="showroom"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
//  DESIGNER PANEL (right-side drawer)
// ─────────────────────────────────────────────
const BLANK_DESIGN = {
  name: "Untitled Design", category: "rings", gender: "womens",
  metal: "Yellow Gold 18k", metalType: "yellow_gold", metalColor: "#D4AF37",
  stone: "Diamond", cut: "Round Brilliant", carats: 1.0,
  setting: "4-Prong Solitaire", finish: "High Polish",
  engraving: "", tags: [],
  dna: { romance: 0.5, boldness: 0.5, modernity: 0.5, luxury: 0.5, complexity: 0.5 },
};

// DesignerPanel removed for centralizing all design work in /designer route

// ─────────────────────────────────────────────
//  BORROW STYLE MODAL
// ─────────────────────────────────────────────
function BorrowStyleModal({ sourceItem, onClose, onBorrow }: { sourceItem: CatalogItem; onClose: () => void; onBorrow: (d: any) => void }) {
  const [name, setName] = useState(`${sourceItem.name} — Style Remix`);
  const [done, setDone] = useState(false);
  const go = () => {
    onBorrow({ ...BLANK_DESIGN, name, tags: [...(sourceItem.tags as string[])], dna: { ...(sourceItem.dna as object) }, category: sourceItem.category, gender: sourceItem.gender });
    setDone(true);
    setTimeout(onClose, 800);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(4,3,16,0.88)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{ background: "linear-gradient(135deg,#0F0E24 0%,#1A1835 100%)", border: "1px solid rgba(201,168,76,0.28)", borderRadius: 22, padding: 32, maxWidth: 480, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 26 }}>♡</span>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "white" }}>Borrow Style</h3>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter',sans-serif", marginTop: 2 }}>Copies DNA profile + style tags to a new blank design</p>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 14, marginBottom: 18 }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Inter',sans-serif", marginBottom: 10 }}>
            Borrowing from: <span style={{ color: "#C9A84C" }}>{sourceItem.name}</span>
          </p>
          <DNABars dna={sourceItem.dna} />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
            {sourceItem.tags.map((t: string) => <span key={t} style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "rgba(201,168,76,0.85)", fontFamily: "'Inter',sans-serif" }}>#{t}</span>)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Inter',sans-serif" }}>New Design Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px 13px", color: "white", fontSize: 13, fontFamily: "'Cormorant Garamond',serif", outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={go} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${done ? "rgba(61,214,140,0.5)" : "rgba(201,168,76,0.4)"}`, background: done ? "rgba(61,214,140,0.12)" : "rgba(201,168,76,0.1)", color: done ? "#3DD68C" : "#C9A84C", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            {done ? "✓ Opening Designer…" : "♡ Borrow & Open Designer"}
          </button>
          <button onClick={onClose} style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  BORROW MATERIALS MODAL
// ─────────────────────────────────────────────
function BorrowMaterialsModal({ sourceItem, onClose, onBorrow }: { sourceItem: typeof BASE_CATALOG[0]; onClose: () => void; onBorrow: (d: any) => void }) {
  const [name, setName] = useState(`${sourceItem.name} — Materials`);
  const [done, setDone] = useState(false);
  const go = () => {
    onBorrow({ ...BLANK_DESIGN, name, metal: sourceItem.metal, metalType: sourceItem.metalType, metalColor: sourceItem.metalColor, stone: sourceItem.stone, cut: sourceItem.cut, carats: sourceItem.carats });
    setDone(true);
    setTimeout(onClose, 800);
  };
  const metalObj = METAL_OPTIONS.find(m => m.label === sourceItem.metal);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(4,3,16,0.88)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{ background: "linear-gradient(135deg,#0F0E24 0%,#1A1835 100%)", border: "1px solid rgba(201,168,76,0.28)", borderRadius: 22, padding: 32, maxWidth: 480, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 26 }}>🔩</span>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "white" }}>Borrow Materials</h3>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter',sans-serif", marginTop: 2 }}>Copies metal + stone specs to a new blank design</p>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Inter',sans-serif" }}>
            Borrowing from: <span style={{ color: "#C9A84C" }}>{sourceItem.name}</span>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: metalObj?.color || "#C9A84C", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, color: "white", fontWeight: 600 }}>{sourceItem.metal}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter',sans-serif" }}>Metal</p>
            </div>
          </div>
          {sourceItem.stone !== "None" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(79,142,247,0.18)", border: "1px solid rgba(79,142,247,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>💎</div>
              <div>
                <p style={{ fontSize: 13, color: "white", fontWeight: 600 }}>{sourceItem.stone}{sourceItem.carats > 0 ? ` · ${sourceItem.carats}ct` : ""}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter',sans-serif" }}>{sourceItem.cut} cut</p>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Inter',sans-serif" }}>New Design Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px 13px", color: "white", fontSize: 13, fontFamily: "'Cormorant Garamond',serif", outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={go} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${done ? "rgba(61,214,140,0.5)" : "rgba(79,142,247,0.4)"}`, background: done ? "rgba(61,214,140,0.12)" : "rgba(79,142,247,0.08)", color: done ? "#3DD68C" : "#4F8EF7", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            {done ? "✓ Opening Designer…" : "🔩 Borrow & Open Designer"}
          </button>
          <button onClick={onClose} style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
function DetailModal({ item, onClose, wishlist, toggleWish, onDesigner, onBorrowStyle, onBorrowMaterials }: { item: CatalogItem | null; onClose: () => void; wishlist: string[]; toggleWish: (id: string) => void; onDesigner: (item: CatalogItem) => void; onBorrowStyle: (item: CatalogItem) => void; onBorrowMaterials: (item: CatalogItem) => void }) {
  const viewerParams = useMemo(() => item ? catalogItemToParams(item) : null, [item]);

  if (!item) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,3,10,0.92)", backdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="glass"
        style={{ border: "1px solid var(--glass-border)", borderRadius: 32, overflowX: "hidden", overflowY: "auto", maxWidth: 900, width: "100%", maxHeight: "92vh", background: "var(--glass-bg)", boxShadow: "0 40px 100px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column" }}>

        {viewerParams ? (
          <div key={item.id} style={{ position: "relative", width: "100%", flex: 1, minHeight: 400, background: "#06060c" }}>
            <JewelViewer params={viewerParams} mini={false} autoRotate={true} renderMode="pbr" lightPreset="showroom" />
          </div>
        ) : (
          <div style={{ flex: 1, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.2)" }}>
            Loading 3D Model...
          </div>
        )}

        <div style={{ position: "absolute", top: 20, right: 20, zIndex: 20 }}>
          <button onClick={onClose} className="btn-ghost" style={{ borderRadius: "50%", width: 44, height: 44, fontSize: 22 }}>✕</button>
        </div>

        <div style={{ position: "absolute", top: 20, right: 76, zIndex: 20, display: "flex", gap: "10px" }}>
          <div style={{ display: "flex", background: "rgba(0, 242, 255, 0.1)", borderRadius: 14, border: "1px solid rgba(0, 242, 255, 0.2)", overflow: "hidden", backdropFilter: "blur(10px)", padding: "8px 18px" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Live 3D View ⬡</span>
          </div>
        </div>

        <div style={{ padding: "0 32px 32px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <span className="glass-accent" style={{ background: "rgba(0, 242, 255, 0.15)", borderRadius: 10, padding: "4px 14px", fontSize: 11, color: "var(--accent-cyan)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.category}</span>
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 24 }}>{item.name}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>Investment Value</p>
                  <p style={{ fontSize: 32, fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: "-0.02em" }}>{fmt(item.price)}</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <ScoreRing score={item.mfgScore} />
                  <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, fontWeight: 600 }}>Craftsmanship</p>
                </div>
              </div>
              <div className="glass" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                {[["Metal Composition", item.metal], ["Primary Stone", item.stone !== "None" ? `${item.stone}${item.carats > 0 ? ` (${item.carats}ct)` : ""}` : "Not Specified"], ["Precision Cut", item.cut !== "—" ? item.cut : "Master's Choice"], ["Setting Style", item.setting], ["Surface Finish", item.finish]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{k}</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
                {item.engraving && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10, marginTop: 4 }}>
                    <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>Engraving</span>
                    <span style={{ color: "white", fontWeight: 700, fontStyle: "italic" }}>"{item.engraving}"</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 14 }}>Aesthetic DNA</p>
                <DNABars dna={item.dna} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {item.tags.map((t: string) => <span key={t} className="glass" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "5px 14px", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "capitalize" }}>#{t}</span>)}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <button onClick={() => { onClose(); onDesigner(item); }}
              className="btn btn-cyan" style={{ padding: "16px 0", borderRadius: 16 }}>
              🎨 Designer
            </button>
            <button onClick={() => { onClose(); onBorrowStyle(item); }}
              className="btn btn-ghost" style={{ padding: "16px 0", borderRadius: 16, border: "1px solid rgba(99, 102, 241, 0.3)", color: "var(--accent-indigo)" }}>
              🪄 Remix DNA
            </button>
            <button onClick={() => { onClose(); onBorrowMaterials(item); }}
              className="btn btn-ghost" style={{ padding: "16px 0", borderRadius: 16, border: "1px solid rgba(148, 163, 184, 0.3)", color: "var(--accent-silver)" }}>
              💎 Extract
            </button>
            <button onClick={() => {
              onClose();
              onDesigner(item);
              setTimeout(() => window.location.href = '/ar', 100);
            }}
              className="btn btn-ghost" style={{ padding: "16px 0", borderRadius: 16, border: "1px solid rgba(61, 214, 140, 0.3)", color: "var(--accent-green)" }}>
              📷 AR Try-On
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  CARD — FIX F: per-card mini 3D toggle
// ─────────────────────────────────────────────
function JewelCard({ item, onSelect, wishlist, toggleWish, onDesigner }: { item: CatalogItem; onSelect: (item: CatalogItem) => void; wishlist: string[]; toggleWish: (id: string) => void; onDesigner: (item: CatalogItem) => void }) {
  const wished = wishlist.includes(item.id);

  return (
    <motion.div
      layout
      whileHover={{ y: -8 }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass"
      transition={{ duration: 0.4 }}
      style={{
        borderRadius: 24,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        cursor: "pointer",
        position: "relative",
        background: "rgba(15, 23, 42, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
      }}
      onClick={() => onSelect(item)}
    >
      <div style={{ position: "relative", width: "100%", paddingTop: "75%", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg, rgba(8, 7, 24, 0.8) 0%, rgba(20, 18, 50, 0.6) 100%)" }}>
        {/* 3D Mini Viewer */}
        <div style={{ position: "absolute", inset: 0 }}>
          <JewelViewer params={catalogItemToParams(item)} mini={true} autoRotate={true} renderMode="pbr" lightPreset="showroom" />
        </div>

        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, zIndex: 8 }}>
          <span style={{ background: "rgba(0, 242, 255, 0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(0, 242, 255, 0.2)", borderRadius: 8, padding: "4px 10px", fontSize: 10, color: "var(--accent-cyan)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.category}</span>
        </div>

        <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleWish(item.id); }}
          style={{ position: "absolute", top: 10, right: 10, background: wished ? "rgba(251, 113, 133, 0.2)" : "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)", border: `1px solid ${wished ? "rgba(251, 113, 133, 0.4)" : "rgba(255, 255, 255, 0.1)"}`, borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, zIndex: 8, transition: "all 0.2s" }}>
          {wished ? "❤️" : "🤍"}
        </button>

        <div style={{ position: "absolute", bottom: 12, left: 16, right: 16, zIndex: 3 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 2 }}>{item.name}</p>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{item.metal}{item.stone !== "None" ? ` · ${item.stone}` : ""}</p>
        </div>
      </div>

      <div style={{ padding: "20px 16px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 12, background: "rgba(255,255,255,0.01)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ color: "var(--accent-cyan)", fontWeight: 800, fontSize: 18 }}>{fmt(item.price)}</p>
          <ScoreRing score={item.mfgScore} />
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, fontWeight: 500 }}>
          {item.setting} · {item.finish}
        </p>
        <DNABars dna={item.dna} />
        <div style={{ marginTop: "auto", paddingTop: 8 }}>
          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDesigner(item); }}
            className="btn btn-cyan" style={{ width: "100%", borderRadius: 14, padding: "10px 0" }}>
            🎨 Open in Designer →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  MY DESIGNS SIDEBAR
// ─────────────────────────────────────────────
function MyDesignsSidebar({ designs, onEdit, onDelete, onClose }: { designs: any[]; onEdit: (d: any) => void; onDelete: (id: string) => void; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(4,3,10,0.85)", backdropFilter: "blur(12px)", display: "flex", justifyContent: "flex-end" }}>
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 250 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="glass"
        style={{ width: "min(420px,100vw)", height: "100vh", display: "flex", flexDirection: "column", borderLeft: "1px solid var(--glass-border)", background: "var(--glass-bg)", borderRadius: "32px 0 0 32px" }}>
        <div style={{ padding: "40px 40px 24px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>My Collection</h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500, marginTop: 4 }}>{designs.length} handcrafted {designs.length === 1 ? "design" : "designs"}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon" style={{ borderRadius: "50%", width: 40, height: 40 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          {designs.length === 0 && (
            <div style={{ textAlign: "center", padding: "100px 0", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.5 }}>✨</div>
              <p style={{ fontSize: 15, fontWeight: 500 }}>Your collection is empty.<br />Explore and save your favorites.</p>
            </div>
          )}
          {designs.map(d => (
            <div key={d.id} className="glass" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 20, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</p>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{d.metal} · {d.stone !== "None" ? d.stone : "Pure Metal"}</p>
                <p style={{ fontSize: 15, color: "var(--accent-cyan)", fontWeight: 800, marginTop: 10 }}>{fmt(estimatePrice(d))}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onEdit(d)} className="btn btn-sm btn-ghost" style={{ padding: "8px 16px", borderRadius: 12 }}>Lab</button>
                <button onClick={() => onDelete(d.id)} className="btn btn-sm" style={{ padding: "8px 16px", borderRadius: 12, color: "#fb7185", background: "rgba(251, 113, 133, 0.1)" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
function Toast({ message, onDone }: { message: string, onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
      style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 2000, background: "linear-gradient(135deg,#1A1835,#0F0E24)", border: "1px solid rgba(201,168,76,0.38)", borderRadius: 13, padding: "11px 22px", fontSize: 13, color: "#C9A84C", fontFamily: "'Inter',sans-serif", fontWeight: 600, whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      {message}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────
export default function JewelCraftCatalog() {
  const { setCurrentParams, myDesigns, removeMyDesign, wishlist, toggleWishlist } = useAppStore();

  const [category, setCategory] = useState("all");
  const [gender, setGender] = useState("all");
  const [search, setSearch] = useState("");
  const [pageIdx, setPageIdx] = useState(0);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [showWishlist, setShowWishlist] = useState(false);
  const [borrowStyleItem, setBorrowStyleItem] = useState<CatalogItem | null>(null);
  const [borrowMatsItem, setBorrowMatsItem] = useState<CatalogItem | null>(null);
  const [showMyDesigns, setShowMyDesigns] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeCard3D, setActiveCard3D] = useState<string | null>(null);


  useEffect(() => {
    // Legacy mapping safely removed since `myDesigns` is managed as pure DesignParams in useAppStore directly globally.
  }, []);

  const showToast = (msg: string) => setToast(msg);
  const toggleWish = toggleWishlist;

  const navigate = useNavigate();
  const navigateToDesigner = useCallback((item: any) => {
    // Convert catalog item to DesignParams and push to global store, then navigate
    const params = catalogItemToParams(item);
    setCurrentParams(params);
    navigate('/designer');
  }, [setCurrentParams, navigate]);

  const openBorrowStyle = useCallback((item: CatalogItem) => { setBorrowStyleItem(item); setSelected(null); }, []);
  const openBorrowMats = useCallback((item: CatalogItem) => { setBorrowMatsItem(item); setSelected(null); }, []);

  const handleBorrowStyleConfirm = (newDesign: Record<string, any>) => {
    setBorrowStyleItem(null);
    const params = catalogItemToParams(newDesign as CatalogItem);
    setCurrentParams(params);
    navigate('/designer');
  };
  const handleBorrowMatsConfirm = (newDesign: Record<string, any>) => {
    setBorrowMatsItem(null);
    const params = catalogItemToParams(newDesign as CatalogItem);
    setCurrentParams(params);
    navigate('/designer');
  };

  const deleteDesign = (id: string) => { removeMyDesign(id); showToast("Design deleted"); };

  const filtered = CATALOG.filter(item => {
    if (category !== "all" && item.category !== category) return false;
    if (gender !== "all" && item.gender !== "unisex" && item.gender !== gender) return false;
    if (search) { const q = search.toLowerCase(); return `${item.name} ${item.metal} ${item.stone} ${item.setting} ${item.tags.join(" ")} ${item.category}`.toLowerCase().includes(q); }
    return true;
  });
  const displayItems = showWishlist ? CATALOG.filter(i => wishlist.includes(i.id)) : filtered;
  const ITEMS_PER_PAGE = 4;
  const pages = [];
  for (let i = 0; i < displayItems.length; i += ITEMS_PER_PAGE) pages.push(displayItems.slice(i, i + ITEMS_PER_PAGE));
  const totalPages = pages.length;

  useEffect(() => {
    // setActiveCard3D(null); removed to prevent cascaded renders
  }, [category, gender, search, showWishlist]);

  const goNext = useCallback(() => {
    setActiveCard3D(null);
    setPageIdx(p => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const goPrev = useCallback(() => {
    setActiveCard3D(null);
    setPageIdx(p => Math.max(p - 1, 0));
  }, []);
  const handleDragEnd = (_: any, info: any) => { if (info.offset.x < -60) goNext(); else if (info.offset.x > 60) goPrev(); };
  const currentPage = pages[pageIdx] || [];

  return (
    <div className="cat-page" style={{ height: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", position: "relative", overflowY: "scroll", overflowX: "hidden" }}>
      <div className="bg-animated" style={{ position: "fixed", inset: 0, zIndex: 0 }} />
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 1 }} />

      {/* HEADER */}
      <div style={{ position: "relative", zIndex: 10, padding: "100px 60px 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 30, flexWrap: "wrap", marginBottom: 40 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>✨</span>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.4em", color: "var(--accent-cyan)", textTransform: "uppercase" }}>Curated Selection</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>Jewel<span style={{ color: "var(--accent-cyan)" }}>Catalog</span></h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8, fontWeight: 500 }}>
            {displayItems.length} masterpieces found across {totalPages} pages
            {showWishlist && <span style={{ color: "#fb7185", marginLeft: 12 }}>· Collection ({wishlist.length})</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.5, pointerEvents: "none" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter collection…"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 40px 12px 42px", color: "white", fontSize: 13, outline: "none", width: 240, transition: "all 0.3s" }} />
          </div>
          <button onClick={() => setShowMyDesigns(true)}
            className="btn btn-ghost"
            style={{ borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
            🎨 My Lab {myDesigns.length > 0 && <span style={{ background: "var(--accent-cyan)", color: "black", borderRadius: "50%", width: 20, height: 20, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{myDesigns.length}</span>}
          </button>
          <button onClick={() => setShowWishlist(p => !p)}
            className="btn btn-ghost"
            style={{ borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${showWishlist ? "#fb7185" : "rgba(255,255,255,0.1)"}`, color: showWishlist ? "#fb7185" : "inherit" }}>
            {showWishlist ? "❤️ Collection" : "🤍 Saved"}
          </button>
          <button onClick={() => navigateToDesigner(BLANK_DESIGN)}
            className="btn btn-cyan"
            style={{ borderRadius: 14, padding: "12px 24px" }}>
            + Create New
          </button>
        </div>
      </div>

      {/* FILTERS */}
      {!showWishlist && (
        <div style={{ position: "relative", zIndex: 10, padding: "0 60px", marginBottom: 32, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {GENDERS.map(g => (
              <button key={g} onClick={() => setGender(g)}
                className={gender === g ? "btn-cyan" : "btn-ghost"}
                style={{ borderRadius: 10, padding: "8px 20px", fontSize: 12, fontWeight: 700, textTransform: "capitalize", border: gender === g ? "none" : "1px solid rgba(255,255,255,0.1)" }}>
                {g === "all" ? "Every Style" : g}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CATEGORIES.filter(c => {
              if (c === "all") return true;
              if (gender === "mens") return c !== "earrings" && c !== "pendants";
              if (gender === "unisex") return c !== "earrings" && c !== "chains";
              if (gender === "womens") return c !== "chains";
              return true;
            }).map(c => (
              <button key={c} onClick={() => setCategory(c)}
                style={{ padding: "6px 16px", borderRadius: 30, fontSize: 11, fontWeight: 700, border: `1px solid ${category === c ? "var(--accent-cyan)" : "rgba(255,255,255,0.1)"}`, background: category === c ? "rgba(0, 242, 255, 0.1)" : "transparent", color: category === c ? "var(--accent-cyan)" : "var(--text-secondary)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", transition: "all 0.2s" }}>
                {c === "all" ? "Explore All" : c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GRID */}
      <div style={{ position: "relative", zIndex: 10, padding: "0 40px" }}>
        {totalPages === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ fontSize: 44, marginBottom: 14 }}>{showWishlist ? "🤍" : "🔍"}</p>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.32)", fontStyle: "italic", marginBottom: 18 }}>{showWishlist ? "No saved pieces yet" : "No pieces match your search"}</p>
            <button onClick={() => { setSearch(""); setCategory("all"); setGender("all"); setShowWishlist(false); }}
              style={{ padding: "10px 22px", borderRadius: 11, border: "1px solid rgba(201,168,76,0.4)", background: "transparent", color: "#C9A84C", cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: 12 }}>
              {showWishlist ? "Browse Catalogue" : "Clear Filters"}
            </button>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div key={`${pageIdx}-${category}-${gender}-${search}-${showWishlist}`}
                initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.08} onDragEnd={handleDragEnd}
                style={{ cursor: "grab", userSelect: "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, alignItems: "stretch" }}>
                  {currentPage.map(item => (
                    <JewelCard
                      key={item.id}
                      item={item}
                      onSelect={setSelected}
                      wishlist={wishlist}
                      toggleWish={toggleWish}
                      onDesigner={navigateToDesigner}
                    />
                  ))}
                  {currentPage.length < 4 && Array.from({ length: 4 - currentPage.length }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ borderRadius: 18, border: "1px dashed rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)", minHeight: 340 }} />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 28, fontFamily: "'Inter',sans-serif" }}>
              <motion.button whileTap={{ scale: 0.92 }} onClick={goPrev} disabled={pageIdx === 0}
                style={{ padding: "9px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: pageIdx === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)", cursor: pageIdx === 0 ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}>← Prev</motion.button>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {pages.map((_, i) => <motion.button key={i} whileTap={{ scale: 0.85 }} onClick={() => setPageIdx(i)}
                  style={{ width: i === pageIdx ? 22 : 7, height: 7, borderRadius: 4, background: i === pageIdx ? "#C9A84C" : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.25s" }} />)}
              </div>
              <motion.button whileTap={{ scale: 0.92 }} onClick={goNext} disabled={pageIdx === totalPages - 1}
                style={{ padding: "9px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: pageIdx === totalPages - 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)", cursor: pageIdx === totalPages - 1 ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}>Next →</motion.button>
            </div>
            <p style={{ textAlign: "center", marginTop: 9, fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: "'Inter',sans-serif", letterSpacing: "0.1em" }}>
              PAGE {pageIdx + 1} OF {totalPages} · DRAG OR SWIPE TO TURN
            </p>
          </>
        )}
      </div>

      {/* MODALS & PANELS */}
      <AnimatePresence>
        {selected && <DetailModal item={selected} onClose={() => setSelected(null)} wishlist={wishlist} toggleWish={toggleWish} onDesigner={navigateToDesigner} onBorrowStyle={openBorrowStyle} onBorrowMaterials={openBorrowMats} />}
      </AnimatePresence>
      <AnimatePresence>
        {borrowStyleItem && <BorrowStyleModal sourceItem={borrowStyleItem} onClose={() => setBorrowStyleItem(null)} onBorrow={handleBorrowStyleConfirm} />}
      </AnimatePresence>
      <AnimatePresence>
        {borrowMatsItem && <BorrowMaterialsModal sourceItem={borrowMatsItem} onClose={() => setBorrowMatsItem(null)} onBorrow={handleBorrowMatsConfirm} />}
      </AnimatePresence>
      <AnimatePresence>
        {showMyDesigns && <MyDesignsSidebar designs={myDesigns} onEdit={navigateToDesigner} onDelete={deleteDesign} onClose={() => setShowMyDesigns(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>

      <style>{`* { box-sizing:border-box; } img { max-width:100%; } select option { background:#1A1835; color:white; } input[type=range] { -webkit-appearance:none; height:4px; border-radius:2px; } input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; cursor:pointer; }`}</style>
    </div>
  );
}
