/* ============================================================
   state.js — single source of truth + mutations
   Holds the board model. Every mutation persists and notifies
   subscribers. The DOM is never touched here.

   Board shape:
   {
     columns: [
       { id, title, cards: [ { id, text, label, due, createdAt } ] }
     ]
   }
   ============================================================ */
(function (App) {
  "use strict";

  const { Storage } = App;

  const uid = (prefix) =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  function seedBoard() {
    return {
      columns: [
        {
          id: uid("col"),
          title: "To Do",
          cards: [
            { id: uid("card"), text: "Welcome! Double-click a card to edit it.", label: "blue", due: null, createdAt: Date.now() },
            { id: uid("card"), text: "Drag cards between columns to move them.", label: null, due: null, createdAt: Date.now() },
          ],
        },
        {
          id: uid("col"),
          title: "In Progress",
          cards: [
            { id: uid("card"), text: "On a phone? Use the ↔ button to move cards.", label: "purple", due: null, createdAt: Date.now() },
          ],
        },
        { id: uid("col"), title: "Done", cards: [] },
      ],
    };
  }

  const subscribers = new Set();

  const State = {
    board: { columns: [] },

    /** Subscribe to state changes. Returns an unsubscribe fn. */
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    /** Initialize from storage or seed a starter board. */
    init() {
      State.board = Storage.load() || seedBoard();
      // Don't auto-save the seed until the user changes something? We save so
      // a refresh keeps the same ids. This is intentional.
      Storage.save(State.board);
    },

    /** Persist + notify. Called internally after each mutation. */
    commit() {
      Storage.save(State.board);
      subscribers.forEach((fn) => fn(State.board));
    },

    replaceBoard(board) {
      State.board = board;
      State.commit();
    },

    resetBoard() {
      State.board = seedBoard();
      State.commit();
    },

    // ---- Lookups -------------------------------------------------
    getColumn(colId) {
      return State.board.columns.find((c) => c.id === colId) || null;
    },

    findCard(cardId) {
      for (const col of State.board.columns) {
        const idx = col.cards.findIndex((c) => c.id === cardId);
        if (idx !== -1) return { column: col, card: col.cards[idx], index: idx };
      }
      return null;
    },

    // ---- Column mutations ---------------------------------------
    addColumn(title = "New Column") {
      const col = { id: uid("col"), title, cards: [] };
      State.board.columns.push(col);
      State.commit();
      return col;
    },

    renameColumn(colId, title) {
      const col = State.getColumn(colId);
      if (!col) return;
      col.title = title.trim() || "Untitled";
      State.commit();
    },

    deleteColumn(colId) {
      State.board.columns = State.board.columns.filter((c) => c.id !== colId);
      State.commit();
    },

    // ---- Card mutations -----------------------------------------
    addCard(colId, text) {
      const col = State.getColumn(colId);
      if (!col || !text.trim()) return null;
      const card = { id: uid("card"), text: text.trim(), label: null, due: null, createdAt: Date.now() };
      col.cards.push(card);
      State.commit();
      return card;
    },

    updateCard(cardId, patch) {
      const found = State.findCard(cardId);
      if (!found) return;
      Object.assign(found.card, patch);
      if (typeof found.card.text === "string") found.card.text = found.card.text.trim();
      State.commit();
    },

    deleteCard(cardId) {
      const found = State.findCard(cardId);
      if (!found) return null;
      found.column.cards.splice(found.index, 1);
      State.commit();
      return found;
    },

    /**
     * Move a card to a target column at a given index (reorder or cross-column).
     * If targetIndex is null/undefined, the card is appended.
     */
    moveCard(cardId, targetColId, targetIndex) {
      const found = State.findCard(cardId);
      const target = State.getColumn(targetColId);
      if (!found || !target) return;

      // Remove from source.
      const [card] = found.column.cards.splice(found.index, 1);

      // Clamp index into the target list.
      let idx = targetIndex;
      if (idx == null || idx > target.cards.length) idx = target.cards.length;
      if (idx < 0) idx = 0;

      target.cards.splice(idx, 0, card);
      State.commit();
    },
  };

  App.State = State;
  App.uid = uid;
})(window.Kanban = window.Kanban || {});
