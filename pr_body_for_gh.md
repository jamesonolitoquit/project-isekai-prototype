Baseline hardening snapshot: deterministic `mutationLog` + invariants tests

Summary

- Restores a deterministic `mutationLog` implementation with canonicalization, domain-separated hashing, and strict ledger invariants.
- Adds a focused invariants test suite (`src/__tests__/mutationLog.invariants.test.ts`) covering monotonic timestamps, index continuity, truncation behavior, hash domain separation, canonicalization determinism, and deep immutability.
- Tightens `.gitignore` to exclude generated artifacts and browser baseline files.

Notes

- This PR is a recovery/hardening baseline, not feature-complete. It stabilizes the ledger layer and raises coverage for `mutationLog.ts` to help future changes.
- Please run CI and review tests/coverage before merging. Merge only when CI is green.

Files changed (high level)

- `PROTOTYPE/src/events/mutationLog.ts` (ledger hardening)
- `PROTOTYPE/src/__tests__/mutationLog.invariants.test.ts` (new invariants tests)
- `.gitignore` (tightened)

If you'd like, I can also open the PR in the browser for manual editing instead of creating it directly via the CLI.
