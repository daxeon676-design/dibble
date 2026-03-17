# Dependency Audit Status

Last reviewed: 2026-03-17

## Current Result

- `npm audit --omit=dev` still reports 7 moderate vulnerabilities.
- The previous Next.js advisory set was reduced by upgrading from `16.1.6` to `16.1.7`.
- High-severity Hono and `@hono/node-server` issues were removed by transitive overrides.

## Remaining Findings

The remaining findings are all through the Prisma CLI toolchain path:

- `prisma`
- `@prisma/dev`
- `@mrleebo/prisma-ast`
- `chevrotain`
- `lodash`

These packages are part of the Prisma development toolchain rather than the deployed Next.js application runtime.

## Current Mitigation Position

- Runtime framework patched to `next@16.1.7`.
- Vulnerable Hono packages overridden to fixed versions.
- Remaining findings are moderate severity and tied to Prisma CLI transitive parser dependencies.
- No additional Prisma runtime release is currently available beyond `7.5.0` in this workspace.

## Recommended Launch Decision

Launch should not be blocked by these remaining findings alone if all of the following are true:

- The production deploy image does not ship Prisma CLI tooling for request handling.
- Database migration operations are restricted to trusted operators.
- Risk acceptance is recorded for the residual moderate dev-tooling findings.
- Re-check `npm audit --omit=dev` before final launch in case Prisma publishes a patched toolchain release.

## Follow-Up Actions

1. Watch for a Prisma release that removes the remaining transitive advisories.
2. Re-run `npm audit --omit=dev` before final production cutover.
3. Record risk acceptance in the launch decision if the findings remain unchanged.
