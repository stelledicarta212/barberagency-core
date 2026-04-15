# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BarberAgency is a multi-tenant SaaS for barber shops. The stack is:

- **Database**: PostgreSQL with Row Level Security (RLS) via `jwt_user_id()`
- **API Layer**: PostgREST (auto-generates REST endpoints from DB schema)
- **Backend Automation**: n8n workflows (webhooks for reservations, reminders, etc.)
- **Frontend**: WordPress (serves landing pages and dashboard)
- **Agent System**: Multi-agent AI orchestrator (Express server on port 3001)

## Key Commands

```bash
# Install dependencies
npm install

# Start the agent orchestrator API (port 3001)
node agentes/js/server.js
```

No test framework is configured. `package.json` only has express, dotenv, and node-fetch as dependencies.

## Architecture

### Multi-Agent AI Orchestrator (`agentes/`)

The core of this repo is an AI agent system that routes requests to specialized agents:

```
POST /agents/run  →  runJefe()  →  decidePlan()  →  agentChain()
   (server.js)        (jefe.js)     (jefe.js)       (agentManager.js)
```

- **`agentes/js/server.js`** — Express API entry point (`/agents/run`)
- **`agentes/js/jefe.js`** — Orchestrator: analyzes request, decides which agents to call via `decidePlan()`, then executes them sequentially with `agentChain()`
- **`agentes/js/agentManager.js`** — Runs individual agents via OpenRouter, chains results, supports auto-stop when result is good enough
- **`agentes/js/gemini.js`** — OpenRouter API client (misnamed, works with any model)
- **`agentes/js/promptBuilder.js`** — Constructs prompts with agent focus, project rules, master context, and memory snippets
- **`agentes/js/loadMasterContext.js`** — Loads all `.md` files from `agentes/skills/` as system context
- **`agentes/js/agentModels.js`** — Maps each agent to an OpenRouter model
- **`agentes/js/tools.js`** — Available tools for agents: `createFile`, `runSQL`, `callAPI`

### Agent Skills (`agentes/skills/`)

Each `.md` file defines a specialized agent's role and context:

| Skill | File | Focus |
|-------|------|-------|
| arquitecto | `arquitecto.md` | System architecture, multi-tenant design |
| backend | `backend.md` | n8n workflows, PostgREST, data consistency |
| frontend | `frontend.md` | Landing pages, templates, UI |
| database | `database.md` | SQL schema, RLS, triggers |

### Agent Rules (`agentes/rules/`)

- **`system-rules.md`** — Immutable rules: auth, multi-tenant isolation, citations anti-overlap, PostgREST, n8n, RLS
- **`coding-rules.md`** — Coding standards
- **`dependencies.md`** — Allowed dependencies
- **`scope.md`** — Scope boundaries
- **`glossary.md`** — Domain terms

### Database Schema (`app/database/schema/bdmaster.md`)

PostgreSQL multi-tenant schema with:

| Table | Purpose |
|-------|---------|
| `usuarios` | SaaS platform users (admin/barbero roles) |
| `barberias` | Tenant (barber shops), soft-delete via `deleted_at` |
| `planes` | SaaS subscription plans |
| `subscriptions` | Tenant subscription lifecycle |
| `barberos` | Barbers per tenant, linked to `usuarios` |
| `servicios` | Services per tenant |
| `horarios` | Weekly hours per tenant |
| `clientes_finales` | End customers per tenant |
| `citas` | Appointments with anti-overlap constraint (gist exclusion) |
| `pagos` | Payments per appointment |
| `productos` | Products inventory per tenant |
| `gastos` | Expenses per tenant |
| `barberia_public_profiles` | Public-facing profile per tenant |
| `barberia_theme` | Theme colors per tenant |
| `barberia_assets` | Media assets per tenant |

Key patterns:
- All tenant tables have `barberia_id` FK
- RLS policies filter by `owner_id = jwt_user_id()`
- `citas` table has `EXCLUDE USING gist` constraint to prevent overlapping appointments
- PostgREST uses `anon` (public reads) and `authenticated` (CRUD with JWT) roles

## Template System (`project/templates/`)

WordPress-landing template variants stored under `project/templates/plantillas/`. Base CSS editor styles in `project/templates/base/editor.css`.

## Documentation

- `agentes/context/` — Agent context files (DB schema, endpoints, landing spec, n8n workflows)
- `docs/` — UI system, template engine, data contracts, technical flow docs
- `app/frontend/onboarding/` — Barber shop onboarding docs

## Guardrails

1. **Never break multi-tenant isolation** — `barberia_id` must always be respected, RLS is mandatory
2. **Do not modify auth system** — Google Identity Services + n8n + JWT cookie `ba_session`
3. **Respect appointment constraints** — no overlapping citas, respect `slot_min` grid, validate against `horarios`
4. **RLS always** — never bypass RLS policies
5. **n8n endpoint responses** — 201 success, 409 conflict (slot clash), 400 validation error