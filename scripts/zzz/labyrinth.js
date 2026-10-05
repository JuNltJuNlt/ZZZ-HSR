import { initMenu } from "../menu.js";
import { byId, create, image } from "../tools.js";

const DATA_URL = "../../data/zzz/labyrinth/items.json";
const IMAGE_ROOT = "../../images/ZZZ%20images/labyrinth";

const state = {
    query: "",
    type: "all",
    rarity: "all",
};

let itemData = {
    types: [],
    rarities: [],
    items: [],
};

const TYPES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const RARITIES = ["Z", "S", "A", "B", "C"];

async function loadItemData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
        throw new Error(`无法读取贝果计划数据：${DATA_URL}`);
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
    byId("typeFilters").replaceChildren(
        optionButton("type", { value: "all", label: "全部" }),
        ...TYPES.map(function (t) {
            return optionButton("type", { value: t, label: t });
        }),
    );

    byId("rarityFilters").replaceChildren(
        optionButton("rarity", { value: "all", label: "全部" }),
        ...RARITIES.map(function (r) {
            return optionButton("rarity", { value: r, label: r });
        }),
    );
}

function matchesQuery(item) {
    if (!state.query) return true;
    const query = state.query.toLowerCase();
    return item.name.toLowerCase().includes(query) || String(item.id).includes(query);
}

function matchesType(item) {
    return state.type === "all" || String(item.type) === state.type;
}

function matchesRarity(item) {
    return state.rarity === "all" || item.rarity === state.rarity;
}

function filteredItems() {
    return itemData.items.filter(function (item) {
        return matchesQuery(item) && matchesType(item) && matchesRarity(item);
    });
}

function renderItemCard(item) {
    return create("article", {
        className: `item-card hover-shadow rarity-${item.rarity}`,
        attrs: { "data-id": item.id },
        children: [
            create("div", {
                className: "item-image-wrap",
                children: [image(`${IMAGE_ROOT}/${item.type}/${item.icon}`, "item-image", item.name)],
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
                        text: `类型 ${item.type}`,
                    }),
                    create("p", {
                        className: "item-stars",
                        text: item.rarity,
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