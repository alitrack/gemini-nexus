## Context

The Gemini Nexus extension has a critical bug where sending a second message while the first AI response is still streaming can cause message display corruption. The root cause is in how message indices are calculated in `handleStreamUpdate()` - it uses `session.messages.length` which doesn't account for in-progress streaming messages.

Current architecture:
- `message_handler.js` handles UI updates during streaming
- `session_manager.js` manages the session state
- `history_manager.js` persists messages to storage and broadcasts updates
- `bridge.js` handles SESSIONS_UPDATED events from background

The bug occurs because:
1. User sends message A
2. AI starts responding (streaming)
3. User sends message B before A's response completes
4. Both streaming bubbles get the same `messageIndex` because `session.messages.length` hasn't been updated yet
5. This causes UI confusion and potential message loss

## Goals / Non-Goals

**Goals:**
- Fix the message index collision issue
- Ensure unique message identification
- Maintain message order consistency
- Add race condition detection/logging
- Improve state synchronization between UI and background

**Non-Goals:**
- Redesign the entire messaging architecture
- Add real-time collaboration features
- Change the storage format (keep backward compatible)
- Implement complex conflict resolution strategies

## Decisions

### Decision 1: Add message ID (UUID) alongside index
**Rationale**: Array indices are not reliable identifiers, especially with concurrent operations. UUIDs provide stable identification regardless of array position.
- **Alternative**: Use timestamps - rejected because collisions possible with rapid messages
- **Trade-off**: Slightly more memory usage, but negligible

### Decision 2: Use pending message queue for index calculation
**Rationale**: Need to track in-flight messages to calculate correct indices for new messages.
- Implementation: Add `pendingMessages` Set in `PromptController`
- When calculating index: `session.messages.length + pendingMessages.size`
- **Alternative**: Always append and re-render - rejected for performance reasons

### Decision 3: Merge strategy for SESSIONS_UPDATED
**Rationale**: Complete replacement causes loss of local state changes.
- Strategy: Merge by message ID, prefer local state for recent changes (< 5 seconds)
- **Alternative**: Last-write-wins with timestamps - rejected due to clock skew issues

### Decision 4: Add defensive logging
**Rationale**: Race conditions are hard to reproduce, need logs to diagnose.
- Log when duplicate indices detected
- Log when state divergence detected
- Use `console.warn` for visibility in production

## Risks / Trade-offs

**[Risk] Memory leak from pending message queue** → **Mitigation**: Always clear pending entries in finally blocks, add periodic cleanup

**[Risk] Performance degradation from UUID generation** → **Mitigation**: Use lightweight UUID v4, measure impact, consider lazy generation

**[Risk] Backward compatibility issues** → **Mitigation**: Make message ID optional, handle missing IDs gracefully, maintain existing storage format

**[Risk] Complex merge logic introduces new bugs** → **Mitigation**: Keep merge logic simple and well-tested, add extensive unit tests

**[Trade-off] Code complexity vs robustness** - The fix adds some complexity but significantly improves reliability for a critical user-facing feature.

## Migration Plan

1. **Phase 1**: Deploy with logging-only mode to gather data on race conditions
2. **Phase 2**: Enable fix for new messages (messages without ID use old logic)
3. **Phase 3**: Full rollout with ID generation for all messages

Rollback strategy: Can disable fix by reverting to old index calculation logic.

## Open Questions

1. Should we add a visual indicator for pending messages?
2. How should we handle message regeneration with the new ID system?
3. Do we need to migrate existing sessions to add IDs?
