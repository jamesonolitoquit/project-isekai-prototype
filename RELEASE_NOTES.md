# v0.1-baseline-hardening

Summary
-------

This release marks a safe baseline for the ledger hardening work:

- Deterministic canonicalization of event payloads.
- Domain-separated, versioned hashing for event integrity.
- Hardened `appendEvent()` with monotonic per-world timestamps, contiguous event indexes, prev-hash linkage, and duplicate detection.
- Events and payloads are deep-frozen after hashing to prevent in-memory tampering.
- Added comprehensive invariants tests to detect tampering, reordering, and nondeterminism.

Testing & Coverage
------------------

- New tests: `PROTOTYPE/src/__tests__/mutationLog.invariants.test.ts`
- Existing determinism tests updated: `PROTOTYPE/src/__tests__/mutationLog.determinism.test.ts`
- Local test run: all tests passed; `mutationLog.ts` coverage ≈ 98.6% statements, 86.8% branches.

Upgrade / Migration Notes
------------------------

- Runtime-compatible change: consumers of the runtime do not need to migrate data formats.
- Verifier tool (`PROTOTYPE/tools/hash_verify.js`) and snapshot were updated to align with the canonicalization and hashing changes.

Post-Merge Actions
------------------

1. Merge the PR `ledger/hardening-snapshot-update` into `main`.
2. Create an annotated tag and push it:

```bash
git checkout main
git pull origin main
git tag -a v0.1-baseline-hardening -m "Baseline: ledger hardening (canonicalization, hash chain, invariants)"
git push origin v0.1-baseline-hardening
```

3. (Optional) Create a GitHub Release from the tag:

```bash
gh release create v0.1-baseline-hardening --title "v0.1 Baseline — Ledger Hardening" --notes-file RELEASE_NOTES.md
```

4. Once CI produces named status checks, update branch protection to require the exact CI check context(s).

Contact / Notes
---------------

If you want, I can 1) create the annotated tag after you merge, 2) create the GitHub Release automatically, or 3) update branch protection to reference exact CI checks once they exist. Reply with which action you want me to take next.
