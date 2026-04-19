# CODEBASE.md - Fatopago

> System map and file dependency tracking for the Fatopago project.

---

## 🏗️ Technical Architecture

| Layer | Technology |
|-------|------------|
| **Core** | React + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 (Custom config) |
| **Icons** | Lucide React |
| **Routing** | React Router DOM |
| **Backend** | Supabase (Database, Auth, Storage) |
| **Logic** | Custom hooks & logic scripts (in `/scripts`) |

---

## 🗺️ Project Structure

```plaintext
d:/fatopago/
├── .agent/              # Antigravity Kit (Agents, Skills, Workflows)
├── docs/                # Technical documentation
├── public/              # Static assets
├── scripts/             # Backend/Logic helper scripts
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page/Route components
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Helper functions
│   ├── App.tsx          # Main routing & state orchestrator
│   └── main.tsx         # Entry point
└── GEMINI.md            # AI behavior rules
```

---

## 🔗 File Dependencies (Simplified)

### Core Flow
- **main.tsx** → App.tsx → ErrorBoundary.tsx
- **App.tsx** → (Pages) LandingPage, Login, Dashboard, ValidationHub, etc.
- **BottomNav.tsx** → Reused across all authenticated pages.

### Key Page Dependencies
| Page | Critical Imports |
|------|------------------|
| `App.tsx` | `react-router-dom`, All Page Components |
| `ValidationHub.tsx` | `supabase`, `ValidationTask.tsx` |
| `Ranking.tsx` | `src/types/index.ts` |
| `Profile.tsx` | `supabase` |

---

## 🛠️ Maintenance & Dev Ops
- Built with Vite: `npm run dev` for development.
- Deployed via Vercel / GitHub Actions (based on root config).
- VPS Deployment: Refer to `vps-upload-rules.md`.

---

> **Note:** Always update this file when adding new core components or changing project structure.
