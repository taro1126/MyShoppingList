
let items = [];

const DEFAULT_CATEGORIES = [
  "スーパー",
  "ドラッグストア",
  "雑貨・文房具",
  "その他"
];

let categories = [...DEFAULT_CATEGORIES];
let showCompleted = localStorage.getItem("showCompletedItems") === "true";
let collapsedCategories = new Set();
const UNDO_DURATION_MS = 5000;
let pendingUndoItems = [];
let undoExpiryTimer = null;
let appToastTimer = null;
const COMPLETED_HIDE_DELAY_MS = 1000;
const pendingCompletedHide = new Set();
const completedHideTimers = new Map();

// ドラッグ中の情報
let activeDrag = null;


// 商品をまとめて登録する処理
function addItemsFromText(text) {
  const input = document.getElementById("itemInput");
  const categoryInput = document.getElementById("categoryInput");

  const names = text
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(name => name !== "");

  if (names.length === 0) return;

  const category = categoryInput.value;

  names.forEach(name => {
    items.push({
      id: createId(),
      name,
      checked: false,
      category
    });
  });

  input.value = "";
  saveItems();
  displayItems();
  input.focus();
}

// 追加ボタンからの登録
function addItem(event) {
  if (event) event.preventDefault();

  const input = document.getElementById("itemInput");
  addItemsFromText(input.value);
}

// ID作成
function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

// ボタン作成
function createButton(label, action, className = "") {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.onclick = action;

  if (className) button.className = className;

  return button;
}

function createIconButton(icon, label, action, className = "") {
  const button = createButton(icon, action, `icon-button ${className}`.trim());
  if (icon === "copy") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const front = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    front.setAttribute("x", "8");
    front.setAttribute("y", "8");
    front.setAttribute("width", "13");
    front.setAttribute("height", "13");
    front.setAttribute("rx", "2.5");

    const back = document.createElementNS("http://www.w3.org/2000/svg", "path");
    back.setAttribute("d", "M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8");

    svg.append(front, back);
    button.replaceChildren(svg);
  } else if (icon === "edit") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const pencil = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pencil.setAttribute("d", "M5 18.5l3.2-.7L18 8a2.1 2.1 0 0 0-3-3l-9.8 9.8L5 18.5z M13.8 6.2l4 4");
    svg.append(pencil);
    button.replaceChildren(svg);
  }
  button.setAttribute("aria-label", label);
  button.title = label;
  return button;
}

function createActionsToggle(label, actions) {
  const button = createButton("⋯", () => {
    const isOpen = actions.classList.toggle("actions-open");
    button.setAttribute("aria-expanded", String(isOpen));
  }, "actions-toggle");
  button.setAttribute("aria-label", `${label}の操作を表示`);
  button.setAttribute("aria-expanded", "false");
  button.title = `${label}の操作`;
  return button;
}

async function copyCategoryItems(category, actions) {
  const text = items
    .filter(item => item.category === category && !item.checked)
    .map(item => item.name)
    .join("\n");

  try {
    if (!text) {
      showAppToast("コピーする商品がありません");
      return;
    }

    const copied = await writeClipboardText(text);
    showAppToast(copied ? "コピーしました" : "コピーできませんでした");
  } finally {
    closeCategoryActions(actions);
  }
}

async function writeClipboardText(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Clipboard APIが使えない場合は従来方式で再試行する。
    }
  }

  const textarea = document.createElement("textarea");
  const previousFocus = document.activeElement;
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;opacity:0;font-size:16px;";
  document.body.appendChild(textarea);

  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  } finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  return copied;
}

function showAppToast(message) {
  const toast = document.getElementById("appToast");
  if (!toast) return;

  if (appToastTimer) clearTimeout(appToastTimer);
  toast.textContent = message;
  toast.hidden = false;
  appToastTimer = setTimeout(() => {
    toast.hidden = true;
    appToastTimer = null;
  }, 2200);
}

function closeCategoryActions(actions) {
  actions.classList.remove("actions-open");
  actions.classList.add("actions-dismissed");
  actions.parentElement
    .querySelector(".actions-toggle")
    ?.setAttribute("aria-expanded", "false");
}

// ドラッグハンドル作成
function createDragHandle(type, id, label) {
  const handle = document.createElement("button");

  handle.type = "button";
  handle.className = "drag-handle";

  if (type === "category") {
    handle.classList.add("category-drag-handle");
  }

  handle.textContent = "⠿";
  handle.setAttribute("aria-label", label);
  handle.dataset.dragType = type;
  handle.dataset.dragId = id;

  return handle;
}

// 画面表示
function displayItems() {
  const list = document.getElementById("itemList");
  list.replaceChildren();
  updateCompletedToggle();

  categories.forEach(category => {
    const section = document.createElement("section");
    section.className = "category-section";
    section.dataset.category = category;

    // カテゴリ見出し
    const header = document.createElement("div");
    header.className = "category-header";
    const isCollapsed = collapsedCategories.has(category);
    header.setAttribute("aria-expanded", String(!isCollapsed));

    const categoryHandle = createDragHandle(
      "category",
      category,
      category + "を並び替え"
    );

    const title = document.createElement("button");
    title.type = "button";
    title.className = "category-title";
    title.setAttribute("aria-expanded", String(!isCollapsed));
    title.setAttribute("aria-label", `${category}を${isCollapsed ? "展開" : "折りたたむ"}`);

    const disclosure = document.createElement("span");
    disclosure.className = "category-disclosure";
    disclosure.textContent = isCollapsed ? "▶" : "▼";

    const titleText = document.createElement("span");
    titleText.textContent = category;

    // カテゴリ内の商品件数
    const itemCount = document.createElement("span");
    itemCount.className = "category-count";
    const categoryItems = items.filter(item => item.category === category);
    const visibleItemCount = showCompleted
      ? categoryItems.length
      : categoryItems.filter(item => !item.checked).length;
    itemCount.textContent = `（${visibleItemCount}件）`;

    title.append(disclosure, titleText, itemCount);
    title.addEventListener("click", () => toggleCategory(category));

    const categoryControls = document.createElement("div");
    categoryControls.className = "category-controls";

    const categoryActions = document.createElement("div");
    categoryActions.className = "category-actions";
    categoryActions.append(
      createIconButton(
        "copy",
        "未購入商品をコピー",
        () => copyCategoryItems(category, categoryActions),
        "copy-category"
      ),
      createIconButton("edit", "カテゴリ名を編集", () => renameCategory(category), "edit-button"),
      createIconButton(
        "×",
        "カテゴリを削除",
        () => deleteCategory(category),
        "delete-category"
      )
    );
    categoryControls.append(
      createActionsToggle("カテゴリ", categoryActions),
      categoryActions
    );
    header.addEventListener("pointerleave", () => {
      categoryActions.classList.remove("actions-dismissed");
    });
    header.addEventListener("focusin", event => {
      if (!categoryActions.contains(event.target) &&
          !event.target.classList.contains("actions-toggle")) {
        categoryActions.classList.remove("actions-dismissed");
      }
    });

    header.append(categoryHandle, title, categoryControls);

    // 商品一覧
    const itemList = document.createElement("div");
    itemList.className = "item-list";
    itemList.hidden = isCollapsed;

    const allCategoryItems = categoryItems;
    if (allCategoryItems.length === 0) {
      section.classList.add("category-empty");
    }
    const displayedCategoryItems = showCompleted
      ? allCategoryItems
      : allCategoryItems.filter(
          item => !item.checked || pendingCompletedHide.has(item.id)
        );

    if (displayedCategoryItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-message";
      empty.textContent = allCategoryItems.length > 0
        ? "完了済みは非表示です"
        : "商品はありません";
      itemList.appendChild(empty);
    }

    displayedCategoryItems.forEach(item => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.dataset.itemId = item.id;

      const itemHandle = createDragHandle(
        "item",
        item.id,
        item.name + "を並び替え"
      );

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.checked;

      checkbox.onchange = () => {
        item.checked = checkbox.checked;

        const existingTimer = completedHideTimers.get(item.id);
        if (existingTimer) clearTimeout(existingTimer);

        if (item.checked) {
          pendingCompletedHide.add(item.id);
          completedHideTimers.set(item.id, setTimeout(() => {
            pendingCompletedHide.delete(item.id);
            completedHideTimers.delete(item.id);
            displayItems();
          }, COMPLETED_HIDE_DELAY_MS));
        } else {
          pendingCompletedHide.delete(item.id);
          completedHideTimers.delete(item.id);
        }

        saveItems();
        displayItems();
      };

      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = item.name;
      name.tabIndex = 0;
      name.setAttribute("role", "button");
      name.setAttribute("aria-expanded", "false");
      name.setAttribute("aria-label", `${item.name}の操作を表示`);
      name.title = "タップして編集・削除を表示";

      const toggleItemActions = () => {
        const isOpen = itemActions.classList.toggle("actions-open");
        name.setAttribute("aria-expanded", String(isOpen));
        name.setAttribute(
          "aria-label",
          `${item.name}の操作を${isOpen ? "隠す" : "表示"}`
        );
      };
      name.addEventListener("click", toggleItemActions);
      name.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleItemActions();
        }
      });

      if (item.checked) {
        name.classList.add("checked");
      }

      const controls = document.createElement("div");
      controls.className = "item-controls";

      const itemActions = document.createElement("div");
      itemActions.className = "item-actions";
      itemActions.append(
        createIconButton(
          "edit",
          "商品名を編集",
          () => beginEditItem(item, row, name, itemActions),
          "edit-button"
        ),
        createIconButton(
          "×",
          "商品を削除",
          () => deleteItem(item.id),
          "delete-button"
        )
      );
      controls.append(itemActions);

      row.append(itemHandle, checkbox, name, controls);
      itemList.appendChild(row);
    });

    section.append(header, itemList);
    list.appendChild(section);
  });
}

function beginEditItem(item, row, nameElement, controls) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "item-name-input";
  input.value = item.name;
  input.setAttribute("aria-label", "商品名");

  const save = () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }

    item.name = name;
    saveItems();
    displayItems();
  };

  const cancel = () => displayItems();

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  });

  row.replaceChild(input, nameElement);
  controls.replaceChildren(
    createButton("保存", save, "save-button"),
    createButton("取消", cancel)
  );
  input.focus();
  input.select();
}

function updateCompletedToggle() {
  const button = document.getElementById("completedToggle");
  if (!button) return;

  const completedCount = items.filter(item => item.checked).length;
  button.textContent = showCompleted
    ? `完了を隠す（${completedCount}）`
    : `完了を表示（${completedCount}）`;
  button.setAttribute("aria-expanded", String(showCompleted));
}

function toggleCompletedItems() {
  showCompleted = !showCompleted;
  localStorage.setItem("showCompletedItems", String(showCompleted));
  displayItems();
}

function toggleCategory(category) {
  if (collapsedCategories.has(category)) {
    collapsedCategories.delete(category);
  } else {
    collapsedCategories.add(category);
  }

  saveCollapsedCategories();
  displayItems();
}

function saveCollapsedCategories() {
  localStorage.setItem(
    "shoppingCollapsedCategories",
    JSON.stringify([...collapsedCategories])
  );
}

function loadCollapsedCategories() {
  try {
    const saved = localStorage.getItem("shoppingCollapsedCategories");
    const loaded = saved ? JSON.parse(saved) : [];

    if (Array.isArray(loaded)) {
      collapsedCategories = new Set(
        loaded.filter(category => categories.includes(category))
      );
    }
  } catch (error) {
    console.error("カテゴリの開閉状態読み込みエラー", error);
    collapsedCategories = new Set();
  }
}

// 商品削除
function deleteItem(id) {
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return;

  const completedHideTimer = completedHideTimers.get(id);
  if (completedHideTimer) clearTimeout(completedHideTimer);
  completedHideTimers.delete(id);
  pendingCompletedHide.delete(id);

  const [item] = items.splice(index, 1);
  pendingUndoItems.push({ item, index, expiresAt: Date.now() + UNDO_DURATION_MS });

  saveItems();
  displayItems();
  updateUndoNotice();
}

function undoDelete() {
  const now = Date.now();
  pendingUndoItems = pendingUndoItems.filter(entry => entry.expiresAt > now);
  const deleted = pendingUndoItems.pop();
  if (!deleted) {
    updateUndoNotice();
    return;
  }

  const restoreIndex = Math.min(deleted.index, items.length);
  items.splice(restoreIndex, 0, deleted.item);
  saveItems();
  displayItems();
  updateUndoNotice();
}

function updateUndoNotice() {
  const notice = document.getElementById("undoNotice");
  const message = document.getElementById("undoMessage");
  if (!notice || !message) return;

  if (undoExpiryTimer) clearTimeout(undoExpiryTimer);
  const now = Date.now();
  pendingUndoItems = pendingUndoItems.filter(entry => entry.expiresAt > now);

  if (pendingUndoItems.length === 0) {
    notice.hidden = true;
    return;
  }

  const latest = pendingUndoItems[pendingUndoItems.length - 1].item;
  message.textContent = pendingUndoItems.length > 1
    ? `「${latest.name}」など${pendingUndoItems.length}件を削除しました`
    : `「${latest.name}」を削除しました`;
  notice.hidden = false;

  const nextExpiry = Math.min(...pendingUndoItems.map(entry => entry.expiresAt));
  undoExpiryTimer = setTimeout(updateUndoNotice, Math.max(0, nextExpiry - now));
}

// カテゴリ追加
function addCategory() {
  const name = prompt("追加するカテゴリ名を入力してください");

  if (name === null) return;

  const category = name.trim();

  if (category === "") {
    alert("カテゴリ名を入力してください");
    return;
  }

  if (categories.includes(category)) {
    alert("同じ名前のカテゴリがあります");
    return;
  }

  categories.push(category);

  saveCategories();
  updateCategorySelect();
  displayItems();
}

// カテゴリ名変更
function renameCategory(oldName) {
  const newName = prompt(
    "新しいカテゴリ名を入力してください",
    oldName
  );

  if (newName === null) return;

  const trimmedName = newName.trim();

  if (trimmedName === "") {
    alert("カテゴリ名を入力してください");
    return;
  }

  if (
    trimmedName !== oldName &&
    categories.includes(trimmedName)
  ) {
    alert("同じ名前のカテゴリがあります");
    return;
  }

  const index = categories.indexOf(oldName);
  categories[index] = trimmedName;

  if (collapsedCategories.delete(oldName)) {
    collapsedCategories.add(trimmedName);
    saveCollapsedCategories();
  }

  items.forEach(item => {
    if (item.category === oldName) {
      item.category = trimmedName;
    }
  });

  saveCategories();
  saveItems();
  updateCategorySelect();
  displayItems();
}

// カテゴリ削除
function deleteCategory(category) {
  if (categories.length <= 1) {
    alert("最後のカテゴリは削除できません");
    return;
  }

  if (!confirm(
    "「" + category + "」を削除します。\n" +
    "このカテゴリの商品は別のカテゴリに移動します。"
  )) {
    return;
  }

  const destination = categories.find(name => name !== category);

  items.forEach(item => {
    if (item.category === category) {
      item.category = destination;
    }
  });

  categories = categories.filter(name => name !== category);
  collapsedCategories.delete(category);
  saveCollapsedCategories();

  saveCategories();
  saveItems();
  updateCategorySelect();
  displayItems();
}

// カテゴリ選択欄
function updateCategorySelect() {
  const select = document.getElementById("categoryInput");
  const previousValue = select.value;

  select.replaceChildren();

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if (categories.includes(previousValue)) {
    select.value = previousValue;
  }
}

// 商品保存
function saveItems() {
  localStorage.setItem("shoppingItems", JSON.stringify(items));
}

// カテゴリ保存
function saveCategories() {
  localStorage.setItem(
    "shoppingCategories",
    JSON.stringify(categories)
  );
}

// カテゴリ読み込み
function loadCategories() {
  try {
    const saved = localStorage.getItem("shoppingCategories");

    if (saved) {
      const loaded = JSON.parse(saved);

      if (
        Array.isArray(loaded) &&
        loaded.length > 0 &&
        loaded.every(
          category =>
            typeof category === "string" &&
            category.trim() !== ""
        ) &&
        new Set(loaded).size === loaded.length
      ) {
        categories = loaded;
      }
    }
  } catch (error) {
    console.error("カテゴリ読み込みエラー", error);
  }

  saveCategories();
}

// 商品読み込み
function loadItems() {
  try {
    const saved = localStorage.getItem("shoppingItems");

    if (saved) {
      const loaded = JSON.parse(saved);

      if (Array.isArray(loaded)) {
        items = loaded.map(item => ({
          id: item.id || createId(),
          name: String(item.name || ""),
          checked: Boolean(item.checked),
          category: categories.includes(item.category)
            ? item.category
            : categories[0]
        }));
      }
    }
  } catch (error) {
    console.error("商品読み込みエラー", error);
  }

  saveItems();
}

// 商品の並び替え
function moveItem(sourceId, targetCategory, targetId, after, edge) {
  const source = items.find(item => item.id === sourceId);
  if (!source || !categories.includes(targetCategory)) return;

  const sourceCategory = source.category;
  const sourceGroup = items.filter(item => item.category === sourceCategory);
  const sourceIndex = sourceGroup.findIndex(item => item.id === sourceId);
  const [movingItem] = sourceGroup.splice(sourceIndex, 1);

  const targetGroup = sourceCategory === targetCategory
    ? sourceGroup
    : items.filter(item => item.category === targetCategory);

  let insertIndex;
  if (targetId) {
    if (targetId === sourceId) return;
    const targetIndex = targetGroup.findIndex(item => item.id === targetId);
    if (targetIndex === -1) return;
    insertIndex = targetIndex + (after ? 1 : 0);
  } else {
    insertIndex = edge === "start" ? 0 : targetGroup.length;
  }

  movingItem.category = targetCategory;
  targetGroup.splice(insertIndex, 0, movingItem);

  // Keep each category's visible order while leaving category order untouched.
  items = categories.flatMap(category => {
    if (category === targetCategory) return targetGroup;
    if (category === sourceCategory) return sourceGroup;
    return items.filter(item => item.category === category);
  });

  saveItems();
}

// カテゴリの並び替え
function reorderCategories(sourceName, targetName, after) {
  if (sourceName === targetName) return;

  const sourceIndex = categories.indexOf(sourceName);
  const targetIndex = categories.indexOf(targetName);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [movingCategory] = categories.splice(sourceIndex, 1);

  let insertIndex = targetIndex + (after ? 1 : 0);

  if (sourceIndex < insertIndex) {
    insertIndex--;
  }

  categories.splice(insertIndex, 0, movingCategory);

  saveCategories();
  updateCategorySelect();
}

// ドラッグ中の見た目を解除
function clearDragStyles() {
  document.querySelectorAll(
    ".dragging, .drag-over-top, .drag-over-bottom"
  ).forEach(element => {
    element.classList.remove(
      "dragging",
      "drag-over-top",
      "drag-over-bottom"
    );
  });
}

// ドラッグ開始
function handlePointerDown(event) {
  const handle = event.target.closest(".drag-handle");

  if (!handle || event.button !== 0) return;

  event.preventDefault();

  const type = handle.dataset.dragType;
  const id = handle.dataset.dragId;

  activeDrag = {
    type,
    id,
    pointerId: event.pointerId,
    targetId: null,
    targetCategory: null,
    edge: "end",
    after: false,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };

  handle.setPointerCapture(event.pointerId);

  const source = type === "item"
    ? document.querySelector(
        `.item-row[data-item-id="${CSS.escape(id)}"]`
      )
    : document.querySelector(
        `.category-section[data-category="${CSS.escape(id)}"]`
      );

  if (source) source.classList.add("dragging");
}

// ドラッグ中
function handlePointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const distance = Math.hypot(
    event.clientX - activeDrag.startX,
    event.clientY - activeDrag.startY
  );

  if (distance > 6) {
    activeDrag.moved = true;
  }

  if (!activeDrag.moved) return;

  clearDropTarget();
  activeDrag.targetId = null;
  activeDrag.targetCategory = null;

  const element = document.elementFromPoint(
    event.clientX,
    event.clientY
  );

  if (!element) return;

  let target;

  if (activeDrag.type === "item") {
    const source = items.find(
      item => item.id === activeDrag.id
    );
    const targetRow = element.closest(".item-row");
    const targetHeader = element.closest(".category-header");
    const targetList = element.closest(".item-list");

    target = targetRow || targetHeader || targetList;
    if (!source || !target) return;

    const targetSection = target.closest(".category-section");
    const targetCategory = targetSection?.dataset.category;
    if (!targetCategory) return;

    activeDrag.targetCategory = targetCategory;
    activeDrag.targetId = null;

    if (targetRow) {
      const targetItem = items.find(
        item => item.id === targetRow.dataset.itemId
      );
      if (!targetItem || targetItem.id === source.id) return;
      activeDrag.targetId = targetItem.id;
    } else if (targetHeader) {
      const rect = targetHeader.getBoundingClientRect();
      activeDrag.edge = event.clientY <= rect.top + rect.height / 2
        ? "start"
        : "end";
    } else {
      activeDrag.edge = "end";
    }
  } else {
    target = element.closest(".category-section");

    if (!target) return;

    const targetName = target.dataset.category;

    if (
      !targetName ||
      targetName === activeDrag.id
    ) {
      return;
    }

    activeDrag.targetId = targetName;
  }

  const rect = target.getBoundingClientRect();

  if (activeDrag.type === "item" && !activeDrag.targetId) {
    activeDrag.after = activeDrag.edge === "end";
  } else {
    activeDrag.after =
      event.clientY > rect.top + rect.height / 2;
  }

  target.classList.add(
    activeDrag.after ? "drag-over-bottom" : "drag-over-top"
  );
}

// ドロップ位置の表示を解除
function clearDropTarget() {
  document.querySelectorAll(
    ".drag-over-top, .drag-over-bottom"
  ).forEach(element => {
    element.classList.remove(
      "drag-over-top",
      "drag-over-bottom"
    );
  });
}

// ドラッグ終了
function handlePointerUp(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const drag = activeDrag;
  activeDrag = null;

  clearDragStyles();

  if (!drag.moved) return;

  if (drag.type === "item" && !drag.targetCategory) return;
  if (drag.type === "category" && !drag.targetId) return;

  if (drag.type === "item") {
    moveItem(
      drag.id,
      drag.targetCategory,
      drag.targetId,
      drag.after,
      drag.edge
    );
  } else {
    reorderCategories(drag.id, drag.targetId, drag.after);
  }

  displayItems();
}

// ドラッグ中断
function handlePointerCancel(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  activeDrag = null;
  clearDragStyles();
}

const helpDetails = document.querySelector(".help-details");
document.addEventListener("click", event => {
  if (helpDetails?.open && !helpDetails.contains(event.target)) {
    helpDetails.open = false;
  }
});

const safariTutorial = document.getElementById("safariTutorial");
const SAFARI_TUTORIAL_DISMISSED_KEY = "kagomemoSafariTutorialDismissed";

function shouldShowSafariTutorial() {
  const userAgent = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(userAgent) &&
    !/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA)/i.test(userAgent);
  const isStandalone = navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  if (!isIOS || !isSafari || isStandalone) return false;

  try {
    return localStorage.getItem(SAFARI_TUTORIAL_DISMISSED_KEY) !== "true";
  } catch (error) {
    return false;
  }
}

if (safariTutorial) {
  const dismissSafariTutorial = () => safariTutorial.close();

  document.getElementById("safariTutorialClose")
    .addEventListener("click", dismissSafariTutorial);
  document.getElementById("safariTutorialDone")
    .addEventListener("click", dismissSafariTutorial);

  safariTutorial.addEventListener("click", event => {
    if (event.target === safariTutorial) dismissSafariTutorial();
  });

  safariTutorial.addEventListener("close", () => {
    try {
      localStorage.setItem(SAFARI_TUTORIAL_DISMISSED_KEY, "true");
    } catch (error) {
      // チュートリアル表示に支障が出ないよう、保存できない場合は無視する。
    }
  });

  if (shouldShowSafariTutorial() && typeof safariTutorial.showModal === "function") {
    requestAnimationFrame(() => safariTutorial.showModal());
  }
}

// 初期化
const itemListElement = document.getElementById("itemList");

itemListElement.addEventListener("pointerdown", handlePointerDown);
itemListElement.addEventListener("pointermove", handlePointerMove);
itemListElement.addEventListener("pointerup", handlePointerUp);
itemListElement.addEventListener("pointercancel", handlePointerCancel);

document.getElementById("itemForm")
  .addEventListener("submit", addItem);


const itemInput = document.getElementById("itemInput");

// Enterで商品登録
itemInput.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;

  // 日本語変換中は登録しない
  if (event.isComposing || event.keyCode === 229) return;

  event.preventDefault();
  addItem(event);
});

// 改行を含むテキストを貼り付けたら一括登録
itemInput.addEventListener("paste", event => {
  const text = event.clipboardData?.getData("text");

  if (!text || !/[\r\n]/.test(text)) return;

  const names = text
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(name => name !== "");

  if (names.length === 0) return;

  event.preventDefault();

  if (names.length > 1 &&
      !confirm(`商品を${names.length}件まとめて追加します。よろしいですか？`)) {
    const start = itemInput.selectionStart ?? itemInput.value.length;
    const end = itemInput.selectionEnd ?? start;
    itemInput.setRangeText(text, start, end, "end");
    return;
  }

  addItemsFromText(text);
});


document.getElementById("addCategoryButton")
  .addEventListener("click", addCategory);

document.getElementById("completedToggle")
  .addEventListener("click", toggleCompletedItems);

document.getElementById("undoButton")
  .addEventListener("click", undoDelete);

loadCategories();
loadItems();
loadCollapsedCategories();
updateCategorySelect();
displayItems();
