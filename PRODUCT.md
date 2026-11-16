# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated implementation: build a static documentation site with Node.js and Markdown, served by GitHub Pages. No application backend is required.

## Users

The project team and public readers need to read, review, and reference the existing 1Panel v2 Cloudflare control-plane technical plan.

## Product Purpose

Publish the full design version 2.1 as an accessible public documentation repository and static website in XCAngelWatch.

## Capabilities and Constraints

- Preserve all 15 chapters and appendices A–E from the supplied plan.
- Keep the design baseline dated 2026-11-12 and distinguish it from the publication date.
- Preserve XC React reuse, the first-release Go core/agent retention, and the separate single-tenant 10,000-node acceptance gate.
- Publication does not demonstrate that the platform or capacity tests have been implemented.
- Remove machine-specific absolute paths and unavailable private embeds from the published artifact.
- Provide readable navigation, search, diagrams, printing, and Markdown download.
- Do not invent pricing, licensing, implementation status, or performance evidence.

## Evidence on Hand

The complete current technical plan is the source document. The source repository and exact reviewed commit are referenced within that plan. No new source-code review or capacity testing is part of this publication task.

## Open Decisions

Audience behavior and visual preferences beyond the publication request are not separately confirmed. The delegated implementation assumes an engineering documentation reading experience with keyboard access and mobile readability.
