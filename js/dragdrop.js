/* ============================================================
   dragdrop.js — HTML Drag & Drop API wiring
   Implements dragstart / dragover / drop using event delegation
   on the board. Computes the drop index from pointer position so
   cards can be reordered within a column and moved across columns.
   Touch users get the ↔ "move to" fallback (wired in events.js).
   ============================================================ */
(function (App) {
  "use strict";

  const { State } = App;

  let draggingId = null;

  function init(boardEl) {
    boardEl.addEventListener("dragstart", onDragStart);
    boardEl.addEventListener("dragend", onDragEnd);
    boardEl.addEventListener("dragover", onDragOver);
    boardEl.addEventListener("dragleave", onDragLeave);
    boardEl.addEventListener("drop", onDrop);
  }

  function onDragStart(e) {
    const card = e.target.closest(".card");
    if (!card) return;
    draggingId = card.dataset.cardId;
    card.classList.add("card--dragging");
    e.dataTransfer.effectAllowed = "move";
    // Required for Firefox to start a drag.
    e.dataTransfer.setData("text/plain", draggingId);
  }

  function onDragEnd(e) {
    const card = e.target.closest(".card");
    if (card) card.classList.remove("card--dragging");
    clearDropStyles();
    draggingId = null;
  }

  function onDragOver(e) {
    const zone = e.target.closest(".column__cards");
    if (!zone || !draggingId) return;
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = "move";

    clearDropStyles();
    zone.classList.add("column__cards--drop");
    zone.closest(".column").classList.add("column--drag-over");
  }

  function onDragLeave(e) {
    const zone = e.target.closest(".column__cards");
    if (zone && !zone.contains(e.relatedTarget)) {
      zone.classList.remove("column__cards--drop");
      const col = zone.closest(".column");
      if (col) col.classList.remove("column--drag-over");
    }
  }

  function onDrop(e) {
    const zone = e.target.closest(".column__cards");
    if (!zone || !draggingId) return;
    e.preventDefault();

    const column = zone.closest(".column");
    const targetColId = column.dataset.columnId;
    const targetIndex = computeDropIndex(zone, e.clientY);

    State.moveCard(draggingId, targetColId, targetIndex);
    clearDropStyles();
    draggingId = null;
  }

  /**
   * Decide where in the column the card should land based on pointer Y:
   * insert before the first card whose vertical midpoint is below the cursor.
   * The currently-dragged card is ignored so indices stay correct.
   */
  function computeDropIndex(zone, clientY) {
    const cards = [...zone.querySelectorAll(".card")].filter(
      (c) => c.dataset.cardId !== draggingId
    );

    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        // Map back to an index in the real (unfiltered-aware) card list.
        return indexInColumn(zone, cards[i].dataset.cardId);
      }
    }
    return null; // append to end
  }

  /** Resolve a card's true index within its column in state. */
  function indexInColumn(zone, cardId) {
    const colId = zone.closest(".column").dataset.columnId;
    const col = State.getColumn(colId);
    if (!col) return null;
    const idx = col.cards.findIndex((c) => c.id === cardId);
    return idx === -1 ? null : idx;
  }

  function clearDropStyles() {
    document
      .querySelectorAll(".column__cards--drop")
      .forEach((el) => el.classList.remove("column__cards--drop"));
    document
      .querySelectorAll(".column--drag-over")
      .forEach((el) => el.classList.remove("column--drag-over"));
  }

  App.DragDrop = { init };
})(window.Kanban = window.Kanban || {});
