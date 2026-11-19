
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

// ドラッグ中の情報
let activeDrag = null;

// 商品追加
function addItem(event) {
  if (event) event.preventDefault();

  const input = document.getElementById("itemInput");
  const categoryInput = document.getElementById("categoryInput");

  const name = input.value.trim();
  const category = categoryInput.value;

  if (name === "") return;

  items.push({
    id: createId(),
    name,
    checked: false,
    category
  });

  input.value = "";

  saveItems();
  displayItems();
  input.focus();
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
    title.append(disclosure, titleText);
    title.addEventListener("click", () => toggleCategory(category));

    const categoryControls = document.createElement("div");
    categoryControls.className = "category-controls";

    categoryControls.append(
      createButton("編集", () => renameCategory(category)),
      createButton(
        "削除",
        () => deleteCategory(category),
        "delete-category"
      )
    );

    header.append(categoryHandle, title, categoryControls);

    // 商品一覧
    const itemList = document.createElement("div");
    itemList.className = "item-list";
    itemList.hidden = isCollapsed;

    const allCategoryItems = items.filter(
      item => item.category === category
    );
    const categoryItems = showCompleted
      ? allCategoryItems
      : allCategoryItems.filter(item => !item.checked);

    if (categoryItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-message";
      empty.textContent = allCategoryItems.length > 0
        ? "完了済みは非表示です"
        : "商品はありません";
      itemList.appendChild(empty);
    }

    categoryItems.forEach(item => {
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
        saveItems();
        displayItems();
      };

      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = item.name;

      if (item.checked) {
        name.classList.add("checked");
      }

      const controls = document.createElement("div");
      controls.className = "item-controls";

      controls.append(
        createButton(
          "削除",
          () => deleteItem(item.id),
          "delete-button"
        )
      );

      row.append(itemHandle, checkbox, name, controls);
      itemList.appendChild(row);
    });

    section.append(header, itemList);
    list.appendChild(section);
  });
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
  if (!confirm("この商品を削除しますか？")) return;

  items = items.filter(item => item.id !== id);

  saveItems();
  displayItems();
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

// 初期化
const itemListElement = document.getElementById("itemList");

itemListElement.addEventListener("pointerdown", handlePointerDown);
itemListElement.addEventListener("pointermove", handlePointerMove);
itemListElement.addEventListener("pointerup", handlePointerUp);
itemListElement.addEventListener("pointercancel", handlePointerCancel);

document.getElementById("itemForm")
  .addEventListener("submit", addItem);

document.getElementById("addCategoryButton")
  .addEventListener("click", addCategory);

document.getElementById("completedToggle")
  .addEventListener("click", toggleCompletedItems);

loadCategories();
loadItems();
loadCollapsedCategories();
updateCategorySelect();
displayItems();
