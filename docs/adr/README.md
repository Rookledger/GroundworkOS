# Architecture Decision Records

Short records of the major architecture migrations this project has already
been through. They exist because the rationale for each migration was
previously scattered across code comments and README/DEPLOYMENT.md prose
with no single place to read it — see tech-debt audit finding #11
(`TECH_DEBT_AUDIT.md`). Each one is written from evidence already in the
repo (comments, README.md, DEPLOYMENT.md) at the time it was written, not
from memory of the actual decision meeting — treat citations as the source
of truth over the prose if the two ever disagree.

| #                                               | Decision                             | Status                |
| ----------------------------------------------- | ------------------------------------ | --------------------- |
| [0001](./0001-hono-on-cloudflare-workers.md)    | Express → Hono on Cloudflare Workers | Accepted, implemented |
| [0002](./0002-d1-instead-of-postgres.md)        | Postgres → Cloudflare D1 (SQLite)    | Accepted, implemented |
| [0003](./0003-better-auth-instead-of-clerk.md)  | Clerk → Better Auth                  | Accepted, implemented |
| [0004](./0004-cloudflare-instead-of-railway.md) | Railway → Cloudflare Pages/Workers   | Accepted, implemented |

New ADRs go in this directory as `NNNN-short-title.md`, numbered
sequentially. Write one when making a decision future contributors will
otherwise have to reconstruct from scattered comments — a framework/infra
swap, a data model tradeoff, a security-relevant design choice — not for
routine feature work.
