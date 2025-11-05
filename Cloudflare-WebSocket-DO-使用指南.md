# Cloudflare Durable Objects WebSocket 休眠服务器使用指南

> 本文总结并提炼 Cloudflare Durable Objects 官方示例“WebSocket Hibernation Server”的用法，帮助你快速在 Workers 上构建支持休眠的 WebSocket 服务。
>
> 参考资料：Cloudflare 文档《Build a WebSocket server with WebSocket Hibernation》：https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/

---

## 适用场景
- 需要在 Cloudflare Workers 上维持大量 WebSocket 长连接，但又希望在连接空闲时释放运行时内存占用。
- 需要 Durable Object 在“被动唤醒”时恢复连接状态（例如房间成员列表、会话 ID 等）。
- 需要服务端对常见探测消息（如 `ping`）进行自动响应，而不唤醒业务代码。

## 前置条件
- 一个可用的 Cloudflare 账号。
- 安装 `wrangler`（Node.js 管理 CLI）：
  ```bash
  npm install -g wrangler
  ```
- Node.js 18+（Recommended）。

## 架构概览
- **Workers 路由**：在 `fetch()` 中处理对 `/websocket` 的升级请求。
- **Durable Object (DO)**：接受 WebSocket，启用“可休眠”模式，管理连接集合，并在被唤醒时恢复状态。
- **自动响应**：为常见心跳消息设置不唤醒的自动响应（如 `ping` → `pong`）。

## Worker 入口示例
使用 Modules 语法，在 Worker 中把所有 `/websocket` 请求转发到同一个 Durable Object 实例（示例用固定名称 `foo`）。

```ts
// src/index.ts
import { DurableObject } from "cloudflare:workers";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.url.endsWith("/websocket")) {
      const upgrade = request.headers.get("Upgrade");
      if (!upgrade || upgrade !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }
      if (request.method !== "GET") {
        return new Response("Expected GET", { status: 400 });
      }

      // 将所有请求路由到同一个 Durable Object（按名称）
      const stub = env.WEBSOCKET_HIBERNATION_SERVER.getByName("foo");
      return stub.fetch(request);
    }

    return new Response(
      "Supported endpoint: /websocket (WebSocket upgrade)",
      { status: 200, headers: { "Content-Type": "text/plain" } }
    );
  },
};

export class WebSocketHibernationServer extends DurableObject {
  // 维护当前连接映射（key: WebSocket，value: 会话信息）
  private sessions: Map<WebSocket, { id: string }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Map();

    // 恢复休眠中的 WebSocket（DO 唤醒时执行）
    this.ctx.getWebSockets().forEach((ws) => {
      const attachment = ws.deserializeAttachment();
      if (attachment) {
        this.sessions.set(ws, { ...attachment });
      }
    });

    // 为常见心跳设置自动响应（不唤醒 DO）
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  async fetch(request: Request) {
    // 创建双端连接并接受 WebSocket（可休眠）
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // 使用可休眠接受方式（区别于 ws.accept()）
    this.ctx.acceptWebSocket(server);

    // 生成会话 ID，并附着到连接，用于唤醒时恢复
    const id = crypto.randomUUID();
    server.serializeAttachment({ id });
    this.sessions.set(server, { id });

    return new Response(null, { status: 101, webSocket: client });
  }

  // 收到消息：回显并广播示例
  async webSocketMessage(ws: WebSocket, message: string) {
    const session = this.sessions.get(ws);
    if (!session) return;

    ws.send(
      `[DO] message: ${message}, from: ${session.id}, total: ${this.sessions.size}`
    );

    // 广播到所有连接
    this.sessions.forEach((_, conn) => {
      conn.send(
        `[DO] broadcast: ${message}, from: ${session.id}, total: ${this.sessions.size}`
      );
    });

    // 广播给除发起者外的连接
    this.sessions.forEach((_, conn) => {
      if (conn !== ws) {
        conn.send(
          `[DO] others: ${message}, from: ${session.id}, total: ${this.sessions.size}`
        );
      }
    });
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.sessions.delete(ws);
    // 可选：自定义关闭原因
    ws.close(code, reason ?? "Durable Object closing");
  }
}
```

> 关键点说明：
> - `this.ctx.acceptWebSocket(server)`：启用 WebSocket 休眠能力，使 DO 在空闲时可被回收，但连接保持。
> - `serializeAttachment()` / `deserializeAttachment()`：在连接上持久化轻量状态，便于唤醒时恢复。
> - `setWebSocketAutoResponse()`：为指定消息设置自动回复，不触发唤醒（适合心跳）。

## Wrangler 配置（wrangler.toml）
在项目根创建 `wrangler.toml`：

```toml
name = "websocket-hibernation"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "WEBSOCKET_HIBERNATION_SERVER", class_name = "WebSocketHibernationServer" }
]

[[migrations]]
tag = "v1"
new_classes = ["WebSocketHibernationServer"]
```

> 说明：
> - `bindings` 将 DO 暴露给 Worker（名称需与代码中的 `env.WEBSOCKET_HIBERNATION_SERVER` 一致）。
> - 每次新增/重命名 DO 类都需要追加新的 `migrations` 条目。

## 本地开发与测试
- 启动本地：
  ```bash
  wrangler dev
  ```
- 使用浏览器控制台测试：
  ```js
  const ws = new WebSocket("ws://localhost:8787/websocket");
  ws.onopen = () => ws.send("hello");
  ws.onmessage = (e) => console.log(e.data);
  ws.onclose = (e) => console.log("closed", e.code, e.reason);
  ```
- 或使用 `wscat`：
  ```bash
  npx wscat -c ws://localhost:8787/websocket
  > hello
  < [DO] message: hello, from: ..., total: 1
  ```

## 部署到 Cloudflare
```bash
wrangler deploy
```
部署后从 `https://<your-worker-subdomain>/websocket` 建立 WebSocket 连接即可。

## 常见问题排查
- 426 错误：请求缺少 `Upgrade: websocket` 头或不是 WebSocket 升级。
- 400 错误：方法不是 `GET`。确保使用 GET 发起升级请求。
- 绑定错误：`env.WEBSOCKET_HIBERNATION_SERVER` 未在 `wrangler.toml` 中配置或类名不匹配。
- 迁移缺失：新增 DO 类后未更新 `[[migrations]]`。按版本追加迁移条目。
- 唤醒状态缺失：未使用 `serializeAttachment()` 持久化会话信息，导致唤醒后无法恢复。

## 进阶用法
- 多房间/多实例：用 `getByName(roomId)` 或按 URL 参数计算 `roomId`，将不同房间路由到不同 DO。
- 精细广播：维护房间内成员集合，按需过滤广播目标（例如不发给发起者）。
- 轻量心跳：用 `setWebSocketAutoResponse("ping", "pong")` 降低唤醒频率，提高性能。

## 参考
- Cloudflare Durable Objects 示例：WebSocket Hibernation Server
  - https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/

---

如需将示例集成到现有项目，请按照本指南中的“Worker 入口示例”“Durable Object 类示例”和“Wrangler 配置”三部分依次完成，确保功能单元逐步实现并不影响既有功能的正常运行。