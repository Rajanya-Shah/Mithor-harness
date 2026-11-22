---
name: "frontend-pixel-perfection"
description: "Pre-built UI/UX pixel-pushing, layout alignment, responsive typography, and visual hierarchy skill for React and Tailwind CSS applications."
triggers:
  - "layout"
  - "abstand"
  - "schrift"
  - "farbe"
  - "button"
  - "tabelle"
  - "design"
  - "pixel"
---

# Frontend Pixel Perfection & Visual Polish

Use this skill whenever the user asks to adjust spacing, typography, alignment, card borders, badges, tables, or responsive layout in `apps/FEP/src/**`.

## 1. Surgical Visual Inspection First
1. Check if the user selected an element via the Click-to-Inspect overlay (`get_last_clicked_element` from `mithor-code-map`).
2. If not, use `lookup_german_term` to locate the exact React component in `apps/FEP/src/**`.
3. Capture a baseline screenshot via `capture_baseline` (`mithor-visual-preview`) before making visual changes.

## 2. Mithor Design System Tokens (Tailwind 3)
Always preserve Mithor's institutional monochrome & high-contrast real estate aesthetic:
- **Primary Ink / Headings / Primary Buttons:** `#1A1A1A` (`text-[#1A1A1A]`, `bg-[#1A1A1A]`)
- **Body / Secondary Copy:** `#555555` (`text-[#555555]`)
- **Muted Labels / Captions / Units:** `#888888` (`text-[#888888]`)
- **Hairline Borders & Dividers:** `#E5E5E5` (`border-[#E5E5E5]`)
- **Subtle Surface / Table Header / Pill BG:** `#F5F5F5` or `#FAFAFA` (`bg-[#F5F5F5]`, `bg-[#FAFAFA]`)
- **Cards:** `bg-white border border-[#E5E5E5] rounded-2xl p-5`
- **Financial Figures & Percentages:** Always apply `tabular-nums` so numbers align vertically in columns and tables.
- **Verdict Semantic Badges:**
  - `GO`: `bg-emerald-50 text-emerald-700 border-emerald-200`
  - `CONDITIONAL_GO`: `bg-amber-50 text-amber-700 border-amber-200`
  - `NO_GO`: `bg-red-50 text-red-600 border-red-200`

## 3. Zero-Layout-Shift Rules
- Never remove responsive breakpoints (`sm:`, `md:`, `lg:`) when adjusting padding or flex/grid direction.
- When changing German labels (which are often 20–35% longer than English labels), verify that table headers and flex rows do not overflow on mobile or tablet widths (`min-w-0`, `truncate`, or `flex-wrap`).
- After editing, run `capture_and_diff` and `npm test` / `npm run build` to verify zero visual regressions.
