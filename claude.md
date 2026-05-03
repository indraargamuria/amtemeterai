# Claude Frontend Guidelines

## Tech Stack
- React (Vite)
- TypeScript
- Tailwind CSS
- shadcn/ui (component library)
- React Router

---

## Design Principles

### 1. Minimalist + Enterprise SaaS
- Clean layout
- Plenty of whitespace
- No clutter
- Professional (not playful)

---

## Color System (STRICT RULE)

ONLY use these 3 colors:

- White: #FFFFFF (primary background)
- Blue: #1d2351 (primary brand color)
- Red: #e61920 (accent color)

### Rules:
- No additional colors allowed (including gray variants unless derived from opacity)
- Use opacity (e.g. blue/10, blue/20) instead of new colors
- Background must be white
- Primary actions → blue
- Critical / highlight → red

---

## Typography
- Use default sans-serif (Tailwind)
- Clear hierarchy:
  - Title → large, bold
  - Section → medium
  - Body → normal

---

## Layout Rules

### General
- Use spacing generously (padding, margin)
- Avoid cramped UI
- Prefer grid/flex layouts

---

### Dashboard Layout
- Left sidebar (fixed width)
- Main content area (flex-grow)
- Sidebar must stay persistent across pages

---

## Component Usage

Use **shadcn/ui components** whenever possible:
- Button
- Card
- Input
- Table
- Pagination
- Badge

Avoid building raw HTML if a component exists.

---

## Code Structure

Follow this structure:

- pages → route-level screens
- features → business logic grouping
- shared/components → reusable UI
- shared/layouts → layout (Sidebar, etc)

---

## UX Rules

- Loading state placeholders (skeleton if possible)
- Empty states must exist
- Tables must be readable and spaced
- Buttons must be clearly visible

---

## DO NOT

- Do not add random colors
- Do not over-design
- Do not use complex animations
- Do not introduce backend logic
- Do not use mock APIs unless explicitly asked

---

## Output Expectation

- Clean, production-ready React TSX
- Use Tailwind classes
- Use shadcn/ui components
- Split components logically (not one big file)