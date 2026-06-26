/* ============================================================
   app.js — composition root
   Boots the modules in the right order and connects the
   state -> render -> events pipeline. This is the only file that
   knows about all the others.
   ============================================================ */
(function (App) {
  "use strict";

  const { State, Render, Events, DragDrop, Storage } = App;

  // ---- Theme ----
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    Storage.saveTheme(theme);
  }
  App.toggleTheme = function () {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  };

  function initTheme() {
    const saved = Storage.loadTheme();
    if (saved) {
      applyTheme(saved);
    } else if (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) {
      applyTheme("dark");
    }
  }

  function start() {
    initTheme();

    // 1. Load state.
    State.init();

    // 2. Whenever state changes, re-render then restore transient UI.
    State.subscribe((board) => {
      Render.draw(board);
      Events.afterRender();
    });

    // 3. First paint.
    Render.draw(State.board);

    // 4. Wire interactions + drag and drop.
    Events.init();
    DragDrop.init(document.getElementById("board"));

    // 5. Keep multiple tabs in sync.
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith("kanban.board")) {
        const fresh = Storage.load();
        if (fresh) {
          State.board = fresh;
          Render.draw(fresh);
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.Kanban = window.Kanban || {});
