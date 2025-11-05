class GameSDK {
  constructor(options) {
    this.options = Object.assign({
      apiBase: 'https://gameapi.szhaovo.cn',
      selectors: {
        userStatus: '#userStatus',
        loginBtn: '#loginBtn',
        logoutBtn: '#logoutBtn',
        gameFrame: '#gameFrame',
        leaderboard: '#leaderboard',
        submitStatus: '#submitStatus',
        liveScore: '#liveScore',
        liveBest: '#liveBest',
        lbAlert: '#lbAlert',
      },
    }, options);

    this.els = {};
    for (const key in this.options.selectors) {
      this.els[key] = document.querySelector(this.options.selectors[key]);
    }

    this.TOKEN_KEY = 'auth_token';
    this.isSubmitting = false;
    this.init();
  }

  init() {
    this.checkForTokenInUrl();
    this.refreshMe();
    this.setupEventListeners();

    if (this.options.gameKey) {
      this.refreshLeaderboard();
      setInterval(() => this.pollGame(), 600);
    }
  }

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  checkForTokenInUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      this.setToken(token);
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('token');
      window.history.replaceState({}, document.title, newUrl.toString());
      return true;
    }
    return false;
  }

  setupEventListeners() {
    if (this.els.loginBtn) {
      this.els.loginBtn.addEventListener('click', () => {
        const url = `${this.options.apiBase}/oauth/login`;
        window.location.href = url;
      });
    }

    if (this.els.logoutBtn) {
      this.els.logoutBtn.addEventListener('click', async () => {
        try {
          await fetch(`${this.options.apiBase}/api/logout`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
          });
        } catch (e) {
          // Ignore
        }
        this.setToken(null);
        await this.refreshMe();
      });
    }
  }

  async refreshMe() {
    try {
      const token = this.getToken();
      if (!token) throw new Error('No token');

      const resp = await fetch(`${this.options.apiBase}/api/me`, {
        headers: this.getAuthHeaders(),
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          this.setToken(null);
        }
        throw new Error('Not logged in');
      }

      const me = await resp.json();
      if (this.els.userStatus) {
        this.els.userStatus.textContent = `已登录：${me.name || me.email || me.sub}`;
      }
      if (this.els.loginBtn) this.els.loginBtn.style.display = 'none';
      if (this.els.logoutBtn) this.els.logoutBtn.style.display = 'inline-block';
    } catch (e) {
      if (this.els.userStatus) this.els.userStatus.textContent = '未登录';
      if (this.els.loginBtn) this.els.loginBtn.style.display = 'inline-block';
      if (this.els.logoutBtn) this.els.logoutBtn.style.display = 'none';
    }
  }

  async refreshLeaderboard() {
    if (!this.els.leaderboard || !this.options.gameKey) return;
    try {
      this.els.leaderboard.innerHTML = ''; // Clear
      const resp = await fetch(`${this.options.apiBase}/api/scores/leaderboard?game_key=${this.options.gameKey}&limit=10`, {
        headers: this.getAuthHeaders(),
      });
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      (data.items || []).forEach((row, idx) => {
        const li = document.createElement('li');
        const name = row.name || (row.user_id ? row.user_id.slice(0, 6) : '匿名');
        const date = new Date(row.created_at).toLocaleString();
        li.innerHTML = `
          <div class="entry-main">
            <span class="nickname">${name}</span>: <span class="score">${row.score}</span>
          </div>
          <div class="entry-date">${date}</div>
        `;
        this.els.leaderboard.appendChild(li);
      });
      if (this.els.lbAlert) this.els.lbAlert.style.display = 'none';
    } catch (e) {
      this.els.leaderboard.innerHTML = '<li>暂无数据</li>';
      if (this.els.lbAlert) {
        this.els.lbAlert.style.display = 'block';
        this.els.lbAlert.textContent = '排行榜暂不可用。';
      }
    }
  }

  showGame(game) {
    this.els.gameFrame.src = `${game}/index.html`;
    if (this.els.submitStatus && !this.isSubmitting) {
      this.els.submitStatus.style.display = 'none';
    }

    this.pollGame();
  }

  async pollGame() {
    try {
      if (!this.els.gameFrame) {
        this.els.gameFrame = document.querySelector(this.options.selectors.gameFrame);
        if (!this.els.gameFrame) return; // Still not found, exit
      }

      const w = this.els.gameFrame.contentWindow;
      if (!w) return;

      let score = 0;
      let best = 0;
      let gameOver = false;

      if (w.gameAPI && typeof w.gameAPI.getScore === 'function' && typeof w.gameAPI.getBestScore === 'function' && typeof w.gameAPI.isGameOver === 'function') {
        // Standardized API
        score = w.gameAPI.getScore();
        best = w.gameAPI.getBestScore();
        gameOver = w.gameAPI.isGameOver();
      } else {
      }

      if (this.els.liveScore) this.els.liveScore.textContent = String(score || 0);
      if (this.els.liveBest) this.els.liveBest.textContent = String(best || 0);

      if (gameOver) {
        if (!this.submittedForRun) {
          this.submittedForRun = true;
          await this.submitScore(score);
        } else {
        }
      } else {
        if (this.submittedForRun) {
        }
        this.submittedForRun = false;
      }
    } catch (e) {
      console.error("[GameSDK] Error in pollGame:", e);
    }
  }

  async submitScore(score) {
    if (!this.els.submitStatus) {
        return;
    }
    this.isSubmitting = true;
    try {
      const token = this.getToken();
      if (!token) {
        this.els.submitStatus.textContent = '请先登录后再提交分数';
        return;
      }

      this.els.submitStatus.textContent = '正在提交分数…';
      this.els.submitStatus.style.display = 'inline';

      const resp = await fetch(`${this.options.apiBase}/api/scores/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ game_key: this.options.gameKey, score }),
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          this.setToken(null);
          await this.refreshMe();
          throw new Error('登录已过期，请重新登录');
        }
        const errorText = await resp.text();
        console.error("[GameSDK] API submission failed:", errorText);
        throw new Error(errorText);
      }
      this.els.submitStatus.textContent = '分数提交成功！';
      await this.refreshLeaderboard();
    } catch (e) {
      this.els.submitStatus.textContent = `分数提交失败：${e.message}`;
      console.error("[GameSDK] Error in submitScore:", e);
    } finally {
      this.isSubmitting = false;
    }
  }
}