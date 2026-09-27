---
name: design-taste-frontend
description: Frontend design taste and glassmorphism standards for crafting high-quality, modern interfaces.
---

# Design Taste Frontend (Leonxlnx/taste-skill)

Guidelines to ensure frontend design is aesthetic, intentional, and polished:

1. **Glassmorphism & Depth**:
   - Use multi-layer translucent backgrounds (`backdrop-filter: blur(16px-24px)` with high saturation `160%-190%`).
   - Subtle inner specular highlights (`inset 0 1px 0 rgba(255, 255, 255, 0.12-0.95)`).
   - Soft diffuse ambient drop shadows (`0 12px 32px 0 rgba(0,0,0,0.4)` / `0 10px 30px rgba(15,23,42,0.08)`).
   - Dynamic border states with luminous accent transitions on focus and hover.

2. **Refined Dark & Light Modes**:
   - **Dark Mode**: Deep obsidian / midnight space canvas (`#05070e`) with translucent dark slate glass panels, luminous amber/gold accents (`#d4af37`, `#fcd34d`), and electric cyan highlights (`#38bdf8`).
   - **Light Mode**: Crisp frosty porcelain glass panels (`rgba(255,255,255,0.85)`), deep slate-900 typography, subtle borders (`rgba(203,213,225,0.85)`), and rich royal amber/sky accents.

3. **Typography & Hierarchy**:
   - Modern system fonts and crisp monospace numerals for geospatial coordinates, indices, and time metrics.
   - High contrast headings, distinct section badges, and clear uppercase tracked labels.

4. **Micro-Interactions**:
   - Gentle hover lifts (`transform: translateY(-1px)`), active tap compression (`scale(0.97)`), and smooth spring transitions.
