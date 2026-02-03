# Proposal: Fix Message History Overwrite Bug

## Why

当用户在 AI 正在回答第一个问题时发送第二个问题，第二个问题的消息可能会覆盖/混淆第一个问题的显示。这是因为流式传输过程中的消息索引计算存在竞态条件，导致两条消息可能使用相同的 `messageIndex`，造成 UI 层面的混淆和消息丢失。这个问题严重影响用户体验，特别是在连续提问场景下。

## What Changes

- **修复消息索引计算逻辑**: 在 `handleStreamUpdate` 中添加更可靠的消息索引生成机制
- **添加消息唯一标识**: 为每条消息添加唯一 ID（UUID），避免依赖数组索引
- **引入消息队列**: 添加待处理消息跟踪机制，确保消息按正确顺序添加
- **同步 UI 与存储状态**: 改进 `SESSIONS_UPDATED` 的处理逻辑，使用合并而非替换策略
- **添加竞态条件检测**: 在关键路径添加日志和警告，帮助发现潜在的竞态问题

## Capabilities

### New Capabilities
- `message-tracking`: 消息跟踪和唯一标识系统，确保消息按正确顺序显示

### Modified Capabilities
- *(暂无现有 specs 需要修改)*

## Impact

### 受影响文件
- `sandbox/controllers/message_handler.js` - 核心修复位置
- `sandbox/core/session_manager.js` - 添加消息 ID 支持
- `sidepanel/core/bridge.js` - 改进 SESSIONS_UPDATED 处理
- `background/managers/history_manager.js` - 添加消息 ID 到存储

### 向后兼容性
- 现有消息历史格式保持不变（新 ID 字段可选）
- 不影响现有 API 接口
- 无破坏性变更

### 测试要求
- 需要验证连续发送多条消息的场景
- 需要验证快速切换会话的场景
- 需要验证网络延迟下的消息顺序
