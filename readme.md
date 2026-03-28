# gcode-viewer

Browser-based GCode visualization for the furniture manufacturing industry. Unlike typical GCode editors that only display tool paths, gcode-viewer renders the **final workpiece appearance** after machining using real-time CSG (Constructive Solid Geometry) boolean operations.

Runs entirely in the browser — no backend, no installation, no data leaves your machine.

## Features

- **3D workpiece visualization** — see the finished panel, not just tool paths
- **Real-time CSG** — powered by [manifold-3d](https://github.com/elalish/manifold) WASM running in a Web Worker (non-blocking UI)
- **Dual-color rendering** — surface laminate vs exposed core, like a real furniture panel
- **Arc tessellation** — G2/G3 arcs converted to linear segments for accurate CSG
- **Ramp milling** — diagonal tool descents visualized correctly
- **Drilling cycles** — G81/G82/G83 with peck drilling and dwell support
- **GCode editor** — CodeMirror 6 with syntax highlighting for G/M/T/F/S commands
- **Step-by-step playback** — interactive simulation with play/pause/step controls and line highlighting
- **7 camera presets** — perspective + top/bottom/front/back/right/left orthographic views
- **Tool database** — define tool diameters and tip types (flat, ball, drill, forstner, bull-nose), persisted in localStorage
- **File loading** — open `.nc`/`.gcode` files via file picker or drag-and-drop
- **Orbit controls** — rotate, pan, zoom the 3D view

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, load a GCode file or paste GCode into the editor.

### Sample files

The `samples/` directory includes test programs:

| File                             | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `furniture-panel-demo.nc`        | Pockets, holes, grooves, edge profiles, G81 drilling |
| `ramp-milling-test.nc`           | Diagonal tool descent patterns                       |
| `cabinet-hinge-drilling.nc`      | European hinge pattern with Forstner bit             |
| `drawer-dovetail-joint.nc`       | Woodworking joinery operations                       |
| `edge-profiling-chamfer.nc`      | Chamfering, corner rounding, ventilation slots       |
| `decorative-engraving-flower.nc` | Arc-based decorative engraving                       |

## Scripts

| Command                 | Description                   |
| ----------------------- | ----------------------------- |
| `npm run dev`           | Start dev server              |
| `npm run build`         | Type check + production build |
| `npm test`              | Run tests (Vitest)            |
| `npm run test:coverage` | Run tests with coverage       |
| `npm run lint`          | Lint source files             |
| `npm run format`        | Format source files           |
| `npm run typecheck`     | TypeScript type check         |

## Tech Stack

- **TypeScript** + **Vue 3** + **Vite**
- **Three.js** + **TresJS** — 3D rendering
- **manifold-3d** — CSG boolean operations (C++ compiled to WASM)
- **CodeMirror 6** — code editor
- **Pinia** — state management
- **Vitest** — testing

## Architecture

Seven modules organized as a unidirectional pipeline:

```
GCode Text → Parser → Simulation → CSG → Viewport
```

| Module     | Path              | Responsibility                                  |
| ---------- | ----------------- | ----------------------------------------------- |
| Parser     | `src/parser/`     | GCode text to typed operation sequence          |
| Simulation | `src/simulation/` | Operations to CSG requests with tool geometry   |
| CSG        | `src/csg/`        | Boolean subtraction via manifold-3d WASM Worker |
| Viewport   | `src/viewport/`   | 3D rendering with TresJS + orbit controls       |
| Editor     | `src/editor/`     | CodeMirror 6 with GCode syntax highlighting     |
| Tools      | `src/tools/`      | Tool database (localStorage persistence)        |
| App        | `src/app/`        | Shell layout, pipeline orchestration, file I/O  |

## Supported GCode

- **Motion**: G0 (rapid), G1 (linear feed), G2/G3 (arcs with I/J or R)
- **Positioning**: G90 (absolute), G91 (incremental)
- **Drilling**: G80 (cancel), G81 (simple), G82 (dwell), G83 (peck)
- **Plane**: G17 (XY plane)
- **Units**: G20 (inches), G21 (millimeters)
- **Tools**: T (select), M6 (change)
- **Spindle**: M3/M4/M5, S (speed)
- **Program**: M30 (end)
- **Comments**: semicolon and parenthesis styles
- **Workpiece dimensions**: parsed from `; Workpiece: WxHxT` comments

## License

Apache 2.0
