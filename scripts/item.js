import { initMenu } from "./menu.js";
import { byId, create, image } from "./tools.js";

const DATA_URL = "../../data/item/items.json";
const IMAGE_ROOT = "../../images/item";

const state = {
    query: "",
    purpose: "all",
    rarity: "all",
};

let itemData = {
    purposes: [],
    rarities: [],
    items: [],
};

async function loadItemData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
        throw new Error(`无法读取物品数据：${DATA_URL}`);
    }

    itemData = await response.json();
}

function optionButton(group, option) {
    const active = state[group] === option.value;

    return create("button", {
        className: active ? "filter-button active" : "filter-button",
        text: option.label,
        attrs: {
            type: "button",
            "data-group": group,
            "data-value": option.value,
        },
    });
}

function renderFilters() {
    byId("purposeFilters").replaceChildren(
        optionButton("purpose", { value: "all", label: "全部" }),
        ...itemData.purposes.map(function (purpose) {
            return optionButton("purpose", purpose);
        }),
    );

    byId("rarityFilters").replaceChildren(
        optionButton("rarity", { value: "all", label: "全部" }),
        ...itemData.rarities.map(function (rarity) {
            return optionButton("rarity", rarity);
        }),
    );
}

function stars(count) {
    return "★★★★★".slice(0, count);
}

function rarityClass(item) {
    return `rarity-${item.stars}`;
}

function matchesQuery(item) {
    if (!state.query) return true;
    const query = state.query.toLowerCase();
    return item.name.toLowerCase().includes(query) || item.id.includes(query);
}

function matchesPurpose(item) {
    return state.purpose === "all" || item.purpose === state.purpose;
}

function matchesRarity(item) {
    return state.rarity === "all" || item.rarity === state.rarity;
}

function filteredItems() {
    return itemData.items.filter(function (item) {
        return matchesQuery(item) && matchesPurpose(item) && matchesRarity(item);
    });
}

function renderItemCard(item) {
    return create("article", {
        className: `item-card hover-shadow ${rarityClass(item)}`,
        attrs: { "data-id": item.id },
        children: [
            create("div", {
                className: "item-image-wrap",
                children: [image(`${IMAGE_ROOT}/${item.icon}`, "item-image", item.name)],
            }),
            create("div", {
                className: "item-card-body",
                children: [
                    create("p", {
                        className: "item-name",
                        text: item.name,
                    }),
                    create("p", {
                        className: "item-purpose",
                        text: item.purpose_label,
                    }),
                    create("p", {
                        className: "item-stars",
                        text: stars(item.stars),
                    }),
                ],
            }),
        ],
    });
}

function renderItems() {
    const items = filteredItems();
    byId("itemCount").textContent = `共 ${items.length} 个物品`;
    byId("itemGrid").replaceChildren(
        ...items.map(function (item) {
            return renderItemCard(item);
        }),
    );
}

function render() {
    renderFilters();
    renderItems();
}

function bindEvents() {
    byId("itemSearch").addEventListener("input", function (event) {
        state.query = event.currentTarget.value.trim();
        renderItems();
    });

    document.querySelector(".item-filter-panel").addEventListener("click", function (event) {
        const button = event.target.closest(".filter-button");
        if (!button) return;

        state[button.dataset.group] = button.dataset.value;
        render();
    });
}

async function init() {
    initMenu();
    bindEvents();
    await loadItemData();
    render();
}

init().catch(function (error) {
    console.error(error);
});
