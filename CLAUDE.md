# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Important:** This project uses Next.js 16 with React 19. APIs, conventions, and file structure may differ from earlier versions. Read `node_modules/next/dist/docs/` for authoritative guidance before writing code. The `params` prop in dynamic routes is now a `Promise` — always `await params` before destructuring.

## Commands

All commands run from `riverscape-web/`:

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

There is no test suite.

## Architecture

**Riverscape** is a marketing/brochure site for a luxury riverside resort in Kerala, India. It is a statically generated Next.js App Router site deployed on Vercel.

### Data layer

Everything content-related lives in **`src/lib/data.ts`** — no database, no CMS, no API. This single file exports:
- `RESORT` — resort name, location, contact info
- `HERO_IMAGES` — ordered list of landscape image paths used by the hero slideshow (5 s per slide, Ken Burns scale)
- `WHATSAPP_NUMBER` + `waLink()` / `waRoomLink()` — all booking CTAs open a pre-filled WhatsApp chat
- `rooms: Room[]` — the full room catalogue (8 rooms); `Room.id` is the URL slug
- `amenities`, `testimonials`, `galleryImages`, `fullGallery` — used by homepage sections and `/gallery`
- `formatPrice()` — INR currency formatter
- `getRoomBySlug()` — used by the dynamic room detail page

**To add a room, change a price, or update content, edit `src/lib/data.ts` only.** No code changes elsewhere are needed for data changes.

### Types

`src/types/index.ts` — `Room`, `Amenity`, `Testimonial`, `GalleryImage`. Keep types here; don't co-locate them with components.

### Pages (App Router)

| Route | File | Notes |
|---|---|---|
| `/` | `src/app/page.tsx` | Composes homepage sections; below-fold sections are lazy-loaded with `next/dynamic` |
| `/rooms` | `src/app/rooms/page.tsx` | Grid of all rooms from `data.ts` |
| `/rooms/[slug]` | `src/app/rooms/[slug]/page.tsx` | Static params generated from `rooms[].id`; uses `RoomGallery` client component |
| `/gallery` | `src/app/gallery/page.tsx` | Full gallery with category filter (room / landscape); uses `GalleryFull` client component |

`src/app/template.tsx` wraps every page in a Framer Motion fade-in on navigation.

### Styling

Tailwind CSS v4 — `@import "tailwindcss"` in `globals.css`, no `tailwind.config.*`. The design system is declared with `@theme` in `globals.css`:

- **Colors:** `forest` (#1a3a2a), `forest-light`, `forest-dark`, `cream` (#f5f0e8), `cream-dark`, `gold` (#c9a84c), `gold-light`, `gold-dark`
- **Fonts:** `--font-serif` (Cormorant Garamond — all headings h1–h4 and the logo) / `--font-sans` (Inter — body)
- Use `cn()` from `src/lib/utils.ts` for conditional class merging (clsx + tailwind-merge)

### Animation primitives

`src/components/animations.tsx` exports three client components built on Framer Motion:
- `FadeIn` — fades + slides up on scroll-into-view (use for individual elements)
- `StaggerContainer` + `StaggerItem` — staggered children reveal (use for lists/grids)

All animations trigger once (`viewport={{ once: true }}`). New sections should follow this pattern.

### Static assets

Images and videos are served from `public/`. Paths used throughout the codebase:
- `/images/landscape/{1–10}.jpg` — resort exterior/landscape shots
- `/images/rooms/{room-id}/{1–N}.jpg` — per-room photos (gallery array in `data.ts`)
- `/videos/reel-{2,6,8}.mp4` — hero video loop

`next.config.ts` sets aggressive caching headers (1-year immutable) on `/images/` and `/videos/`. New static assets should go in these directories to benefit automatically.
