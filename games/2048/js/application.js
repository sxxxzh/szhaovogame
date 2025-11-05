// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  // 暴露全局实例以便门户页读取分数与游戏状态
  window.gameManager = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);

  // SDK接口
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
});
