import { initMenu } from "./menu.js";
import { byId, create as element, image } from "./tools.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
let homeData;
let iconPaths;
const homeState = {
    activeGame: "zzz",
};
let zzzCountdownInterval = null;

function renderList(container, items, createItem) {
    const fragment = document.createDocumentFragment();
    items.map(createItem).forEach((node) => fragment.append(node));
    container.replaceChildren(fragment);
}

async function loadJson(path) {
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) {
        throw new Error(`读取数据失败：${path}`);
    }
    return response.json();
}

function pickById(items, ids) {
    const itemMap = new Map(items.map((item) => [Number(item.id), item]));
    return ids.map((id) => itemMap.get(Number(id))).filter(Boolean);
}

function isNoNavigation(item) {
    return item.disabled || !item.href || item.href === "#";
}

function noNavigationAttrs(item) {
    return isNoNavigation(item) ? { "data-no-nav": "true" } : {};
}

function getDisplayMainVersion(version) {
    return String(version).replace(/v\d+$/i, "");
}

function parseDateTime(value) {
    if (value instanceof Date) return value;

    const text = String(value);
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const [datePart, timePart = "00:00:00"] = text.split(/\s+/);
    const [year, month, day] = datePart.split(/[/-]/).map(Number);
    const [hours = 0, minutes = 0, seconds = 0] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds);
}

function formatYmd(date, withTime = false) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (!withTime) {
        return `${year}/${month}/${day}`;
    }

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function formatHyphenDate(date) {
    return date.toISOString().substring(0, 10);
}

function parseTestVersion(version) {
    const match = String(version).match(/^(\d+)\.(\d+)v(\d+)$/i);
    if (!match) {
        throw new Error(`测试服版本格式错误：${version}`);
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    };
}

function addMs(date, ms) {
    return new Date(date.getTime() + ms);
}

function addDays(date, days) {
    return addMs(date, days * DAY_MS);
}

function getVersionMain(version) {
    const { major, minor } = parseTestVersion(version);
    return `${major}.${minor}`;
}

function getMainVersionRank(version) {
    const match = String(version).match(/^(\d+)\.(\d+)$/);
    if (!match) {
        throw new Error(`主版本格式错误：${version}`);
    }
    return Number(match[1]) * 100 + Number(match[2]);
}

function getTestServerShiftDays(version) {
    const shiftFrom = homeData.testServer.shiftFrom;
    if (!shiftFrom || getMainVersionRank(version) < getMainVersionRank(shiftFrom)) {
        return 0;
    }
    return homeData.testServer.shiftDays ?? 0;
}

function makeTestVersion(mainVersion, patchIndex) {
    return `${mainVersion}v${patchIndex + 1}`;
}

function calculateAnchorBetaDate() {
    const offsets = homeData.testServer.patchOffsets;
    const anchorDates = homeData.testServer.anchors.map((anchor) => {
        const { patch } = parseTestVersion(anchor.version);
        const offsetDays = offsets[patch - 1] ?? 0;
        return addDays(parseDateTime(anchor.date), -offsetDays).getTime();
    });

    const average = Math.round(anchorDates.reduce((sum, value) => sum + value, 0) / anchorDates.length);
    return new Date(average);
}

function buildTestServerEvents() {
    const anchorMainVersion = getVersionMain(homeData.testServer.anchors[0].version);
    const versions = homeData.testServer.versions;
    const startIndex = Math.max(0, versions.findIndex((item) => item.version === anchorMainVersion));
    const offsets = homeData.testServer.patchOffsets;
    let betaDate = calculateAnchorBetaDate();
    const events = [];

    for (const versionData of versions.slice(startIndex)) {
        const versionBetaDate = addDays(betaDate, getTestServerShiftDays(versionData.version));
        offsets.forEach((offsetDays, patchIndex) => {
            events.push({
                version: makeTestVersion(versionData.version, patchIndex),
                date: addDays(versionBetaDate, offsetDays),
            });
        });
        betaDate = addDays(betaDate, versionData.days);
    }

    return events;
}

function buildVersionSchedule() {
    const anchorMainVersion = getVersionMain(homeData.testServer.anchors[0].version);
    const versions = homeData.testServer.versions;
    const startIndex = Math.max(0, versions.findIndex((item) => item.version === anchorMainVersion));
    let betaDate = calculateAnchorBetaDate();
    const schedule = [];

    for (const versionData of versions.slice(startIndex)) {
        schedule.push({
            ...versionData,
            betaDate: addDays(betaDate, getTestServerShiftDays(versionData.version)),
        });
        betaDate = addDays(betaDate, versionData.days);
    }

    return schedule;
}

function getTestServerTimeline(now = new Date()) {
    const events = buildTestServerEvents();
    const configuredCurrent = homeData.siteVersion ?? homeData.featured.version;
    const configuredIndex = events.findIndex((entry) => entry.version === configuredCurrent);
    const nextByTimeIndex = events.findIndex((entry) => entry.date > now);
    const currentIndex = configuredIndex >= 0 ? configuredIndex : Math.max(0, nextByTimeIndex - 1);
    const nextIndex = events[currentIndex + 1] ? currentIndex + 1 : Math.max(0, nextByTimeIndex);
    const current = events[currentIndex] ?? events[0];
    const next = events[nextIndex] ?? current;
    const visibleCount = homeData.testServer.visibleCount ?? 10;
    const startIndex = Math.max(0, currentIndex);

    return {
        current,
        next,
        remainingMs: Math.max(0, next.date - now),
        entries: events.slice(startIndex, startIndex + visibleCount).map((entry, index) => ({
            ...entry,
            isCurrent: index === 0,
            isNext: index === nextIndex - startIndex,
        })),
    };
}

function formatFutureRemaining(ms) {
    const diff = Math.max(0, ms);
    const days = Math.floor(diff / DAY_MS);
    const hours = Math.floor((diff - days * DAY_MS) / HOUR_MS);

    if (!days) {
        return `${hours}小时 `;
    }
    return `${days}天 `;
}

function futureVersionText(version, label) {
    return `<color style='color:rgb(255, 172, 255)'><b>${version}</b></color> ${label}`;
}

function getCharacterAgeHtml(name, birthdayStamp, color = "#DD0000") {
    let age = Math.floor((Date.now() - birthdayStamp) / DAY_MS);
    if (age % 100 === 0) {
        age = `<color style='color:${color}'>${age}</color>`;
    }
    return `${name} : <b>${age}</b> 天`;
}

function getYunliAgeHtml(color = "#DD0000") {
    return getCharacterAgeHtml("云璃", 1722394800000, color);
}

function getFutureDateEntries(panelData, now = new Date()) {
    const entries = [];
    const [testOffset, dripOffset, previewOffset] = panelData.offset_hours;
    let versionStartStamp = panelData.start_stamp;
    const displayShiftMs = (panelData.display_shift_days ?? 0) * DAY_MS;

    for (const versionData of panelData.versions) {
        if (versionData.version !== "4.0") {
            const shiftFrom = panelData.test_shift_from;
            const shouldShift = !shiftFrom || getMainVersionRank(versionData.version) >= getMainVersionRank(shiftFrom);
            const testShiftMs = shouldShift ? (panelData.test_shift_days ?? 0) * DAY_MS : 0;
            entries.push({
                date: new Date(versionStartStamp + testOffset * HOUR_MS + testShiftMs),
                version: versionData.version,
                kind: "test",
                html: futureVersionText(versionData.version, "测试服"),
            });
        }

        entries.push({
            date: new Date(versionStartStamp + dripOffset * HOUR_MS),
            version: versionData.version,
            kind: "drip",
            html: futureVersionText(versionData.version, "角色立绘"),
        });

        versionStartStamp += versionData.days * DAY_MS;

        entries.push({
            date: new Date(versionStartStamp),
            version: versionData.version,
            kind: "open",
            html: futureVersionText(versionData.version, "开启"),
        });
        entries.push({
            date: new Date(versionStartStamp + previewOffset * HOUR_MS),
            version: versionData.version,
            kind: "preview",
            html: futureVersionText(versionData.version, "前瞻特别节目"),
        });
    }

    let result = entries
        .map((entry) => ({
            ...entry,
            date: new Date(entry.date.getTime() + displayShiftMs),
        }))
        .map((entry) => ({
            ...entry,
            stamp: entry.date.getTime(),
        }))
        .sort((a, b) => a.stamp - b.stamp);

    if (panelData.start_from) {
        const startIndex = result.findIndex(function (entry) {
            return entry.version === panelData.start_from.version && entry.kind === panelData.start_from.kind;
        });
        if (startIndex >= 0) {
            result = result.slice(startIndex);
        }
    }

    return result.filter(function (entry) {
        if (entry.stamp < now.getTime()) return false;
        if (panelData.display_year && !formatHyphenDate(entry.date).startsWith(`${panelData.display_year}-`)) return false;
        return true;
    });
}

function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");

    if (days > 0) {
        return `${String(days).padStart(2, "0")}:${time}`;
    }
    return time;
}

function renderZZZCountdown() {
    const container = byId("testCountdown");
    if (!container) return;
    const target = new Date('2026-07-29T06:00:00');
    const now = new Date();
    const diff = Math.max(0, target - now);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    const time = [hours, minutes, seconds].map(v => String(v).padStart(2, "0")).join(":");

    container.innerHTML = `<p class="countdown c2 c2_b">3.1 ${time}</p>`;
}

function bindNoNavigation() {
    document.body.addEventListener("click", function (event) {
        const target = event.target.closest("[data-no-nav='true']");
        if (target) {
            event.preventDefault();
        }
    });
}

function setHomeGameView(key) {
    homeState.activeGame = key;
    renderGameTabs();
    renderActions();
    renderDirectory();

    const isFuture = key === "future";
    const isZZZ = key === "zzz";

    byId("actions").hidden = isFuture;
    byId("newStrip").hidden = isFuture || isZZZ;
    byId("directoryGrid").hidden = isFuture;
    byId("testCountdown").hidden = isFuture;
    byId("futurePanel").hidden = !isFuture;

    const version = homeData.siteVersionByGame?.[key] ?? homeData.siteVersion;
    const versionEl = byId("siteVersionText");
    if (versionEl) versionEl.textContent = version;

    const gameImg = byId("gameImg");
    if (gameImg) {
        if (isZZZ) {
            gameImg.src = './images/ZZZ%20images/emote/3.png';
        } else {
            gameImg.src = './images/emote/Yunli/1.png';
        }
    }

    if (isZZZ) {
        if (zzzCountdownInterval) clearInterval(zzzCountdownInterval);
        renderZZZCountdown();
        zzzCountdownInterval = setInterval(renderZZZCountdown, 1000);
    } else if (!isFuture) {
        if (zzzCountdownInterval) clearInterval(zzzCountdownInterval);
        renderTestCountdown();
    }

    if (isFuture) {
        renderFuturePanel();
    }
}

function bindGameTabs() {
    byId("gameTabs").addEventListener("click", function (event) {
        const target = event.target.closest("[data-game-key]");
        if (!target) return;

        const tab = homeData.gameTabs.find((item) => item.key === target.dataset.gameKey);
        event.preventDefault();

        if (!tab || tab.disabled) return;
        setHomeGameView(tab.key);
    });
}

function renderGameTabs() {
    renderList(byId("gameTabs"), homeData.gameTabs, (tab) => {
        const classes = ["game-tab"];
        if (tab.key === homeState.activeGame) classes.push("active");
        if (tab.variant) classes.push(tab.variant);

        return element("a", {
            href: tab.href ?? "#",
            text: tab.label,
            className: classes.join(" "),
            attrs: {
                ...noNavigationAttrs(tab),
                "data-game-key": tab.key,
            },
        });
    });
}

function renderActions() {
    const activeTab = homeData.gameTabs.find((tab) => tab.key === homeState.activeGame);
    const gameKey = activeTab?.key === "future" ? "sr" : (activeTab?.key ?? "sr");
    const actions = homeData.actionsByGame?.[gameKey] ?? homeData.actions ?? [];
    renderList(byId("actions"), actions, (action) =>
        element("a", {
            href: action.href ?? "#",
            text: action.label,
            className: "hover-shadow",
            attrs: noNavigationAttrs(action),
        })
    );
}

function renderAttrIcons(item) {
    const icons = [];
    if (item.element) {
        icons.push(image(iconPaths.elements[item.element], "featured-icon", item.element));
    }
    if (item.path) {
        icons.push(image(iconPaths.paths[item.path], "featured-icon", item.path));
    }
    return icons;
}

function renderFeaturedCard(item, options) {
    return element("a", {
        href: "./sr_html/char/",
        className: `featured-card hover-shadow ${options.cardClass}`,
        children: [
            element("span", {
                className: "featured-version",
                text: options.version,
            }),
            element("span", {
                className: "featured-image-wrap",
                children: [image(options.imagePath, "featured-image", item.name)],
            }),
            element("span", {
                className: "featured-name",
                text: item.name,
            }),
            element("span", {
                className: "featured-icons",
                children: renderAttrIcons(item),
            }),
        ],
    });
}

function renderFeatured(characters, lightcones) {
    const container = byId("newStrip");
    const cardVersion = getDisplayMainVersion(homeData.featured.version);
    const characterCards = characters.map((item) =>
        renderFeaturedCard(item, {
            cardClass: "featured-character-card",
            version: cardVersion,
            imagePath: `./images/character/character_icon_shop/${item.icon}`,
        }),
    );
    const lightconeCards = lightcones.map((item) =>
        renderFeaturedCard(item, {
            cardClass: "featured-lightcone-card",
            version: cardVersion,
            imagePath: `./images/lightcone/lightcone_icon_default/${item.icon}`,
        }),
    );

    container.replaceChildren(...characterCards, ...lightconeCards);
}

function renderFuturePanel() {
    const panel = byId("futurePanel");
    const now = new Date();

    panel.replaceChildren(
        ...homeData.futureDate.panels.map((panelData) => renderFutureDatePanel(panelData, now)),
    );
}

function renderFutureDatePanel(panelData, now) {
    const rows = getFutureDateEntries(panelData, now).map((entry) =>
        element("tr", {
            children: [
                element("td", {
                    text: formatHyphenDate(entry.date),
                    style: { textAlign: "right" },
                }),
                element("td", {
                    className: "fntd_time",
                    text: formatFutureRemaining(entry.stamp - now.getTime()),
                    attrs: { "data-id": entry.stamp },
                    style: { textAlign: "center" },
                }),
                element("td", {
                    html: entry.html,
                }),
            ],
        }),
    );

    return element("div", {
        className: `futd_${panelData.key} futds`,
        children: [
            element("p", {
                className: "dir_head",
                text: panelData.title,
                style: { margin: "15px 5px 0" },
            }),
            element("p", {
                className: `${panelData.key === "sr" ? "c2_" : "c1_"} dir_subhead`,
            }),
            element("div", {
                className: "age",
                children: [
                    element("div", {
                        className: `age_sub_1 table_${panelData.key}_1`,
                        children: [image(panelData.emote, "", panelData.birthday_name)],
                    }),
                    element("div", {
                        className: `age_sub_2 table_${panelData.key}_2`,
                        children: [
                            element("p", {
                                html: getCharacterAgeHtml(panelData.birthday_name, panelData.birthday_stamp, "#FF9999"),
                            }),
                        ],
                    }),
                ],
            }),
            element("table", {
                className: `ctable table_${panelData.key}`,
                children: [
                    element("tbody", {
                        children: rows,
                    }),
                ],
            }),
        ],
    });
}

function renderTestCountdown() {
    const container = byId("testCountdown");
    const timeline = getTestServerTimeline();

    container.replaceChildren(
        element("div", {
            className: "countdown_small c2 c_f",
            children: [
                element("div", {
                    className: "cntd_emote",
                    children: [image("./images/emote/Yunli/1.png", "", "云璃")],
                }),
                element("div", {
                    className: "c_a_w",
                    children: [
                        element("p", {
                            className: "c2_a",
                            html: getYunliAgeHtml(),
                        }),
                    ],
                }),
            ],
        }),
        element("p", {
            className: "countdown c2 c2_b",
            text: `${timeline.next.version} ${formatRemaining(timeline.remainingMs)}`,
        }),
    );

    if (!byId("futurePanel").hidden) {
        renderFuturePanel();
    }
}

function renderDirectory() {
    const activeTab = homeData.gameTabs.find((tab) => tab.key === homeState.activeGame);
    const gameKey = activeTab?.key === "future" ? "sr" : (activeTab?.key ?? "sr");
    const directory = homeData.directoryByGame?.[gameKey] ?? homeData.directory ?? [];
    renderList(byId("directoryGrid"), directory, (item) =>
        element("a", {
            href: item.href ?? "#",
            text: item.label ?? item,
            className: "dir-card hover-shadow",
            attrs: noNavigationAttrs(item),
        })
    );
}

async function initHome() {
    const homeConfig = await loadJson("../data/home/home.json");
    homeData = homeConfig.homeData;
    iconPaths = homeConfig.iconPaths;
    homeState.activeGame = homeData.gameTabs.find((tab) => tab.active)?.key ?? "zzz";

    initMenu(homeData);
    bindNoNavigation();
    bindGameTabs();
    renderGameTabs();
    renderActions();
    renderFuturePanel();

    const initialVersion = homeData.siteVersionByGame?.[homeState.activeGame] ?? homeData.siteVersion;
    const versionEl = byId("siteVersionText");
    if (versionEl) versionEl.textContent = initialVersion;

    const gameImg = byId("gameImg");
    if (gameImg && homeState.activeGame === "zzz") {
        gameImg.src = './images/ZZZ%20images/emote/3.png';
    }

    if (homeState.activeGame === "zzz") {
        renderZZZCountdown();
        zzzCountdownInterval = setInterval(renderZZZCountdown, 1000);
    } else {
        renderTestCountdown();
        window.setInterval(renderTestCountdown, 1000);
    }

    const [characters, lightcones] = await Promise.all([
        loadJson("../data/character/character.json"),
        loadJson("../data/lightcone/lightcone.json"),
    ]);
    renderFeatured(
        pickById(characters, homeData.featured.characters),
        pickById(lightcones, homeData.featured.lightcones),
    );

    renderDirectory();

    if (homeState.activeGame === "zzz") {
        byId("newStrip").hidden = true;
    }
}

initHome();
