# Gemini Nexus 问题清单

> 创建于: 2026-02-03
> 来源: 代码审查和架构分析

---

## 🔴 P0 - 严重问题（影响核心功能）

### 1. 消息历史覆盖问题

**文件**: `sandbox/controllers/message_handler.js` (第 87-117 行)

**问题描述**:
- 当用户发送第二条消息时，如果第一条消息的 AI 响应还在流式传输中，`session.messages.length` 可能还没有包含第一条的 AI 响应
- 这会导致两条消息使用相同的 `messageIndex`，造成 UI 层面的混淆
- 用户看到的可能是：第二个问题覆盖/混淆了第一个问题的显示

**代码位置**:
```javascript
// handleStreamUpdate 函数
if (this.app.prompt.isRegenerating && this.app.prompt.regenerateIndex !== null) {
    messageIndex = this.app.prompt.regenerateIndex;
} else if (session) {
    // 对于正常流程，AI 消息将在末尾
    messageIndex = session.messages.length;  // ← 问题在这里
}
```

**解决方案**:
- 添加消息 ID 机制确保唯一性
- 在创建 streaming bubble 前检查是否已有相同索引的消息
- 使用 pending message 队列来跟踪正在生成的消息

---

### 2. SESSIONS_UPDATED 与本地状态竞态条件

**文件**: 
- `background/managers/history_manager.js`
- `sandbox/controllers/message_handler.js`
- `sidepanel/core/bridge.js`

**问题描述**:
- Background 保存消息后会广播 `SESSIONS_UPDATED`
- UI 在 `handleGeminiReply` 中也会操作 `session.messages`（如 regeneration 逻辑）
- 如果 `SESSIONS_UPDATED` 在 UI 操作 `session.messages` 之后到达，会覆盖本地修改
- 导致用户看到的历史记录和实际存储的不一致

**解决方案**:
- 实现消息合并策略而非完全替换
- 添加版本号/时间戳来检测冲突
- 使用乐观锁或最后写入者获胜策略

---

### 3. Prompt Handler 流式传输竞态条件

**文件**: `background/handlers/session/prompt_handler.js` (第 26-34 行)

**问题描述**:
```javascript
const onUpdate = (partialText, partialThoughts) => {
    chrome.runtime.sendMessage({
        action: "GEMINI_STREAM_UPDATE",
        text: partialText,
        thoughts: partialThoughts
    }).catch(() => {});  // ← 错误被静默忽略
};
```

- 如果在流式传输过程中 UI 被关闭，`sendMessage` 会失败
- 错误被静默忽略，background 继续发送更新到已关闭的 UI
- 可能导致内存泄漏和无效的计算资源浪费

**解决方案**:
- 检测 UI 是否仍然存活
- 添加心跳机制或连接状态检查
- 在发送失败多次后停止流式传输

---

## 🟡 P1 - 中等问题（影响稳定性）

### 4. 空 Catch 块（静默吞错）

**文件**:
- `services/providers/openai_compatible.js:109`
- `sandbox/core/i18n.js:280`
- `background/handlers/session/prompt_handler.js:142`
- `background/handlers/session/prompt/builder.js:37`

**问题描述**:
```javascript
} catch(e) {}
```

- 错误被静默吞掉，导致调试困难
- 生产环境中无法追踪问题根源

**解决方案**:
- 添加日志记录
- 分类处理不同类型的错误
- 用户友好的错误提示

---

### 5. Session Manager AbortController 竞态条件

**文件**: `background/managers/session_manager.js` (第 18-23 行)

**问题描述**:
```javascript
async handleSendPrompt(request, onUpdate) {
    this.cancelCurrentRequest();
    this.abortController = new AbortController();  // ← 可能被快速请求覆盖
```

- 如果两个请求几乎同时到达，第一个请求可能被取消
- 但 `abortController` 可能被第二个请求覆盖
- 导致第一个请求的清理逻辑不正确

**解决方案**:
- 使用请求队列
- 为每个请求分配唯一 ID
- 确保正确的清理顺序

---

### 6. Viewer 内存泄漏

**文件**: `sandbox/ui/viewer.js` (第 39-66 行)

**问题描述**:
```javascript
document.addEventListener('mousemove', (e) => this.pan(e));
document.addEventListener('mouseup', () => this.endPan());
document.addEventListener('gemini-view-image', ...);
document.addEventListener('keydown', ...);
```

- document 级别的事件监听器在 viewer 关闭时没有被移除
- 如果 viewer 被频繁创建/销毁，会导致内存泄漏

**解决方案**:
- 添加 `destroy()` 方法清理事件监听器
- 使用 WeakMap 或 Signal 模式
- 在关闭时显式移除监听器

---

## 🟢 P2 - 改进建议（增强功能）

### 7. 消息草稿自动保存

**需求**:
- 在输入框中输入时自动保存到 localStorage
- 页面刷新后可以恢复未发送的消息

**实现建议**:
- 监听 input 事件
- 使用防抖保存
- 启动时检查并恢复

---

### 8. 会话导入功能

**需求**:
- 既然已经有了导出功能，应该添加导入功能
- 支持 Markdown 或 JSON 格式

**实现建议**:
- 添加文件选择器
- 验证导入格式
- 合并或替换现有会话

---

### 9. 消息搜索功能

**需求**:
- 在历史会话中搜索关键词
- 高亮匹配内容

**实现建议**:
- 添加搜索框
- 使用 Fuse.js 或类似库进行模糊搜索
- 实时过滤会话列表

---

### 10. 自动重试机制

**需求**:
- 对于网络错误（如 429），自动重试而不是直接报错
- 指数退避策略

**实现建议**:
- 封装 fetch 调用
- 可配置重试次数和延迟
- 用户可取消重试

---

## 📋 修复计划

### 阶段 1: 核心 Bug 修复 (P0)
1. [ ] 修复消息历史覆盖问题
2. [ ] 修复 SESSIONS_UPDATED 竞态条件
3. [ ] 修复流式传输竞态条件

### 阶段 2: 稳定性改进 (P1)
4. [ ] 修复空 catch 块
5. [ ] 修复 AbortController 竞态条件
6. [ ] 修复 Viewer 内存泄漏

### 阶段 3: 功能增强 (P2)
7. [ ] 实现消息草稿自动保存
8. [ ] 实现会话导入功能
9. [ ] 实现消息搜索功能
10. [ ] 实现自动重试机制

---

## 🛠️ 技术债务

- [ ] 添加 TypeScript 类型定义以提高代码健壮性
- [ ] 实现单元测试覆盖核心逻辑
- [ ] 添加性能监控和错误追踪
