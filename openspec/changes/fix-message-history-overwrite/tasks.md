## 1. Core Message Tracking Infrastructure

- [x] 1.1 Add `generateMessageId()` utility function to `lib/utils.js`
- [x] 1.2 Modify `session_manager.js` to support message IDs in `addMessage()`
- [x] 1.3 Add `pendingMessages` Set to `PromptController` for tracking in-flight messages
- [x] 1.4 Update message object structure to include optional `id` field (backward compatible)

## 2. Fix Message Index Calculation

- [x] 2.1 Modify `handleStreamUpdate()` in `message_handler.js` to use pending message count for index calculation
- [x] 2.2 Add duplicate index detection and logging in `handleStreamUpdate()`
- [x] 2.3 Update streaming bubble creation to include message ID
- [x] 2.4 Ensure pending messages are tracked when generation starts and removed when complete

## 3. State Synchronization Improvements

- [ ] 3.1 Implement merge logic for `SESSIONS_UPDATED` in `bridge.js`
- [ ] 3.2 Add message ID-based merging instead of full replacement
- [ ] 3.3 Add recent change detection (5 second window) to prefer local state
- [ ] 3.4 Add divergence detection and logging when states don't match

## 4. Background Script Updates

- [x] 4.1 Modify `history_manager.js` to include message IDs when saving
- [x] 4.2 Update `appendAiMessage()` to accept and store message ID
- [ ] 4.3 Ensure `appendUserMessage()` also supports message IDs
- [ ] 4.4 Add logging for storage operations related to message conflicts

## 5. UI and Controller Updates

- [x] 5.1 Update `appendMessage()` in `message.js` to accept and store message ID on DOM element
- [ ] 5.2 Modify message update logic to use ID for finding correct message
- [x] 5.3 Ensure `handleGeminiReply()` properly handles message IDs
- [ ] 5.4 Update regeneration flow to preserve and update message IDs correctly

## 6. Race Condition Detection and Logging

- [x] 6.1 Add warning logs when duplicate indices are detected
- [ ] 6.2 Add warning logs when state divergence is detected
- [x] 6.3 Log pending message queue state for debugging
- [ ] 6.4 Add performance markers for message operations

## 7. Testing and Validation

- [ ] 7.1 Test rapid successive message sending (3+ messages quickly)
- [ ] 7.2 Test message sending during streaming
- [ ] 7.3 Test session switching during generation
- [ ] 7.4 Test regeneration with the new system
- [ ] 7.5 Verify backward compatibility with old sessions (no ID field)
- [ ] 7.6 Test edge case: cancel and immediate resend

## 8. Documentation

- [ ] 8.1 Update code comments for modified functions
- [ ] 8.2 Add JSDoc for new public methods
- [x] 8.3 Update BUGS-AND-IMPROVEMENTS.md to mark this issue as resolved
- [ ] 8.4 Add entry to CHANGELOG.md describing the fix
