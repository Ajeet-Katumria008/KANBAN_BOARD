/* ============================================================
   storage.js — localStorage persistence layer
   Pure read/write of the board state. Knows nothing about the DOM.
   ============================================================ */
(function (App) {
  "use strict";

  const KEY = "kanban.board.v1";
  const THEME_KEY = "kanban.theme.v1";

  const Storage = {
    /** Load the saved board, or null if nothing/invalid is stored. */
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return Storage.isValid(data) ? data : null;
      } catch (err) {
        console.warn("Failed to load board from storage:", err);
        return null;
      }
    },

    /** Persist the full board state. */
    save(board) {
      try {
        localStorage.setItem(KEY, JSON.stringify(board));
        return true;
      } catch (err) {
        console.error("Failed to save board:", err);
        return false;
      }
    },

    clear() {
      localStorage.removeItem(KEY);
    },

    loadTheme() {
      return localStorage.getItem(THEME_KEY) || null;
    },

    saveTheme(theme) {
      localStorage.setItem(THEME_KEY, theme);
    },

    /** Minimal shape validation so corrupt/old data can't crash render. */
    isValid(data) {
      return (
        data &&
        Array.isArray(data.columns) &&
        data.columns.every(
          (col) =>
            col &&
            typeof col.id === "string" &&
            typeof col.title === "string" &&
            Array.isArray(col.cards)
        )
      );
    },
  };

  App.Storage = Storage;
})(window.Kanban = window.Kanban || {});
