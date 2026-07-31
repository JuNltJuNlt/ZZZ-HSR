import { initMenu } from "../menu.js";
import { byId, create, image } from "../tools.js";

const DATA_URL = new URL("../../data/zzz/monsters.json", import.meta.url);
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

const categoryNames = {
    "1": "以太异形",
    "2": "暴徒",
    "3": "侵蚀体",
    "4": "叛军",
    "5": "其他"
};

const glowColors = {
    "S": "rgba(200, 40, 40, 0.45)",
    "A": "rgba(60, 140, 220, 0.45)",
    "B": "rgba(200, 160, 30, 0.45)",
    "C": "rgba(140, 140, 140, 0.45)"
};

const state = {
    query: "",
    camp: [],
    types: [],
};

let monsterData = {
    monsters: [],
};

async function loadMonsterData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
        throw new Error(`无法读取怪物数据：${DATA_URL}`);
    }
    monsterData = await response.json();
}

function optionButton(option, kind) {
    const isCamp = kind === "camp";
    const active = isCamp ? state.camp.includes(option.value) : state.types.includes(option.value);
    return create("button", {
        className: active ? "monster-filter-button active" : "monster-filter-button",
        text: option.label,
        attrs: {
            type: "button",
            "data-value": option.value,
            "data-kind": kind,
        },
    });
}

function renderFilters() {
    const categories = [
        { value: "1", label: "以太异形" },
        { value: "2", label: "暴徒" },
        { value: "3", label: "侵蚀体" },
        { value: "4", label: "叛军" },
        { value: "5", label: "其他" }
    ];
    const types = [
        { value: "S", label: "S" },
        { value: "A", label: "A" },
        { value: "B", label: "B" },
        { value: "C", label: "C" }
    ];

    byId("monsterCampFilters").replaceChildren(
        ...categories.map(function (category) {
            return optionButton(category, "camp");
        }),
    );
    byId("monsterTypeFilters").replaceChildren(
        ...types.map(function (type) {
            return optionButton(type, "type");
        }),
    );
}

function matchesQuery(monster) {
    if (!state.query) return true;
    const query = state.query.toLowerCase();
    return monster.name.toLowerCase().includes(query);
}

function matchesCamp(monster) {
    if (state.camp.length === 0) return true;
    return state.camp.includes(String(monster.category));
}

function matchesType(monster) {
    if (state.types.length === 0) return true;
    return state.types.includes(monster.type);
}

function filteredMonsters() {
    const typeOrder = { "S": 1, "A": 2, "B": 3, "C": 4 };
    return monsterData.monsters
        .filter(function (monster) {
            return matchesQuery(monster) && matchesCamp(monster) && matchesType(monster);
        })
        .sort(function (a, b) {
            if (a.category !== b.category) return a.category - b.category;
            return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
        });
}

function renderWeakness(monster) {
    const weakness = monster.weakness || [];
    const resistance = monster.resistance || [];
    const items = [];

    weakness.forEach(function (element) {
        items.push({ element, type: "weak" });
    });
    resistance.forEach(function (element) {
        items.push({ element, type: "resist" });
    });

    if (items.length === 0) return null;

    return create("div", {
        className: "monster-weakness",
        style: { justifyContent: "center", gap: "6px" },
        children: items.map(function (item) {
            const barColor = item.type === "weak" ? "#4CAF50" : "#C62828";
            return create("div", {
                style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px"
                },
                children: [
                    image(`${ELEMENT_ROOT}/${item.element}.webp`, "monster-element", item.element),
                    create("span", {
                        style: {
                            width: "20px",
                            height: "4px",
                            borderRadius: "2px",
                            backgroundColor: barColor,
                            display: "block"
                        }
                    })
                ]
            });
        })
    });
}

function renderMonsterCard(monster) {
    const imagePath = `${IMAGE_ROOT}/${monster.type}/${monster.name}.webp`;
    const glow = glowColors[monster.type] || "rgba(160, 160, 160, 0.2)";

    return create("article", {
        className: "monster-card hover-shadow",
        style: {
            boxShadow: `0 0 8px 2px ${glow}`,
            transition: "box-shadow 0.3s ease"
        },
        children: [
            create("div", {
                className: "monster-image-wrap",
                children: [image(imagePath, "monster-image", monster.name)],
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
                                className: "monster-rank",
                                text: monster.type,
                            }),
                        ],
                    }),
                    create("p", {
                        className: "monster-camp",
                        text: categoryNames[monster.category] || "",
                    }),
                    renderWeakness(monster),
                ].filter(Boolean),
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
        const button = event.target.closest(".monster-filter-button[data-kind='camp']");
        if (!button) return;
        const value = button.dataset.value;
        const idx = state.camp.indexOf(value);
        if (idx >= 0) {
            state.camp.splice(idx, 1);
        } else {
            state.camp.push(value);
        }
        render();
    });

    byId("monsterTypeFilters").addEventListener("click", function (event) {
        const button = event.target.closest(".monster-filter-button[data-kind='type']");
        if (!button) return;
        const value = button.dataset.value;
        const idx = state.types.indexOf(value);
        if (idx >= 0) {
            state.types.splice(idx, 1);
        } else {
            state.types.push(value);
        }
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
