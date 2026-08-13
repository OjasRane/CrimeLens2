# 🔍 The Fatal Ledger

> **An analog-brutalist, real-time collaborative crime investigation canvas.**
> Four synchronized workspaces, live multi-agent presence, and a QR-powered field uplink terminal.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Liveblocks](https://img.shields.io/badge/Liveblocks-3.x-orange)](https://liveblocks.io/)
[![Deck.gl](https://img.shields.io/badge/Deck.gl-9.3-green)](https://deck.gl/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-6.x-teal)](https://maplibre.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [What Is This?](#what-is-this)
- [Live Features](#live-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Workspaces In Depth](#workspaces-in-depth)
- [Multiplayer & Real-Time Collaboration](#multiplayer--real-time-collaboration)
- [QR Field Uplink](#qr-field-uplink)
- [Command Palette](#command-palette)
- [State Management](#state-management)
- [Design System](#design-system)
- [Contributing](#contributing)

---

## What Is This?

**The Fatal Ledger** is a full-stack, real-time collaborative crime investigation platform built with a distinctive **analog-brutalist** aesthetic — think detective corkboards and typewriter fonts fused with live geospatial heatmaps and reactive node graphs.

The app simulates a shared "case desk" where multiple investigators (agents) can work simultaneously. Each agent sees live cursors of their teammates, receives map override broadcasts, and can submit field intelligence via a dedicated mobile terminal accessed by QR code.

The case at the center of the demo: a fictional multi-suspect crime ring operating across Chicago's Loop district between July 18–28, 2026.

---

## Live Features

| Feature | Description |
|---|---|
| 🗺️ **Geospatial Map** | Interactive MapLibre/Deck.gl map with heatmap, 3D hexagon density, scatter pins, and animated arc routes |
| 📋 **Evidence Board** | Drag-and-drop React Flow canvas with sticky notes and polaroid cards, synced live via Liveblocks |
| 🕸️ **Network Graph** | React Flow node graph showing suspects, locations, evidence, and financial/phone/colocation links |
| ⏱️ **Timeline** | Zoomable, scrollable event timeline with CCTV, arrest, forensic and call categories; supports in-place annotations |
| 📒 **Fact Ledger** | Collapsible sidebar panel with verified, disputed, and pending facts; direct pinning to the evidence board |
| 🖥️ **Command Palette** | `⌘K` / `Ctrl+K` global spotlight search across personnel, sectors, vehicles, and system actions |
| 📡 **Live Collaboration** | Real-time cursors, shared evidence board state, and broadcast map-pan events across all connected agents |
| 📱 **QR Field Uplink** | Generates a QR code for a mobile-optimized terminal (`/uplink`) so field agents can submit notes directly onto the shared board |
| 🌗 **Light / Dark Mode** | Full dual-theme support with a distinct paper-white day mode and deep-navy terminal night mode |
| 📐 **Responsive Layout** | Adapts between desktop multi-panel layout and a mobile bottom-navigation workspace switcher |

---

## Tech Stack

### Core Framework

| Package | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org/) | `^16` | App router, SSR, API routes |
| [React](https://react.dev/) | `^19.1` | UI library |
| [TypeScript](https://www.typescriptlang.org/) | `^5.8` | Type safety across the entire codebase |
| [Tailwind CSS](https://tailwindcss.com/) | `^4.1` | Utility-first styling with CSS custom properties |

### Maps & Geospatial

| Package | Version | Purpose |
|---|---|---|
| [MapLibre GL](https://maplibre.org/) | `^6.1` | Open-source WebGL map renderer |
| [react-map-gl](https://visgl.github.io/react-map-gl/) | `^8.1` | React wrapper for MapLibre |
| [Deck.gl](https://deck.gl/) | `^9.3` | GPU-accelerated visualization layers (HexagonLayer, ArcLayer, ScatterplotLayer, PathLayer) |

### Graphs & Diagrams

| Package | Version | Purpose |
|---|---|---|
| [@xyflow/react](https://reactflow.dev/) | `^12.8` | Evidence board and network graph canvas |

### Real-Time Collaboration

| Package | Version | Purpose |
|---|---|---|
| [@liveblocks/client](https://liveblocks.io/) | `^3.23` | Room presence, storage, and broadcast events |
| [@liveblocks/react](https://liveblocks.io/) | `^3.23` | React hooks for live cursors, mutations, and storage |

### UI & Animation

| Package | Version | Purpose |
|---|---|---|
| [Framer Motion](https://www.framer.com/motion/) | `^12.43` | Smooth enter/exit transitions and micro-animations |
| [Lucide React](https://lucide.dev/) | `^0.468` | Consistent icon set |
| [next-themes](https://github.com/pacocoursey/next-themes) | `^0.4` | Theme switching without flash |
| [qrcode.react](https://github.com/zpao/qrcode.react) | `^4.2` | QR code generation for the field uplink |
| [Zustand](https://zustand-demo.pmnd.rs/) | `^5.0` | Global client-side state management |

---

## Project Structure

```
CrimeLens2/
├── app/
│   ├── layout.tsx              # Root layout — ThemeProvider, metadata, viewport
│   ├── page.tsx                # Entry point — renders InvestigationWorkspace
│   ├── globals.css             # Design tokens, CSS custom properties, global styles
│   └── uplink/
│       └── page.tsx            # Mobile field uplink route (/uplink)
│
├── components/
│   ├── investigation-workspace.tsx     # Root workspace shell (header, layout, ledger)
│   ├── workspace-viewport.tsx          # Renders the active workspace panel
│   ├── workspace-bar.tsx               # Desktop workspace tab switcher
│   ├── mobile-workspace-nav.tsx        # Mobile bottom navigation bar
│   │
│   │   ── WORKSPACES ──
│   ├── geospatial-map-workspace.tsx    # Map view (MapLibre + Deck.gl layers)
│   ├── board.tsx                       # Evidence board (React Flow + Liveblocks)
│   ├── network-graph-workspace.tsx     # Relationship graph (React Flow)
│   ├── timeline-workspace.tsx          # Event timeline with annotations
│   │
│   │   ── NODES / EDGES ──
│   ├── flow-nodes.tsx                  # StickyNote, LiveStickyNote, Polaroid node types
│   ├── flow-edges.tsx                  # RedString custom edge type
│   │
│   │   ── COLLABORATION ──
│   ├── liveblocks-runtime.tsx          # Room connection, presence, broadcast listeners
│   ├── collaboration-context.tsx       # React context for agentId / multiplayer flag
│   ├── live-cursors.tsx                # Renders remote agent cursors
│   │
│   │   ── UI CHROME ──
│   ├── command-palette.tsx             # ⌘K global search & dispatch
│   ├── fact-ledger.tsx                 # Collapsible facts sidebar
│   ├── global-status-bar.tsx           # Bottom status strip (filters, time range)
│   ├── qr-uplink-modal.tsx             # QR code modal for field agent deployment
│   ├── uplink-terminal.tsx             # Mobile field intelligence submission UI
│   ├── case-access-terminal.tsx        # Canvas header search / node adder
│   └── theme-toggle.tsx                # Light/dark mode switch
│
├── store/
│   └── use-investigation-store.ts      # Zustand store — all global state & actions
│
├── lib/
│   ├── liveblocks.ts                   # Liveblocks client, room context, hooks
│   ├── evidence-board-storage.ts       # LiveList serialization / mutation helpers
│   ├── evidence-board-types.ts         # Shared types for stored nodes/edges
│   └── haptics.ts                      # Navigator.vibrate wrapper
│
├── public/
│   ├── maplibre-gl-shared.mjs          # MapLibre worker bundle (served statically)
│   └── maplibre-gl-worker.js           # MapLibre worker entry (avoids Webpack issues)
│
├── liveblocks.config.ts                # Global Liveblocks type declarations
├── next.config.ts                      # Next.js config — Deck.gl transpile, file tracing
├── .env.example                        # Required environment variables (copy to .env.local)
├── package.json
└── tsconfig.json
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               LiveblocksRuntime                      │   │
│  │  (wraps the whole app — connects or falls back)      │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │          InvestigationWorkspace              │    │   │
│  │  │  Header · WorkspaceBar · FactLedger sidebar  │    │   │
│  │  │                                              │    │   │
│  │  │  ┌────────────────────────────────────────┐  │    │   │
│  │  │  │         WorkspaceViewport              │  │    │   │
│  │  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │  │    │   │
│  │  │  │  │ Map  │ │Board │ │Graph │ │Time  │   │  │    │   │
│  │  │  │  └──────┘ └──────┘ └──────┘ └──────┘   │  │    │   │
│  │  │  └────────────────────────────────────────┘  │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │  LiveCursors · CommandPalette · QRUplinkModal        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Zustand (useInvestigationStore)              │   │
│  │  activeWorkspace · timeRange · nodes · edges ·       │   │
│  │  selectedSuspect · mapPanRequest · facts · filters   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             │
                    WebSocket (Liveblocks)
                             │
┌─────────────────────────────────────────────────────────────┐
│                    Liveblocks Cloud                         │
│   Room Storage: LiveList<nodes>, LiveList<edges>            │
│   Presence: { x, y, agentId } per connected agent           │
│   Broadcast: FORCE_MAP_PAN events                           │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

- **Local-first, real-time optionally.** If no Liveblocks key is set, the app falls back to a fully functional local mode with no network dependency.
- **Zustand for local state, Liveblocks for shared state.** The evidence board nodes/edges live in *both* — Zustand owns the React Flow render state; the Liveblocks `LiveList` is the source of truth for collaboration. Mutations are targeted (not full-list replacements) to prevent conflicting overwrites during simultaneous edits.
- **MapLibre worker served statically.** Because Webpack/Next.js cannot bundle MapLibre's ESM worker correctly, the worker is placed in `/public` and set via `setWorkerUrl()` at runtime.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/CrimeLens2.git
cd CrimeLens2

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local and add your Liveblocks public key (see below)

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **No Liveblocks key?** The app works perfectly without one — it runs in local-only mode where all collaboration features are disabled, but all four workspaces are fully interactive.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Build production bundle |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type-check (no emit) |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```env
# Your Liveblocks PUBLIC key (safe to ship to the browser)
# Get one free at https://liveblocks.io/dashboard
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=pk_dev_replace_me

# Public browser credentials from Supabase Settings > API Keys.
# Never put a secret/service-role key in NEXT_PUBLIC_*.
NEXT_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me

# Protected FastAPI intelligence endpoint.
NEXT_PUBLIC_TIMELINE_INTEL_URL=http://localhost:8000/api/v1/intel/timeline/SUSPECT-001
```

Liveblocks remains optional. Supabase configuration is required for the clearance terminal and protected investigation workspaces.

### Passkey / WebAuthn configuration

CrimeLens uses Supabase Auth as the only production identity and session authority. The browser asks Supabase for a challenge, the device authenticator signs it, Supabase verifies the assertion and issues the session JWT, and FastAPI validates that JWT before serving protected intelligence.

1. Apply the migrations in `supabase/migrations`, including `20260813000000_create_authorized_profiles.sql`.
2. In Supabase Dashboard, open **Authentication → Passkeys**, enable passkey authentication, and configure:
   - RP display name: `CrimeLens`
   - RP ID: the stable bare production domain, for example `crimelens.example.com`
   - RP origins: the exact HTTPS origins, for example `https://crimelens.example.com`
3. Do not use a Vercel preview hostname or another changing URL as the production RP ID. Changing the RP ID invalidates existing passkeys.
4. Add the production origin to `CORS_ORIGINS` in the FastAPI deployment.

The checked-in `supabase/config.toml` enables passkeys for local Supabase development with `localhost` / `127.0.0.1`. WebAuthn works on supported localhost contexts; production requires HTTPS.

### Enroll the first legitimate investigator

Create or invite the user through the Supabase Dashboard, confirm their email, then insert their server-administered profile using the SQL editor or another service-role-only admin path:

```sql
insert into public.profiles (
  user_id, agent_id, display_name, role, clearance, active
)
values (
  '<auth.users.id>', 'CR-0174', 'Investigator Name', 'investigator', 'LEVEL RED', true
);
```

Open `/enroll`, enter that existing account email, follow the confirmation link, and select **Register new passkey**. The enrollment page sets `shouldCreateUser: false`, requires a real Supabase session, and also requires an active server-controlled CrimeLens profile. It cannot create an investigator from a typed Agent ID.

### Test authentication

- Local: run the Supabase stack/config (or use a configured hosted project), start FastAPI from `backend`, then run `npm run dev` and open `http://localhost:3000` in a supported browser.
- Production: deploy to the stable HTTPS origin configured as the RP origin, enroll a fresh production credential, verify login/cancel/no-credential cases, and call a protected FastAPI route with the Supabase access token.
- Security check: `POST /api/v1/auth/verify-kinetic` returns `410 Gone` by default. Set `ENABLE_LEGACY_KINETIC_AUTH=false` in production. Even if explicitly enabled for an isolated legacy demo, its old token is not a Supabase session and is rejected by protected FastAPI routes.

---

## Workspaces In Depth

### 🗺️ Map Workspace (`geospatial-map-workspace.tsx`)

The geospatial analysis workspace built on **MapLibre GL** (rendered via `react-map-gl`) with **Deck.gl** overlay layers.

**Visualization layers (switchable):**

| Layer | Type | Description |
|---|---|---|
| `PINS` | `ScatterplotLayer` | Individual incident markers with crime-type color coding |
| `HEAT` | `HexagonLayer` (2D) | Flat heatmap showing incident density |
| `DENSITY` | `HexagonLayer` (3D) | Extruded 3D density towers with ambient + directional lighting |
| `ROUTES` | `ArcLayer` + `PathLayer` | Animated movement arcs between known locations |

**Controls:**
- Filter by crime type (Burglary, Assault, Fraud, Robbery, Arson)
- Filter by date range and animated playback scrubber
- Spatial bounding box draw (select area to filter)
- 2D / 3D view toggle
- Fly-to on suspect/sector selection from the command palette

**Collaborative feature:** When a teammate uses the command palette with `Shift+Enter`, a `FORCE_MAP_PAN` event is broadcast via Liveblocks, causing all connected agents' maps to fly to the same target.

---

### 📋 Evidence Board (`board.tsx`)

A drag-and-drop whiteboard powered by **React Flow** with **Liveblocks** shared storage.

**Node types:**

| Type | Component | Description |
|---|---|---|
| `stickyNote` | `StickyNoteNode` / `LiveStickyNoteNode` | Editable text card; live version broadcasts edits and enforces per-node locking |
| `polaroid` | `PolaroidNode` | Evidence photo card with editable caption |

**Edge types:**

| Type | Component | Description |
|---|---|---|
| `redString` | `RedStringEdge` | Classic detective "red string" connecting evidence nodes |

**Collaborative feature:** In multiplayer mode, nodes and edges are stored in Liveblocks `LiveList`. Node mutations are applied surgically (targeted inserts/updates/deletes) rather than full-list replacements, preventing data races during simultaneous edits. A per-node `lockedBy` field prevents two agents editing the same note at once.

**Drag-to-add:** Drag node type pills from the toolbar sidebar onto the canvas to create new nodes at exact positions.

---

### 🕸️ Network Graph (`network-graph-workspace.tsx`)

A static analytical graph rendered in React Flow showing the relationship structure of the case.

**Node kinds:** `suspect` · `evidence` · `location` · `transaction`
**Link kinds:** `financial` · `phone` · `colocation`

The graph is **time-filtered** — nodes and edges have `dateRange` fields and are hidden outside the selected time window. Selecting a suspect in the graph also selects them in the global store, cross-filtering the map view.

---

### ⏱️ Timeline (`timeline-workspace.tsx`)

A horizontally-scrollable, zoomable chronological event log.

**Event categories:** `CALL` · `ARREST` · `EVIDENCE` · `CCTV` · `FORENSIC` · `ANALYSIS`

Each event has a severity score (1–10) that determines its visual weight on the track. Clicking an event expands a detail panel with:
- Full description
- Category badge
- Annotation panel for adding investigator notes (CCTV / eyewitness / document)
- Direct "Pin to Board" action — drops the event text as a sticky note on the evidence board

**Navigation:** Zoom in/out buttons, time-range scrubber at the bottom, keyboard-accessible event cards.

---

## Multiplayer & Real-Time Collaboration

The collaboration layer is implemented in `liveblocks-runtime.tsx` and controlled by `lib/liveblocks.ts`.

### How It Works

1. **Room Connection** — On page load, the app reads the `?case=<id>` URL parameter to determine the room ID. All agents with the same `case` parameter share a room.

2. **Presence** — Each agent broadcasts `{ x, y, agentId }` on pointer move. Other agents see floating labeled cursors (`LiveCursors` component).

3. **Shared Storage** — The evidence board's `nodes` and `edges` are `LiveList` objects stored on the Liveblocks server. Changes are synced in real time using targeted mutations.

4. **Broadcast Events** — The command palette can broadcast a `FORCE_MAP_PAN` event (`Shift+Enter` on a result). All listening agents receive it via `useEventListener`, switch to map view, and fly to the target coordinates. A toast notification shows which agent sent the override.

5. **Local Fallback** — If `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` is not set, `isLiveblocksConfigured` is `false` and the app renders in local-only mode with no WebSocket connection.

### Agent Identity

Each connected browser is randomly assigned an `AGENT-0X` identity (AGENT-01 through AGENT-05). This ID appears in the cursor label and is used as the `lockedBy` field when editing a sticky note.

---

## QR Field Uplink

The field uplink system lets mobile devices join an active case and submit intelligence without opening the full desktop interface.

### Desktop Side

1. Open the command palette (`⌘K`)
2. Search "deploy" or select **DEPLOY FIELD AGENT (QR UPLINK)**
3. A modal appears with a QR code and copyable URL

### Mobile Side (`/uplink?case=<id>`)

- Renders a minimal dark-mode terminal interface
- Connects to the same Liveblocks room as the main app
- Field agent types intelligence text and hits **TRANSMIT INTEL**
- The note appears instantly as a sticky note on the shared evidence board

The uplink page lives at `app/uplink/page.tsx` and is powered by `components/uplink-terminal.tsx`.

---

## Command Palette

Open with `⌘K` (Mac) or `Ctrl+K` (Windows/Linux), or from the toolbar.

### Commands

| Category | Targets | Action |
|---|---|---|
| SYSTEM ACTIONS | Deploy Field Agent | Opens QR Uplink modal |
| PERSONNEL | Ada Cross, Jon Marlowe, Mira Vale | Flies map to suspect location, selects suspect |
| SECTORS | Platform 9, Evidence Annex, Fulton Market, River North Diner | Flies map to sector |
| VEHICLES | Sable-07, Ghost-12, Signal-03 | Flies map to last known vehicle position |

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Toggle palette |
| `↑` / `↓` | Navigate results |
| `Enter` | Execute selected result locally |
| `Shift+Enter` | Execute AND broadcast to all connected agents |
| `Escape` | Close palette |

---

## State Management

All global client state lives in a single **Zustand** store at `store/use-investigation-store.ts`.

### Key State Slices

| Slice | Type | Description |
|---|---|---|
| `activeWorkspace` | `"canvas" \| "map" \| "network" \| "timeline"` | Which workspace panel is visible |
| `nodes` / `edges` | `Node[]` / `Edge[]` | React Flow evidence board state |
| `incidentData` | `IncidentPoint[]` | 1,000 generated crime incident coordinates |
| `movementData` | `MovementArc[]` | 18 known movement routes between locations |
| `timeRange` | `[string, string]` | Active date filter window |
| `playbackDate` | `string` | Current date during map animation playback |
| `selectedSuspectId` | `string \| null` | Cross-filters map and network graph |
| `selectedCrimeTypes` | `string[]` | Active crime type filters on the map |
| `spatialBounds` | `SpatialBounds \| null` | Drawn geographic filter bounding box |
| `mapPanRequest` | `MapPanRequest \| null` | Triggers a programmatic map fly-to |
| `facts` | `InvestigationFact[]` | Fact ledger entries with status |
| `isCommandPaletteOpen` | `boolean` | Command palette visibility |
| `isQrModalOpen` | `boolean` | QR uplink modal visibility |
| `isLedgerOpen` | `boolean` | Fact ledger sidebar visibility |

### Key Actions

```ts
// Navigate workspaces
setActiveWorkspace("map" | "canvas" | "network" | "timeline")

// Map control
requestMapPan([lng, lat], targetId)   // triggers fly-to animation
setSpatialBounds(bounds | null)       // geographic filter

// Evidence board
addEvidenceNode(type, position)       // drop a new node at coordinates
pinFactToBoard(text)                  // paste fact text as sticky note
updateNodeData(nodeId, data)          // update node content
lockNode(nodeId, agentId)             // claim exclusive edit lock
unlockNode(nodeId, agentId)           // release lock

// Filters
clearAllFilters()                     // reset to defaults
toggleSelectedCrimeType(type)
setTimeRange([startDate, endDate])
```

---

## Design System

The UI is built around a deliberate **analog-brutalist** aesthetic with two fully-realized themes.

### Color Tokens (CSS Custom Properties)

```css
/* Light (Paper) Mode */
--paper:  #F4F4F0   /* off-white background */
--ink:    #000000   /* hard black borders & text */

/* Dark (Terminal) Mode */
--paper:  #01161E   /* deep navy background */
--ink:    #598392   /* muted teal borders */
```

### Typography

- **Serif** — for display headings (`The Fatal Ledger`)
- **Monospace** — for all metadata, labels, status text, and UI chrome
- All text is `uppercase` to reinforce the monolithic aesthetic

### Motion

All transitions use **Framer Motion** with short durations (0.15–0.2s) and `easeOut` curves. The philosophy: every interaction should feel immediate, not floaty.

### Brutalist Conventions

- `border-[3-4px] solid black` on all interactive elements
- `shadow-[4px_4px_0_black]` hard drop shadows (no blur)
- `active:translate-x-1 active:translate-y-1 active:shadow-none` — press-down effect
- Hover states lift elements with `hover:-translate-x-0.5 hover:-translate-y-0.5`

---

## Contributing

Pull requests are welcome for bug fixes and improvements.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run `npm run typecheck && npm run lint` — both must pass
5. Open a pull request

---

## License

MIT © 2026 — built with obsession for the TechRush 2026.
