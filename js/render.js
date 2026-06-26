/* ============================================================
   render.js — state -> DOM
   Renders the whole board from the current state. Re-render on
   every change (the board is small; correctness beats diffing).
   Event wiring lives in events.js, not here.
   ============================================================ */
(function (App) {
  "use strict";

  // Available label colors (id -> swatch color).
  const LABELS = {
    red: "#eb5a46",
    orange: "#ff9f1a",
    yellow: "#f2d600",
    green: "#61bd4f",
    blue: "#0079bf",
    purple: "#a86cd4",
  };

  const boardEl = () => document.getElementById("board");
  const tplColumn = () => document.getElementById("tpl-column");
  const tplCard = () => document.getElementById("tpl-card");

  let query = "";

  const Render = {
    LABELS,

    setFilter(q) {
      query = (q || "").trim().toLowerCase();
      Render.draw(App.State.board);
    },

    getFilter() {
      return query;
    },

    /** Full redraw of the board element. */
    draw(board) {
      const root = boardEl();
      root.innerHTML = "";

      board.columns.forEach((col) => root.appendChild(buildColumn(col)));

      if (board.columns.length === 0) {
        const empty = document.createElement("p");
        empty.className = "board__empty";
        empty.textContent = "No columns yet — add one to get started.";
        empty.style.cssText = "color:var(--c-text-soft);padding:20px;margin:auto;";
        root.appendChild(empty);
      }
    },
  };

  function buildColumn(col) {
    const node = tplColumn().content.firstElementChild.cloneNode(true);
    node.dataset.columnId = col.id;

    node.querySelector(".column__title").textContent = col.title;

    const matchingCards = filterCards(col.cards);
    node.querySelector(".column__count").textContent = matchingCards.length;

    const cardsWrap = node.querySelector(".column__cards");
    col.cards.forEach((card) => cardsWrap.appendChild(buildCard(card)));

    return node;
  }

  function buildCard(card) {
    const node = tplCard().content.firstElementChild.cloneNode(true);
    node.dataset.cardId = card.id;

    node.querySelector(".card__text").textContent = card.text;

    // Label color bar.
    const labelEl = node.querySelector(".card__label");
    if (card.label && LABELS[card.label]) {
      labelEl.style.background = LABELS[card.label];
      labelEl.hidden = false;
    }

    // Due date pill.
    const dueEl = node.querySelector(".card__due");
    if (card.due) {
      dueEl.hidden = false;
      dueEl.textContent = "📅 " + formatDue(card.due);
      const status = dueStatus(card.due);
      if (status) dueEl.classList.add(`card__due--${status}`);
    }

    // Search highlight / dim.
    if (query) {
      const isMatch = card.text.toLowerCase().includes(query);
      node.classList.toggle("card--match", isMatch);
      node.classList.toggle("card--dim", !isMatch);
    }

    return node;
  }

  function filterCards(cards) {
    if (!query) return cards;
    return cards.filter((c) => c.text.toLowerCase().includes(query));
  }

  function formatDue(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /** "overdue" | "soon" (within 2 days) | "" */
  function dueStatus(iso) {
    const due = new Date(iso + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return "overdue";
    if (days <= 2) return "soon";
    return "";
  }

  App.Render = Render;
})(window.Kanban = window.Kanban || {});
