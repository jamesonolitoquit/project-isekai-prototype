# Comparison: `chronicleEngine.ts` and `mutationLog.ts` (BETA vs PROTOTYPE)

Summary:

- Location (BETA): `BETA/src/engine/chronicleEngine.ts`, `BETA/src/events/mutationLog.ts`
- Location (PROTOTYPE): `legacy/PROTOTYPE/src/engine/chronicleEngine.ts`, `legacy/PROTOTYPE/src/events/mutationLog.ts`

Key differences (high-level):

1. `chronicleEngine.ts`
   - BETA: More feature-complete; integrates with `epochEvolutionEngine`, `loreEngine`, `eventCompactionEngine`, and other Phase-20+ systems. Uses typed imports and explicit archival flows (archiveLegacyAsLoreTomes).
   - PROTOTYPE: Simpler, with some features implemented inline (e.g., `extractGrandDeeds`) and several import lines commented out. Intended as a working prototype; fewer integration points and some alternate type shapes.

2. `mutationLog.ts`
   - BETA: Stronger invariants and defensive handling (monotonic timestamp allowance tolerance, snapshot event factory, snapshot-related APIs). Exposes snapshot factory functions for Phase-2+ features.
   - PROTOTYPE: Earlier variant: includes additional client-authoring metadata (`clientId`, `sequenceNumber`, `tick`) and slightly different timestamp checks. Simpler API surface.

Recommendation and actions taken:

- Keep **BETA** files as the authoritative, working versions for the active codebase (they are used by current builds and integrations).
- Preserve **PROTOTYPE** versions as historical reference. To make the historical intent explicit and avoid build collisions, the PROTOTYPE copies were moved to `legacy/PROTOTYPE/archived/` and renamed to include a `.prototype.ts` suffix.

Rationale:

- BETA contains the evolved and integrated code used by the current closed-beta product and unit tests; it is the correct file to continue iterating on.
- PROTOTYPE files represent historical implementations and are valuable for rollback or design review; keeping them in `legacy/PROTOTYPE/archived/` documents that they are intentionally preserved and not part of the active build.

If you prefer the opposite (keeping PROTOTYPE as canonical and archiving BETA), tell me and I'll reverse the retention decision.
