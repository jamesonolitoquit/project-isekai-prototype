# AI Role Manager

> **Purpose:** Reference system for Copilot models. Each chat box loads ONE role file to constrain the model's behavior, context, and responsibilities.

## How to Use

1. **Open a new Copilot chat box** for a specific task.
2. **Paste or attach the role file** from `roles/` that matches your task.
3. The model reads its role instructions and operates within those boundaries.
4. **Not sure which role?** Paste `router.md` first — it will classify your task and tell you which role to load.

## Role Index

| Role | File | When to Use |
|---|---|---|
| **AI Router** | `router.md` | Ambiguous tasks, multi-step work, task triage |
| **Coder** | `roles/coder.md` | Implement features, write code, build components |
| **Debugger** | `roles/debugger.md` | Fix bugs, trace errors, diagnose failures |
| **Planner** | `roles/planner.md` | Architecture decisions, roadmap, system design |
| **Reviewer** | `roles/reviewer.md` | Code review, PR checks, consistency audits |
| **Monetizer** | `roles/monetizer.md` | Business model, pricing, revenue, growth strategy |
| **Security** | `roles/security.md` | Auth, vulnerabilities, compliance, threat modeling |
| **System Thinker** | `roles/system-thinker.md` | Cross-cutting concerns, integration, scalability |

## Rules

- **One role per chat box.** Don't mix roles in the same conversation.
- **Router first if unsure.** The router will tell you which role(s) to invoke.
- **Roles reference plan files.** Each role specifies which `plans/*.md` files to load for context. Only load what's listed — don't dump the entire plans folder.
- **Phase-aware.** All roles respect the current roadmap phase. See `plans/28_ROADMAP.md`.
