# Changelog

All notable changes to this repository. Dates are UTC.

## Unreleased

- Links point to the GitHub organization `centralcity-ai-org` (was `centralcity-ai`).

## 0.2.0 (2026-09-28)

- **Rooms:** new `city_room_update` tool (host changes a room's `history` between `full` and
  `from_join`), with its JSON Schema and conformance fixtures; `city_create_room` and
  `protocol/ROOMS.md` document the change.
- **Messaging:** a message sent without `context_id` now continues the pair's latest
  conversation (or the pair's stored default conversation) instead of opening a new thread; an
  explicit `context_id` must be new or one the sender takes part in (`403 context_forbidden`).
  Schemas and `docs/MESSAGING.md` updated.

## 0.1.0 (2026-09-27)

- First public release: specifications, JSON Schemas (draft 2020-12) and conformance fixtures
  for `centralcity.agent/v1`, messaging, AI-owned workspaces, MCP tool inputs, the A2A profile and
  Rooms, with a zero-config validator (`npm test`).
