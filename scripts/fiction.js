import { initMenu } from "./menu.js";
import { byId, create, image, wrapIndex } from "./tools.js";

const asset = function (path) {
    return `../../images/${path}`;
};

const text = {
    recommended: ["上半", "下半", "星启模式"],
    waves: ["第一波", "第二波", "第三波", "第四波", "第五波", "第六波"],
    chartTitle: "虚构叙事#层血量演化",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
    hp: "总血量",
};

const state = {
    scheduleIndex: 0,
    floorIndex: 3,
    hideExtraStats: false,
};

let fictionIndex = null;
let fictionEntries = [];
let fictionSchedules = [];
let fictionIndexById = {};
let fictionMonsterCatalog = {};

function dataUrl(path) {
    return new URL(`../data/fiction/${path}`, import.meta.url);
}

async function loadJson(path) {
    const response = await fetch(dataUrl(path));

    if (!response.ok) {
        throw new Error(`加载虚构叙事数据失败：${path}`);
    }

    return response.json();
}

async function loadFictionData() {
    fictionIndex = await loadJson("index.json");
    const entries = await Promise.all(
        fictionIndex.entries.map(function (fileName) {
            return loadJson(fileName);
        }),
    );

    fictionEntries = entries;
    fictionSchedules = entries.map(function (entry) {
        return {
            story_id: entry.story_id,
            story_name: entry.story_name,
            time: entry.time,
        };
    });
    fictionIndexById = Object.fromEntries(
        fictionSchedules.map(function (schedule, index) {
            return [String(schedule.story_id), index];
        }),
    );
    fictionMonsterCatalog = await loadJson(fictionIndex.monster_catalog);
    state.scheduleIndex = fictionIndexById[String(fictionSchedules[0]?.story_id)] ?? 0;
}

function showStance(value) {
    return typeof value === "string" ? value : String(value * 10);
}

function hasStance(monster) {
    return Number(monster.stance) > 0;
}

function currentEntry() {
    return fictionEntries[state.scheduleIndex];
}

function currentSchedule() {
    return fictionSchedules[state.scheduleIndex];
}

function currentFloor() {
    return currentEntry().floors[state.floorIndex];
}

function setSchedule(index) {
    state.scheduleIndex = wrapIndex(index, fictionEntries.length);
    state.floorIndex = Math.min(Math.max(state.floorIndex, 0), currentEntry().floors.length - 1);
    render();
}

function setFloor(index) {
    state.floorIndex = wrapIndex(index, currentEntry().floors.length);
    renderFloor();
}

function renderScheduleSelect() {
    byId("scheduleSelect").replaceChildren(
        ...fictionSchedules.map(function (schedule, index) {
            return create("option", {
                text: `${schedule.story_name} | ${schedule.time}`,
                attrs: {
                    value: index,
                    selected: index === state.scheduleIndex,
                },
            });
        }),
    );
}

function renderScheduleHeader() {
    const schedule = currentSchedule();
    byId("scheduleName").textContent = schedule.story_name;
    byId("scheduleTime").textContent = schedule.time;
    byId("scheduleSelect").value = String(state.scheduleIndex);
}

function renderElementIcons(elements = [], className = "elem_") {
    return elements.map(function (elementName) {
        return image(asset(`element/${elementName}.png`), className, elementName);
    });
}

function renderRecommend(targetId, labelIndex, level, elements = []) {
    byId(targetId).replaceChildren(
        create("div", {
            children: [
                create("p", { text: `${text.recommended[labelIndex]} Lv${level}` }),
                ...renderElementIcons(elements, "elem_"),
                create("p", {
                    text: text.chartSubtitle,
                    style: {
                        fontSize: "0.75em",
                        color: "#0066FF",
                    },
                }),
            ],
        }),
    );
}

function renderSmallBuffs(targetId, items = []) {
    byId(targetId).replaceChildren(
        ...items.map(function (item) {
            const title = item.id ? `${item.name}<br>${item.id}` : item.name;

            return create("div", {
                className: "smallbuff",
                children: [
                    create("p", {
                        className: "smallbuff_name",
                        html: title,
                    }),
                    create("p", {
                        className: "smallbuff_desc",
                        html: item.description ?? "",
                    }),
                    ...(item.simple_description !== undefined
                        ? [
                              create("p", {
                                  className: "smallbuff_desc",
                                  html: item.simple_description,
                              }),
                          ]
                        : []),
                ],
            });
        }),
    );
}

function renderInfo() {
    const entry = currentEntry();
    const blessingCards = byId("blessingCards");

    blessingCards.style.display = "";
    renderSmallBuffs("blessingCards", entry.blessing ?? []);
    renderSmallBuffs("buffCards", entry.buffs ?? []);
}

function monsterValueLine(monster, info, key, color) {
    const value = monster[key];
    if (!value) return null;

    let html = `<b><color style="color:${color};">${String(value)}</color></b>`;

    if (key === "hp" && monster.hp_ratio_sum > 1) {
        html += `<b>×${monster.hp_ratio_sum}</b>`;
    }

    if (key === "speed" && info["6"]) {
        html += ` <color style='color:#666;'>[${(info["6"] * 100).toFixed(0)}%]</color>`;
    }

    return create("span", { className: "monname", html });
}

function renderMonster(monster, stageLevel) {
    const info = fictionMonsterCatalog[monster.id] ?? {};
    const name = info["4"] ?? `未知怪物 ${monster.id}`;
    const figurePath = info["1"] ?? `monster/Monster_${monster.id}.webp`;
    const icon = image(asset(figurePath), "monicon hasimg", name);
    const nameLayer = create("div", {
        className: "monnameload hasimgname",
        children: [create("p", { text: name })],
    });

    icon.addEventListener("load", function () {
        nameLayer.style.display = "none";
    });
    icon.addEventListener("error", function () {
        icon.style.opacity = "0";
        icon.classList.remove("hasimg");
        nameLayer.classList.remove("hasimgname");
        icon.parentElement?.classList.add("monicon");
    });

    const hp = monsterValueLine(monster, info, "hp", "#cc0000");
    const speed = monsterValueLine(monster, info, "speed", "#2545ba");
    const rightChildren = [];
    if (hp) rightChildren.push(hp);
    if (hp && speed) rightChildren.push(create("br"));
    if (speed) rightChildren.push(speed);

    return create("span", {
        className: "monster_card hover-shadow",
        attrs: {
            "data-id": monster.id,
            "data-lv": stageLevel,
        },
        children: [
            create("div", {
                className: "monleft",
                children: [
                    icon,
                    create("span", {
                        className: "monicon_num",
                        text: String(monster.number ?? ""),
                    }),
                    nameLayer,
                ],
            }),
            ...(hasStance(monster)
                ? [
                      create("div", {
                          className: "monbottom",
                          children: [
                              create("span", {
                                  className: "monelem",
                                  children: renderElementIcons(info["2"] ?? [], "elem").map(function (node) {
                                      return create("span", { children: [node] });
                                  }),
                              }),
                              create("span", {
                                  className: "monname",
                                  html: showStance(monster.stance),
                                  style: {
                                      marginLeft: "5px",
                                      position: "relative",
                                      bottom: "2px",
                                      fontWeight: "bold",
                                  },
                              }),
                          ],
                      }),
                  ]
                : []),
            create("div", {
                className: "monright",
                children: rightChildren,
            }),
        ],
    });
}

function renderWave(index, wave, stageLevel) {
    return create("div", {
        className: "wave_wrap",
        children: [
            create("p", {
                className: "wave_name",
                text: text.waves[index] ?? `第${index + 1}波`,
            }),
            create("div", {
                className: "wave_monsters",
                children: wave.map(function (monster) {
                    return renderMonster(monster, stageLevel);
                }),
            }),
        ],
    });
}

function stageHpCoefficientText(stage, floorNumber) {
    const coefficient = Number(stage.hp_coefficient);

    if (floorNumber !== 4 || !Number.isFinite(coefficient)) {
        return "";
    }

    return `<br>HP <color style="color:#cc0000">${(coefficient * 100).toFixed(0)}%</color>`;
}

function renderStage(stage, floorLevel, floorNumber) {
    return create("div", {
        className: "stage",
        children: [
            create("div", {
                className: "emote_block_",
                children: [
                    create("div", {
                        className: "emote_",
                        children: [image(asset(`emote/Yunli/${1 + Math.floor(Math.random() * 3)}.png`), "", "")],
                    }),
                ],
            }),
            create("p", {
                html: `<color style="color:#2545ba">${stage.stage_id ?? ""}</color>${stageHpCoefficientText(stage, floorNumber)}`,
                style: {
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: "0.9em",
                    marginTop: "-5px",
                    marginBottom: "15px",
                    lineHeight: "1.9",
                },
            }),
            create("div", {
                className: "stage_waves",
                children: stage.monsters.map(function (wave, index) {
                    return renderWave(index, wave, floorLevel);
                }),
            }),
        ],
    });
}

function renderLineup(targetId, stages = [], floorLevel, floorNumber) {
    byId(targetId).replaceChildren(
        ...stages.map(function (stage) {
            return renderStage(stage, floorLevel, floorNumber);
        }),
    );
}

function monsterTotalHp(monster) {
    if (!monster) return 0;
    return monster.hp * (monster.hp_ratio_sum ?? 1);
}

function stageChartHp(stage) {
    const waves = stage.monsters ?? [];
    const firstWave = waves[0] ?? [];
    const secondWave = waves[1] ?? [];
    const waveThree = waves[2] ?? [];
    const secondBoss = secondWave[secondWave.length - 1];
    const waveThreeBoss = waveThree[waveThree.length - 1];

    return Math.round(
        (monsterTotalHp(firstWave[0]) + monsterTotalHp(firstWave[1])) * 10 +
            monsterTotalHp(secondBoss) +
            monsterTotalHp(waveThreeBoss),
    );
}

function floorChartHp(floor) {
    return ["upper", "lower", "star"].reduce(function (sum, side) {
        return (
            sum +
            (floor[side] ?? []).reduce(function (sideSum, stage) {
                return sideSum + stageChartHp(stage);
            }, 0)
        );
    }, 0);
}

function chartEntries() {
    const chronological = [...fictionEntries].reverse();
    const startIndex = chronological.findIndex(function (entry) {
        return entry.story_name === fictionIndex.chart_start_name;
    });

    return chronological.slice(startIndex >= 0 ? startIndex : 0);
}

function chartForFloor(floorNumber) {
    const entries = chartEntries();

    return {
        names: entries.map(function (entry) {
            return entry.story_name;
        }),
        hp: entries.map(function (entry) {
            const floor = entry.floors.find(function (item) {
                return item.floor === floorNumber;
            });

            return floor ? floorChartHp(floor) : null;
        }),
        activeIndex: entries.findIndex(function (entry) {
            return entry.story_id === currentSchedule().story_id;
        }),
    };
}

function renderChart() {
    const floorNumber = currentFloor().floor;
    const chart = chartForFloor(floorNumber);
    if (!chart.names.length) return;

    const chartElement = byId("chart");
    const existingChart = window.echarts.getInstanceByDom(chartElement);
    if (existingChart) window.echarts.dispose(existingChart);

    const activeIndex = chart.activeIndex >= 0 ? chart.activeIndex : chart.names.length - 1;
    const chartInstance = window.echarts.init(chartElement);
    chartInstance.setOption(
        {
            title: {
                text: text.chartTitle.replace("#", floorNumber),
                subtext: text.chartSubtitle,
                left: "center",
                textStyle: { color: "#000" },
                subtextStyle: { color: "#2545ba" },
                top: "8%",
            },
            tooltip: { trigger: "axis" },
            grid: {
                left: "3%",
                right: "4%",
                top: "20%",
                containLabel: true,
            },
            toolbox: {
                feature: { saveAsImage: {} },
                right: "75%",
                top: "10%",
            },
            xAxis: {
                type: "category",
                boundaryGap: true,
                data: chart.names,
                axisLabel: {
                    color: "#000",
                    interval: 0,
                    padding: [5, 0],
                },
            },
            yAxis: { type: "value" },
            series: [
                {
                    name: text.hp,
                    type: "line",
                    data: chart.hp,
                    lineStyle: { color: "#cc0000" },
                    itemStyle: { color: "#cc0000" },
                },
            ],
        },
        true,
    );
    chartInstance.dispatchAction({
        type: "showTip",
        dataIndex: activeIndex,
        seriesIndex: 0,
    });
}

function rotateEmotes() {
    document.querySelectorAll(".emote_").forEach(function (node) {
        node.replaceChildren(image(asset(`emote/Yunli/${1 + Math.floor(Math.random() * 3)}.png`), "", ""));
    });
}

function toggleSection(sectionId, shouldShow) {
    byId(sectionId).style.display = shouldShow ? "" : "none";
}

function renderFloor() {
    const floor = currentFloor();
    byId("floorText").textContent = String(floor.floor);
    renderInfo();
    renderRecommend("upperRecommend", 0, floor.level, floor.element_upper);
    renderRecommend("lowerRecommend", 1, floor.level, floor.element_lower);
    renderLineup("upperLineup", floor.upper, floor.level, floor.floor);
    renderLineup("lowerLineup", floor.lower, floor.level, floor.floor);

    const hasStar = Boolean(floor.star?.length);
    toggleSection("starSection", hasStar);
    if (hasStar) {
        renderRecommend("starRecommend", 2, floor.level, floor.element_star);
        renderLineup("starLineup", floor.star, floor.level, floor.floor);
    }

    rotateEmotes();
    renderChart();
}

function render() {
    renderScheduleSelect();
    renderScheduleHeader();
    renderFloor();
}

function bindEvents() {
    byId("prevSchedule").addEventListener("click", function () {
        setSchedule(state.scheduleIndex + 1);
    });
    byId("nextSchedule").addEventListener("click", function () {
        setSchedule(state.scheduleIndex - 1);
    });
    byId("prevFloor").addEventListener("click", function () {
        setFloor(state.floorIndex - 1);
    });
    byId("nextFloor").addEventListener("click", function () {
        setFloor(state.floorIndex + 1);
    });
    byId("scheduleSelect").addEventListener("change", function (event) {
        setSchedule(Number(event.target.value));
    });

    document.body.addEventListener(
        "mouseenter",
        function (event) {
            const card = event.target.closest?.(".monster_card");
            if (!card) return;
            card.querySelector(".hasimgname")?.style.setProperty("display", "");
            card.querySelector(".monicon_num")?.style.setProperty("display", "none");
            card.querySelector(".hasimg")?.style.setProperty("opacity", "0.2");
        },
        true,
    );

    document.body.addEventListener(
        "mouseleave",
        function (event) {
            const card = event.target.closest?.(".monster_card");
            if (!card) return;
            card.querySelector(".hasimgname")?.style.setProperty("display", "none");
            card.querySelector(".monicon_num")?.style.setProperty("display", "");
            card.querySelector(".hasimg")?.style.setProperty("opacity", "1");
        },
        true,
    );

    document.querySelector(".title").addEventListener("click", function (event) {
        if (event.target.closest("a")) return;
        state.hideExtraStats = !state.hideExtraStats;
        document.querySelectorAll(".csx").forEach(function (node) {
            node.style.display = state.hideExtraStats ? "inline" : "none";
        });
        document.querySelectorAll(".under2").forEach(function (node) {
            node.style.display = state.hideExtraStats ? "none" : "";
        });
    });

    document.querySelector(".title").addEventListener("dblclick", function () {
        document.querySelectorAll(".under2").forEach(function (node) {
            node.style.display = "none";
        });
        [
            document.querySelector(".hpc"),
            document.querySelector(".chart_container"),
            document.querySelector("h3"),
            document.querySelector(".dl_button"),
        ]
            .filter(Boolean)
            .forEach(function (node) {
                node.style.display = node.style.display === "none" ? "" : "none";
            });
    });

    document.body.addEventListener("click", function (event) {
        if (event.target.closest(".emote_block_")) rotateEmotes();
    });

}

async function init() {
    await loadFictionData();
    initMenu();
    bindEvents();
    setSchedule(0);
}

init();
