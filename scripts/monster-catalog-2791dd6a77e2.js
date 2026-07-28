import { initMenu } from "./menu.js";
import { byId, create, image } from "./tools.js";

const DATA_URL = "../../data/monster/monsters.json";
const IMAGE_ROOT = "../../images/monster";
const ELEMENT_ROOT = "../../images/element";

const state = {
    query: "",
    camp: "all",
};

let monsterData = {
    categories: [],
    monsters: [],
};

async function loadMonsterData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
        throw new Error(`无法读取怪物数据：${DATA_URL}`);
    }

    monsterData = await response.json();
}

function optionButton(option) {
    const active = state.camp === option.value;

    return create("button", {
        className: active ? "monster-filter-button active" : "monster-filter-button",
        text: option.label,
        attrs: {
            type: "button",
            "data-value": option.value,
        },
    });
}

function renderFilters() {
    byId("monsterCampFilters").replaceChildren(
        ...monsterData.categories.map(function (category) {
            return optionButton(category);
        }),
    );
}

function matchesQuery(monster) {
    if (!state.query) return true;

    const query = state.query.toLowerCase();
    return (
        monster.name.toLowerCase().includes(query) ||
        monster.id.includes(query) ||
        monster.camp_label.toLowerCase().includes(query)
    );
}

function matchesCamp(monster) {
    return state.camp === "all" || monster.camp === state.camp;
}

function filteredMonsters() {
    return monsterData.monsters.filter(function (monster) {
        return matchesQuery(monster) && matchesCamp(monster);
    });
}

function renderWeakness(monster) {
    if (monster.weak.length === 0) {
        return create("p", {
            className: "monster-empty-weak",
            text: "无弱点",
        });
    }

    return create("div", {
        className: "monster-weakness",
        children: monster.weak.map(function (element) {
            return image(`${ELEMENT_ROOT}/${element}.png`, "monster-element", element);
        }),
    });
}

function renderMonsterCard(monster) {
    return create("article", {
        className: "monster-card hover-shadow",
        attrs: { "data-id": monster.id },
        children: [
            create("div", {
                className: "monster-image-wrap",
                children: [image(`${IMAGE_ROOT}/${monster.icon}`, "monster-image", monster.name)],
            }),
            create("div", {
                className: "monster-card-body",
                children: [
                    create("p", {
                        className: "monster-name",
                        text: monster.name,
                    }),
                    create("div", {
                        className: "monster-meta",
                        children: [
                            create("span", {
                                className: "monster-id",
                                text: monster.id,
                            }),
                            ...(monster.rank_label
                                ? [
                                      create("span", {
                                          className: "monster-rank",
                                          text: monster.rank_label,
                                      }),
                                  ]
                                : []),
                        ],
                    }),
                    create("p", {
                        className: "monster-camp",
                        text: monster.camp_label,
                    }),
                    renderWeakness(monster),
                ],
            }),
        ],
    });
}

function renderMonsters() {
    const monsters = filteredMonsters();
    byId("monsterCount").textContent = `共 ${monsters.length} 个怪物`;
    byId("monsterGrid").replaceChildren(
        ...monsters.map(function (monster) {
            return renderMonsterCard(monster);
        }),
    );
}

function render() {
    renderFilters();
    renderMonsters();
}

function bindEvents() {
    byId("monsterSearch").addEventListener("input", function (event) {
        state.query = event.currentTarget.value.trim();
        renderMonsters();
    });

    byId("monsterCampFilters").addEventListener("click", function (event) {
        const button = event.target.closest(".monster-filter-button");
        if (!button) return;

        state.camp = button.dataset.value;
        render();
    });
}

async function init() {
    initMenu();
    bindEvents();
    await loadMonsterData();
    render();
}

init().catch(function (error) {
    console.error(error);
});
