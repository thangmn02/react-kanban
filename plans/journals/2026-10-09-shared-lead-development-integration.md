---
title: Shared Lead development integration
date: 2026-10-09
summary: Mechanical Web/Desktop parity passed; human listening and release gates remain open.
---

# Shared Lead development integration

## Work
Implemented the frozen server-only Lead Pulse and existing Demo/cache integration. All 213 checked event timestamps/source/MIDI values matched Web and native WebView exactly. Full JavaScript suite: 786 tests; server Python: 28 tests.

## Corrections
Removed an unsupported MELODIA probability floor without tuning ownership to holdouts. Preserved invalid outputs and original checkpoints. Isolated Python 3.14 Essentia from legacy Torch. Added metadata lease cleanup. A temporary test mount outlived browser disconnect: finally reload now restores the application. Port 5173 was recovered after interruption; owned desktop test processes stopped.

## Stop boundary
Human listening, authorized live-input/cloud delivery, rights and weak-hardware gates remain open. No deployment, database changes, training or Phase 5. AgentWiki publish skipped.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
