/* ============================================================
   events.js — all user interaction wiring
   Uses event delegation on the board for card/column actions, plus
   direct listeners for the header tools and dialogs. Mutations go
   through State; the DOM updates come back via re-render.
   ============================================================ */
(function (App) {
  "use strict";

  const { State, Render, Storage } = App;

  // Transient UI that must survive a full re-render.
  let openAddColumnId = null; // column whose inline "add card" box is open
  let editingCardId = null; // card currently open in the editor dialog
  let movingCardId = null; // card currently open in the move dialog
  let selectedLabel = null; // label chosen in the editor dialog

  function init() {
    const board = document.getElementById("board");

    // ---- Board delegation (clicks) ----
    board.addEventListener("click", onBoardClick);
    board.addEventListener("dblclick", onBoardDblClick);
    board.addEventListener("keydown", onBoardKeydown);

    // ---- Header tools ----
    document.getElementById("add-column-btn").addEventListener("click", () => {
      const col = State.addColumn("New Column");
      // Open the new column's title for editing.
      requestAnimationFrame(() => beginTitleEdit(col.id));
    });

    document.getElementById("search-input").addEventListener("input", (e) => {
      Render.setFilter(e.target.value);
    });

    initMenu();
    initCardDialog();
    initMoveDialog();
    initImport();
  }

  /** Re-apply transient UI after a full board re-render. */
  function afterRender() {
    if (openAddColumnId) openAddCardBox(openAddColumnId, false);
  }

  // ============================================================
  // Board click delegation
  // ============================================================
  function onBoardClick(e) {
    const btn = e.target.closest("button");
    const column = e.target.closest(".column");
    if (!column) return;
    const colId = column.dataset.columnId;

    if (!btn) return;

    if (btn.classList.contains("column__add")) {
      openAddCardBox(colId, true);
    } else if (btn.classList.contains("column__delete")) {
      confirmDeleteColumn(colId);
    } else if (btn.classList.contains("column__add-card-confirm")) {
      commitAddCard(column);
    } else if (btn.classList.contains("column__add-card-cancel")) {
      closeAddCardBox();
    } else if (btn.classList.contains("card__edit")) {
      openCardEditor(btn.closest(".card").dataset.cardId);
    } else if (btn.classList.contains("card__delete")) {
      deleteCardWithUndo(btn.closest(".card").dataset.cardId);
    } else if (btn.classList.contains("card__move")) {
      openMoveDialog(btn.closest(".card").dataset.cardId);
    }
  }

  function onBoardDblClick(e) {
    const title = e.target.closest(".column__title");
    if (title) {
      beginTitleEdit(title.closest(".column").dataset.columnId);
      return;
    }
    const card = e.target.closest(".card");
    if (card) openCardEditor(card.dataset.cardId);
  }

  function onBoardKeydown(e) {
    // Enter on a focused card opens its editor; for accessibility.
    const card = e.target.closest(".card");
    if (card && e.key === "Enter" && e.target === card) {
      e.preventDefault();
      openCardEditor(card.dataset.cardId);
    }
  }

  // ============================================================
  // Column title editing (inline contenteditable)
  // ============================================================
  function beginTitleEdit(colId) {
    const column = document.querySelector(`.column[data-column-id="${colId}"]`);
    if (!column) return;
    const title = column.querySelector(".column__title");

    title.contentEditable = "true";
    title.spellcheck = false;
    title.focus();
    selectAll(title);

    const finish = (commit) => {
      title.contentEditable = "false";
      title.removeEventListener("blur", onBlur);
      title.removeEventListener("keydown", onKey);
      if (commit) State.renameColumn(colId, title.textContent);
      else Render.draw(State.board); // revert
    };
    const onBlur = () => finish(true);
    const onKey = (e) => {
      if (e.key === "Enter") { e.preventDefault(); title.blur(); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    };

    title.addEventListener("blur", onBlur);
    title.addEventListener("keydown", onKey);
  }

  // ============================================================
  // Inline add-card box
  // ============================================================
  function openAddCardBox(colId, focus) {
    if (openAddColumnId && openAddColumnId !== colId) closeAddCardBox();
    openAddColumnId = colId;

    const column = document.querySelector(`.column[data-column-id="${colId}"]`);
    if (!column) return;
    const input = column.querySelector(".column__add-card-input");
    const actions = column.querySelector(".column__add-card-actions");
    input.hidden = false;
    actions.hidden = false;

    if (focus) {
      input.focus();
      // Scroll the column's card list to the bottom so the input is visible.
      const cards = column.querySelector(".column__cards");
      cards.scrollTop = cards.scrollHeight;
    }

    input.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitAddCard(column);
      } else if (e.key === "Escape") {
        closeAddCardBox();
      }
    };
  }

  function commitAddCard(column) {
    const colId = column.dataset.columnId;
    const input = column.querySelector(".column__add-card-input");
    const text = input.value;
    if (!text.trim()) { input.focus(); return; }
    State.addCard(colId, text);
    // State.commit re-rendered the board; re-open the box for rapid entry.
    openAddColumnId = colId;
    requestAnimationFrame(() => {
      const col = document.querySelector(`.column[data-column-id="${colId}"]`);
      if (col) col.querySelector(".column__add-card-input").focus();
    });
  }

  function closeAddCardBox() {
    openAddColumnId = null;
    Render.draw(State.board);
  }

  // ============================================================
  // Deletes (with undo)
  // ============================================================
  function deleteCardWithUndo(cardId) {
    const snapshot = clone(State.board);
    const found = State.deleteCard(cardId);
    if (found) {
      toast("Card deleted", "Undo", () => State.replaceBoard(snapshot));
    }
  }

  function confirmDeleteColumn(colId) {
    const col = State.getColumn(colId);
    if (!col) return;
    if (col.cards.length > 0) {
      const ok = confirm(`Delete "${col.title}" and its ${col.cards.length} card(s)?`);
      if (!ok) return;
    }
    const snapshot = clone(State.board);
    State.deleteColumn(colId);
    toast("Column deleted", "Undo", () => State.replaceBoard(snapshot));
  }

  // ============================================================
  // Card editor dialog
  // ============================================================
  function initCardDialog() {
    const dialog = document.getElementById("card-dialog");
    const form = document.getElementById("card-form");
    const swatches = document.getElementById("label-swatches");

    // Build label swatches once.
    const none = document.createElement("button");
    none.type = "button";
    none.className = "swatch swatch--none";
    none.textContent = "∅";
    none.title = "No label";
    none.dataset.label = "";
    swatches.appendChild(none);

    Object.entries(Render.LABELS).forEach(([id, color]) => {
      const s = document.createElement("button");
      s.type = "button";
      s.className = "swatch";
      s.style.background = color;
      s.dataset.label = id;
      s.title = id;
      swatches.appendChild(s);
    });

    swatches.addEventListener("click", (e) => {
      const s = e.target.closest(".swatch");
      if (!s) return;
      selectedLabel = s.dataset.label || null;
      paintSwatchSelection(swatches);
    });

    form.addEventListener("submit", () => {
      // method="dialog" closes the dialog automatically after this runs.
      if (!editingCardId) return;
      State.updateCard(editingCardId, {
        text: document.getElementById("card-text").value,
        label: selectedLabel,
        due: document.getElementById("card-due").value || null,
      });
      editingCardId = null;
    });

    document.getElementById("card-cancel").addEventListener("click", () => {
      editingCardId = null;
      dialog.close();
    });
  }

  function openCardEditor(cardId) {
    const found = State.findCard(cardId);
    if (!found) return;
    editingCardId = cardId;
    selectedLabel = found.card.label || null;

    document.getElementById("card-text").value = found.card.text;
    document.getElementById("card-due").value = found.card.due || "";
    paintSwatchSelection(document.getElementById("label-swatches"));

    const dialog = document.getElementById("card-dialog");
    dialog.showModal();
    document.getElementById("card-text").focus();
  }

  function paintSwatchSelection(swatches) {
    swatches.querySelectorAll(".swatch").forEach((s) => {
      const id = s.dataset.label || null;
      s.classList.toggle("swatch--active", id === selectedLabel);
    });
  }

  // ============================================================
  // Move dialog (mobile / no-drag fallback)
  // ============================================================
  function initMoveDialog() {
    document.getElementById("move-cancel").addEventListener("click", () => {
      movingCardId = null;
      document.getElementById("move-dialog").close();
    });
  }

  function openMoveDialog(cardId) {
    const found = State.findCard(cardId);
    if (!found) return;
    movingCardId = cardId;

    const wrap = document.getElementById("move-options");
    wrap.innerHTML = "";
    State.board.columns.forEach((col) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "move-options__btn";
      btn.textContent = col.title + (col.id === found.column.id ? "  (current)" : "");
      btn.disabled = col.id === found.column.id;
      btn.addEventListener("click", () => {
        State.moveCard(cardId, col.id, null); // append to end of target
        movingCardId = null;
        document.getElementById("move-dialog").close();
        toast(`Moved to "${col.title}"`);
      });
      wrap.appendChild(btn);
    });

    document.getElementById("move-dialog").showModal();
  }

  // ============================================================
  // Header menu (export / import / theme / reset)
  // ============================================================
  function initMenu() {
    const btn = document.getElementById("menu-btn");
    const dropdown = document.getElementById("menu-dropdown");

    const close = () => {
      dropdown.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      dropdown.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.hidden ? open() : close();
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.hidden && !dropdown.contains(e.target)) close();
    });

    dropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".menu__item");
      if (!item) return;
      close();
      handleMenuAction(item.dataset.action);
    });
  }

  function handleMenuAction(action) {
    if (action === "export") exportBoard();
    else if (action === "import") document.getElementById("import-file").click();
    else if (action === "theme") App.toggleTheme();
    else if (action === "reset") {
      if (confirm("Reset the board to the starter layout? This can't be undone.")) {
        State.resetBoard();
        toast("Board reset");
      }
    }
  }

  // ============================================================
  // Export / Import JSON
  // ============================================================
  function exportBoard() {
    const data = JSON.stringify(State.board, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban-board-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Board exported");
  }

  function initImport() {
    const fileInput = document.getElementById("import-file");
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Storage.isValid(data)) throw new Error("Invalid board file");
        if (confirm("Importing will replace your current board. Continue?")) {
          State.replaceBoard(data);
          toast("Board imported");
        }
      } catch (err) {
        alert("Could not import: " + err.message);
      } finally {
        fileInput.value = ""; // allow re-importing the same file
      }
    });
  }

  // ============================================================
  // Toast helper (optional action button, e.g. Undo)
  // ============================================================
  let toastTimer = null;
  function toast(message, actionLabel, actionFn) {
    const el = document.getElementById("toast");
    clearTimeout(toastTimer);
    el.innerHTML = "";

    const span = document.createElement("span");
    span.textContent = message;
    el.appendChild(span);

    if (actionLabel && actionFn) {
      const btn = document.createElement("button");
      btn.className = "toast__action";
      btn.textContent = actionLabel;
      btn.addEventListener("click", () => {
        actionFn();
        hideToast(el);
      });
      el.appendChild(btn);
    }

    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("toast--show"));
    toastTimer = setTimeout(() => hideToast(el), 4000);
  }

  function hideToast(el) {
    el.classList.remove("toast--show");
    setTimeout(() => { el.hidden = true; }, 220);
  }

  // ============================================================
  // Small DOM utilities
  // ============================================================
  function selectAll(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function clone(obj) {
    return typeof structuredClone === "function"
      ? structuredClone(obj)
      : JSON.parse(JSON.stringify(obj));
  }

  App.Events = { init, afterRender, toast };
})(window.Kanban = window.Kanban || {});
