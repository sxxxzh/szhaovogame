# GameSDK 使用文档

面向浏览器小游戏门户的轻量级集成 SDK，用于完成用户认证、游戏嵌入、实时分数展示、自动分数上报与排行榜渲染。

## 功能概述

- 认证与状态显示：支持 OAuth 登录、退出、用户信息展示。
- 游戏嵌入：通过 `iframe` 加载游戏页面并定时读取游戏状态。
- 实时分数：在门户页显示当前分数与历史最佳分数。
- 自动上报：检测到游戏结束后自动上报分数到后端。
- 排行榜：渲染指定游戏的排行榜（前 10 条），异常时显示提示。

## 快速开始

1. 在门户页引入 SDK：

```html
<script src="sdk/game_sdk.js"></script>
```

2. 在页面中准备所需的 DOM 结构（默认选择器如下，可自定义）：

```html
<span id="userStatus">未登录</span>
<button id="loginBtn">登录</button>
<button id="logoutBtn" style="display:none">退出</button>

<div class="stats">
  <strong id="liveScore">0</strong>
  <strong id="liveBest">0</strong>
  <span id="submitStatus" style="display:none"></span>
  <!-- 上报状态文案显示区 -->
  <!-- 例如：正在提交分数… / 分数提交成功！ / 分数提交失败：xxx -->
  <!-- 可按需放置到页面合适位置 -->
  
</div>

<iframe id="gameFrame" class="game-frame"></iframe>

<ol id="leaderboard" class="leaderboard"></ol>
<div id="lbAlert" class="alert" style="display:none"></div>
```

3. 初始化 SDK：

- 仅认证（不加载游戏）：

```js
// 只负责登录/退出与用户状态显示
const sdk = new GameSDK({});
```

- 带游戏与排行榜：

```js
// gameKey 是游戏唯一标识（需与后端约定一致）
const sdk = new GameSDK({
  gameKey: '2048',
});

// 如需通过 SDK 设置游戏页面，可使用：
// sdk.showGame('games/2048'); // 将加载 games/2048/index.html 到 #gameFrame
```

> 轮询频率：当提供 `gameKey` 时，SDK 会每 600ms 调用一次 `pollGame()` 读取游戏状态。

## 选项（Options）

- `apiBase`（默认：`https://gameapi.szhaovo.cn`）
  - 后端服务地址，包含认证与分数相关接口。
  - 可在不同环境下覆盖为自有网关地址。

- `gameKey`（字符串，可选）
  - 游戏唯一标识，用于分数上报与排行榜查询。
  - 设置后 SDK 会自动轮询游戏状态、刷新排行榜。

- `selectors`（对象，可选）
  - 页面选择器映射，用于绑定 UI 节点。默认值：
  
```js
{
  userStatus: '#userStatus',
  loginBtn: '#loginBtn',
  logoutBtn: '#logoutBtn',
  gameFrame: '#gameFrame',
  leaderboard: '#leaderboard',
  submitStatus: '#submitStatus',
  liveScore: '#liveScore',
  liveBest: '#liveBest',
  lbAlert: '#lbAlert',
}
```

> 注意：`selectors` 为浅合并（整个对象覆盖），如需自定义请传入完整对象或确保提供你实际使用到的键。

## 页面集成流程说明

- 登录：点击 `#loginBtn` 后将跳转到 `apiBase + '/oauth/login'` 完成 OAuth 登录。
  - 登录成功后后端会以 `?token=...` 回传令牌，SDK 会自动写入 `localStorage['auth_token']`，并从地址栏移除 `token` 参数。

- 退出：点击 `#logoutBtn` 会调用 `POST /api/logout`，随后清除本地令牌并刷新用户状态。

- 用户状态：
  - SDK 初始化时会调用 `GET /api/me` 更新 `#userStatus` 文案（已登录 / 未登录），并按状态切换登录/退出按钮的显示。

- 游戏状态与上报：
  - SDK 通过 `iframe#gameFrame.contentWindow.gameAPI` 读取分数（`getScore`）、最佳分数（`getBestScore`）与结束状态（`isGameOver`）。
  - 当 `isGameOver()` 返回 `true` 时，将触发一次 `POST /api/scores/submit`（去重保护：同一局只提交一次）。
  - 提交成功后自动调用 `refreshLeaderboard()` 刷新排行榜。
  - 实时分数展示更新到 `#liveScore` 与 `#liveBest`，上报进度与结果显示在 `#submitStatus`。

- 排行榜：
  - SDK 调用 `GET /api/scores/leaderboard?game_key={gameKey}&limit=10` 渲染前 10 名。
  - 异常时在 `#leaderboard` 显示占位文案，并在 `#lbAlert` 显示提示（如“排行榜暂不可用”）。

## 游戏内 API 约定（重要）

每个被嵌入的游戏需在其 `window` 暴露统一接口 `window.gameAPI`：

```js
window.gameAPI = {
  // 当前分数（number）
  getScore: function () { /* ... */ },

  // 历史最佳分数（number）
  getBestScore: function () { /* ... */ },

  // 当前是否为“本局已结束”（boolean）
  // 返回 true 时 SDK 会进行一次分数上报
  isGameOver: function () { /* ... */ },
};
```

示例（2048）：

```js
window.gameAPI = {
  getScore: function() {
    return window.gameManager.score;
  },
  getBestScore: function() {
    return window.gameManager.storageManager.getBestScore();
  },
  isGameOver: function() {
    return window.gameManager.isGameTerminated();
  }
};
```

示例（Clumsy Bird）：

```js
window.gameAPI = {
  getScore: function() {
    return game.data.score;
  },
  getBestScore: function() {
    return me.save.topSteps;
  },
  isGameOver: function() {
    return game.data.gameover;
  }
};
```

## 可用方法（公共）

- `new GameSDK(options)`：构造并初始化 SDK。根据是否提供 `gameKey` 自动启用游戏轮询与排行榜。
- `sdk.showGame(gamePath)`：将 `iframe#gameFrame` 的地址设置为 `${gamePath}/index.html` 并立即开始轮询。
- `sdk.refreshLeaderboard()`：手动刷新排行榜（通常由 SDK 自动调用）。

> 其他方法如 `getToken`、`setToken`、`getAuthHeaders`、`refreshMe`、`pollGame`、`submitScore` 属于内部使用，正常集成无需直接调用。

## 后端接口（参考）

- `GET  {apiBase}/oauth/login`
  - 跳转到登录授权页面。
- `POST {apiBase}/api/logout`
  - 需要 `Authorization: Bearer <token>`。
- `GET  {apiBase}/api/me`
  - 返回当前登录用户信息，用于展示登录态。
- `GET  {apiBase}/api/scores/leaderboard?game_key={gameKey}&limit=10`
  - 返回 `items` 列表，含 `score`、`name`、`user_id`、`created_at` 等字段。
- `POST {apiBase}/api/scores/submit`
  - `body: { game_key: string, score: number }`，需要登录态与鉴权头。

## 集成建议与注意事项

- 在同一页面中推荐只维护一个 `GameSDK` 实例，以避免对登录/退出按钮的重复事件绑定。
- 如果需要切换游戏：
  - 方案 A：复用同一 SDK 实例，调用 `sdk.showGame('games/<key>')` 并更新页面文案。
  - 方案 B：重建 SDK 实例（如示例门户所示），但建议在重建前移除旧实例的事件监听或刷新页面。
- `selectors` 为浅覆盖，如果你自定义了选择器对象，需要确保包含你要用到的键，否则对应 UI 不会更新。
- 游戏需要在其生命周期合适的时机设置 `window.gameAPI`（例如首帧或加载完成后）。
- 当后端返回 401 时，SDK 会清除本地令牌并刷新用户状态，此时需重新登录。

## 示例：门户页加载与切换游戏

```html
<!-- 省略头部、样式等 -->
<div class="game-selection">
  <div class="game-card" data-game="2048">2048</div>
  <div class="game-card" data-game="clumsy-bird">Clumsy Bird</div>
  <!-- 更多卡片 -->
  
</div>
<div class="game-container"></div>

<script src="sdk/game_sdk.js"></script>
<script>
  const gameSelection = document.querySelector('.game-selection');
  const gameContainer = document.querySelector('.game-container');
  let sdk = new GameSDK({}); // 初始化认证与状态

  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const gameKey = card.dataset.game;

      // 切换视图
      gameSelection.style.display = 'none';
      gameContainer.style.display = 'block';

      // 创建 iframe（也可改用 sdk.showGame(`games/${gameKey}`)）
      gameContainer.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.id = 'gameFrame';
      iframe.src = `games/${gameKey}/index.html`;
      iframe.classList.add('game-frame');
      gameContainer.appendChild(iframe);

      // 为当前游戏启动 SDK（自动轮询 + 排行榜）
      sdk = new GameSDK({ gameKey });
    });
  });
</script>
```

## 目录结构参考

- `games/2048/`：2048 游戏（已实现 `window.gameAPI`）。
- `games/clumsy-bird/`：Clumsy Bird（已实现 `window.gameAPI`）。
- `sdk/game_sdk.js`：本 SDK 源码。
- `assets/portal.css`：门户页样式。

## 许可与版权

- 本仓库内游戏与第三方库遵循其各自许可。
- 本 SDK 为项目示例使用，按需扩展与调整。