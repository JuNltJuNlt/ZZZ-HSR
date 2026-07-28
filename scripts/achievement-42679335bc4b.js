import { initMenu } from "./menu.js";
import { byId, create, image } from "./tools.js";

const DATA_URL = "../../data/achievement/achievements.json";
const STAR_JADE_ICON = "../../images/item/1.webp";

const state = {
    query: "",
    series: "all",
    reward: "all",
};

let achievementData = {
    series: [],
    rewards: [],
    achievements: [],
};

async function loadAchievementData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
        throw new Error(`无法读取成就数据：${DATA_URL}`);
    }

    achievementData = await response.json();
    achievementData.achievements = achievementData.achievements.filter(function (achievement) {
        return !isPlaceholderAchievement(achievement);
    });
}

function isPlaceholderAchievement(achievement) {
    return achievement.name === "..." && achievement.description === "...";
}

function optionButton(group, option, extraClass = "") {
    const active = state[group] === option.value;

    return create("button", {
        className: `${active ? "achievement-filter-button active" : "achievement-filter-button"} ${extraClass}`.trim(),
        text: option.label,
        attrs: {
            type: "button",
            "data-group": group,
            "data-value": option.value,
        },
    });
}

function rewardButton(option) {
    const active = state.reward === option.value;

    return create("button", {
        className: active ? "achievement-filter-button achievement-reward-button active" : "achievement-filter-button achievement-reward-button",
        attrs: {
            type: "button",
            "data-group": "reward",
            "data-value": option.value,
        },
        children: [
            create("span", { text: String(option.reward), className: "achievement-reward-number" }),
            image(STAR_JADE_ICON, "achievement-star-jade", "星穹"),
        ],
    });
}

function renderFilters() {
    byId("seriesFilters").replaceChildren(
        optionButton("series", { value: "all", label: "全部" }),
        ...achievementData.series.map(function (series) {
            return optionButton("series", series);
        }),
    );

    byId("rewardFilters").replaceChildren(
        optionButton("reward", { value: "all", label: "全部" }),
        ...achievementData.rewards.map(function (reward) {
            return rewardButton(reward);
        }),
    );
}

function normalizeText(value) {
    return String(value ?? "").toLowerCase();
}

function matchesQuery(achievement) {
    if (!state.query) return true;

    const query = normalizeText(state.query);
    return (
        normalizeText(achievement.id).includes(query) ||
        normalizeText(achievement.name).includes(query) ||
        normalizeText(achievement.description).includes(query)
    );
}

function matchesSeries(achievement) {
    return state.series === "all" || achievement.series === state.series;
}

function matchesReward(achievement) {
    return state.reward === "all" || String(achievement.reward) === state.reward;
}

function filteredAchievements() {
    return achievementData.achievements.filter(function (achievement) {
        return matchesQuery(achievement) && matchesSeries(achievement) && matchesReward(achievement);
    });
}

function uniqueAchievementCount(achievements) {
    return new Set(
        achievements.map(function (achievement) {
            return achievement.exclusive_group || achievement.id;
        }),
    ).size;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function descriptionHtml(description) {
    return escapeHtml(description)
        .replace(/\\n/g, "\n")
        .replace(/&lt;unbreak&gt;/g, '<span class="achievement-highlight">')
        .replace(/&lt;\/unbreak&gt;/g, "</span>")
        .replace(/&lt;color=#[0-9a-fA-F]+&gt;/g, '<span class="achievement-muted">')
        .replace(/&lt;\/color&gt;/g, "</span>")
        .replace(/&lt;u&gt;/g, '<span class="achievement-underline">')
        .replace(/&lt;\/u&gt;/g, "</span>")
        .replace(/\n/g, "<br>");
}

function renderReward(achievement) {
    return create("div", {
        className: "achievement-reward",
        children: [
            create("span", { text: String(achievement.reward), className: "achievement-reward-number" }),
            image(STAR_JADE_ICON, "achievement-star-jade", "星穹"),
        ],
    });
}

function renderAchievementRow(achievement) {
    return create("article", {
        className: `achievement-row reward-${achievement.reward}`,
        attrs: { "data-id": achievement.id },
        children: [
            create("div", {
                className: "achievement-main",
                children: [
                    create("div", {
                        className: "achievement-title-line",
                        children: [
                            create("p", { className: "achievement-name", text: achievement.name }),
                            create("span", { className: "achievement-id", text: achievement.id }),
                        ],
                    }),
                    create("p", {
                        className: "achievement-desc",
                        html: descriptionHtml(achievement.description),
                    }),
                    create("div", {
                        className: "achievement-meta",
                        children: [
                            create("span", { className: "achievement-series", text: achievement.series_label }),
                        ],
                    }),
                ],
            }),
            renderReward(achievement),
        ],
    });
}

function renderAchievements() {
    const achievements = filteredAchievements();
    byId("achievementCount").textContent = `共 ${uniqueAchievementCount(achievements)} 个成就`;
    byId("achievementList").replaceChildren(
        ...achievements.map(function (achievement) {
            return renderAchievementRow(achievement);
        }),
    );
}

function render() {
    renderFilters();
    renderAchievements();
}

function bindEvents() {
    byId("achievementSearch").addEventListener("input", function (event) {
        state.query = event.currentTarget.value.trim();
        renderAchievements();
    });

    document.querySelector(".achievement-filter-panel").addEventListener("click", function (event) {
        const button = event.target.closest(".achievement-filter-button");
        if (!button) return;

        state[button.dataset.group] = button.dataset.value;
        render();
    });
}

async function init() {
    initMenu();
    bindEvents();
    await loadAchievementData();
    render();
}

init().catch(function (error) {
    console.error(error);
});
