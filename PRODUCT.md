# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated implementation: build a static documentation site with Node.js and Markdown, served by GitHub Pages. No application backend is required.

## Users

Product, engineering and QA teams use the public site to agree on scope, implement the control plane, and review delivery evidence.

## Product Purpose

Publish the product requirements, technical design and engineering roadmap together as an accessible engineering handbook.

## Capabilities and Constraints

- Product readers choose scope and acceptance conditions in the PRD. Developers use the technical design, the node protocol and the operation permissions register to implement tasks assigned in the roadmap. Reference pages preserve full protocol vectors, source locations and evidence records.
- Use docs/site-meta.json for the design baseline and document publication dates.
- Preserve XC React reuse, the first-release Go core/agent retention, and the separate single-tenant 10,000-node acceptance gate.
- Publication does not demonstrate that the platform or capacity tests have been implemented.
- Remove machine-specific absolute paths and unavailable private embeds from the published artifact.
- Provide readable navigation, search, diagrams, printing, and Markdown download.
- Do not invent pricing, licensing, implementation status, or performance evidence.
- Keep acceptance IDs, state transitions, and core persistence fields machine-checkable and bidirectionally traceable.

## Evidence on Hand

The sources of record are indexed in docs/README.md. The technical specifications and operation ledger identify reviewed source commits. No new source-code review or capacity testing is part of this publication task.

## Open Decisions

Audience behavior and visual preferences beyond the publication request are not separately confirmed. The delegated implementation assumes an engineering documentation reading experience with keyboard access and mobile readability.
