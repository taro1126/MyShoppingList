
let items = [];

function addItem() {
  const input = document.getElementById("itemInput");
  const name = input.value.trim();

  if (name === "") return;

  items.push({
    name: name,
    checked: false
  });

  input.value = "";
  saveItems();
  displayItems();
}

function displayItems() {
  const list = document.getElementById("itemList");
  list.innerHTML = "";

  items.forEach((item, index) => {
    const li = document.createElement("li");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.checked;

    checkbox.onchange = () => {
      items[index].checked = checkbox.checked;
      saveItems();
      displayItems();
    };

    const span = document.createElement("span");
    span.textContent = item.name;

    if (item.checked) {
      span.classList.add("checked");
    }

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";

    deleteButton.onclick = () => {
      items.splice(index, 1);
      saveItems();
      displayItems();
    };

    li.append(checkbox, span, deleteButton);
    list.appendChild(li);
  });
}

function saveItems() {
  localStorage.setItem(
    "shoppingItems",
    JSON.stringify(items)
  );
}

function loadItems() {
  const saved = localStorage.getItem("shoppingItems");

  if (saved) {
    items = JSON.parse(saved);
  }

  displayItems();
}

loadItems();
