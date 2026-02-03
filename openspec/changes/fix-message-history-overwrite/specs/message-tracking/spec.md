## ADDED Requirements

### Requirement: Message unique identification
The system SHALL assign a unique identifier (UUID) to every message when it is created.

#### Scenario: User message creation
- **WHEN** a user sends a message
- **THEN** the system SHALL generate a unique message ID
- **AND** store it with the message metadata

#### Scenario: AI response creation
- **WHEN** an AI response starts streaming
- **THEN** the system SHALL generate a unique message ID
- **AND** associate it with the streaming response

### Requirement: Message index calculation
The system SHALL calculate message indices correctly even when multiple messages are being processed concurrently.

#### Scenario: Sequential message sending
- **WHEN** user sends a message while another AI response is still streaming
- **THEN** the system SHALL assign a unique index to the new message
- **AND** not overwrite or confuse the existing streaming message

#### Scenario: Rapid successive messages
- **WHEN** user sends multiple messages in quick succession
- **THEN** each message SHALL have a distinct index
- **AND** the UI SHALL display them in the correct order

### Requirement: State synchronization
The system SHALL handle SESSIONS_UPDATED events without causing state conflicts or message loss.

#### Scenario: Background update during streaming
- **WHEN** a SESSIONS_UPDATED event arrives while a message is streaming
- **THEN** the system SHALL merge the updates rather than replace the local state
- **AND** preserve any messages that exist locally but not in the update

#### Scenario: UI state consistency
- **WHEN** the user performs an action that modifies session messages (e.g., regeneration)
- **AND** a SESSIONS_UPDATED event arrives shortly after
- **THEN** the system SHALL preserve the user's recent changes
- **AND** merge them with the server state appropriately

### Requirement: Pending message tracking
The system SHALL track pending (in-progress) messages to prevent index collisions.

#### Scenario: Message queue management
- **WHEN** a message starts being generated
- **THEN** the system SHALL add it to a pending messages queue
- **AND** use the queue to calculate correct indices for subsequent messages

#### Scenario: Message completion handling
- **WHEN** a pending message completes or fails
- **THEN** the system SHALL remove it from the pending queue
- **AND** move it to the permanent message list

### Requirement: Race condition detection
The system SHALL detect and log potential race conditions to aid debugging.

#### Scenario: Duplicate index detection
- **WHEN** the system detects two messages attempting to use the same index
- **THEN** it SHALL log a warning with details
- **AND** assign a corrected index to prevent UI corruption

#### Scenario: State inconsistency detection
- **WHEN** the local session state diverges from the storage state
- **THEN** the system SHALL detect the inconsistency
- **AND** trigger an appropriate resolution strategy
