"""Catalog data for JewelCraft AI backend."""

CATALOG_ITEMS = [
    {
        "id": "cat-001", "name": "Eternal Bloom Solitaire",
        "category": "ring", "gender": "womens",
        "metal": "Yellow Gold 18k", "stone": "diamond",
        "priceINR": 125000, "manufactureScore": 94,
        "tags": ["romantic", "classic", "engagement"],
        "thumbnail": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=80",
        "styleDna": {"romance": 0.8, "boldness": 0.3, "modernity": 0.4, "luxury": 0.9, "complexity": 0.45},
        "params": {
            "metal": {"type": "yellow_gold", "color": "#FFD700", "roughness": 0.15, "finish": "high_polish"},
            "band": {"width": 2.5, "thickness": 1.8, "profile": "round"},
            "stones": [{"type": "diamond", "cut": "round_brilliant", "size": 1.0, "color": "#FFFFFF", "transmission": 0.98, "ior": 2.417}],
            "halo": {"enabled": False, "stoneCount": 16, "stoneSize": 0.03},
            "prongs": {"count": 4, "style": "round", "height": 1.2, "thickness": 0.9},
            "engraving": {"enabled": False, "text": "", "font": "serif"},
            "setting": {"type": "prong"},
            "style_dna": {"romance": 0.8, "boldness": 0.3, "modernity": 0.4, "luxury": 0.9, "complexity": 0.45},
        }
    },
    {
        "id": "cat-002", "name": "Steel Edge Minimal",
        "category": "pendant", "gender": "unisex",
        "metal": "Platinum", "stone": "diamond",
        "priceINR": 55000, "manufactureScore": 97,
        "tags": ["minimal", "modern", "gender-neutral"],
        "thumbnail": "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&q=80",
        "styleDna": {"romance": 0.2, "boldness": 0.6, "modernity": 0.95, "luxury": 0.7, "complexity": 0.2},
        "params": {
            "metal": {"type": "platinum", "color": "#E8E8F0", "roughness": 0.08, "finish": "brushed"},
            "band": {"width": 1.2, "thickness": 1.4, "profile": "knife_edge"},
            "stones": [{"type": "diamond", "cut": "round_brilliant", "size": 0.6, "color": "#FFFFFF", "transmission": 0.98, "ior": 2.417}],
            "halo": {"enabled": False, "stoneCount": 16, "stoneSize": 0.03},
            "prongs": {"count": 0, "style": "bezel", "height": 0.8, "thickness": 0.6},
            "engraving": {"enabled": False, "text": "", "font": "serif"},
            "setting": {"type": "bezel"},
            "style_dna": {"romance": 0.2, "boldness": 0.6, "modernity": 0.95, "luxury": 0.7, "complexity": 0.2},
        }
    },
    {
        "id": "cat-003", "name": "Celestial Drop Pendant",
        "category": "pendant", "gender": "womens",
        "metal": "Yellow Gold 18k", "stone": "sapphire",
        "priceINR": 42000, "manufactureScore": 91,
        "tags": ["celestial", "modern", "sapphire"],
        "thumbnail": "https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=400&q=80",
        "styleDna": {"romance": 0.6, "boldness": 0.5, "modernity": 0.7, "luxury": 0.75, "complexity": 0.5},
        "params": {
            "metal": {"type": "yellow_gold", "color": "#FFD700", "roughness": 0.12, "finish": "high_polish"},
            "band": {"width": 2.0, "thickness": 1.5, "profile": "round"},
            "stones": [{"type": "sapphire", "cut": "oval", "size": 0.8, "color": "#0F52BA", "transmission": 0.4, "ior": 1.77}],
            "halo": {"enabled": True, "stoneCount": 12, "stoneSize": 0.02},
            "prongs": {"count": 4, "style": "round", "height": 1.0, "thickness": 0.8},
            "engraving": {"enabled": False, "text": "", "font": "serif"},
            "setting": {"type": "prong"},
            "style_dna": {"romance": 0.6, "boldness": 0.5, "modernity": 0.7, "luxury": 0.75, "complexity": 0.5},
        }
    },
    {
        "id": "cat-004", "name": "Diamond Drop Earrings",
        "category": "earring", "gender": "womens",
        "metal": "White Gold 18k", "stone": "diamond",
        "priceINR": 68000, "manufactureScore": 93,
        "tags": ["drop", "elegant", "diamond"],
        "thumbnail": "https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=400&q=80",
        "styleDna": {"romance": 0.7, "boldness": 0.4, "modernity": 0.55, "luxury": 0.88, "complexity": 0.55},
        "params": {
            "metal": {"type": "white_gold", "color": "#F0F0F8", "roughness": 0.1, "finish": "high_polish"},
            "band": {"width": 1.8, "thickness": 1.4, "profile": "round"},
            "stones": [{"type": "diamond", "cut": "pear", "size": 0.75, "color": "#FFFFFF", "transmission": 0.98, "ior": 2.417}],
            "halo": {"enabled": False, "stoneCount": 8, "stoneSize": 0.015},
            "prongs": {"count": 3, "style": "round", "height": 0.9, "thickness": 0.7},
            "engraving": {"enabled": False, "text": "", "font": "serif"},
            "setting": {"type": "prong"},
            "style_dna": {"romance": 0.7, "boldness": 0.4, "modernity": 0.55, "luxury": 0.88, "complexity": 0.55},
        }
    },
]
