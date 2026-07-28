import { initMenu } from "./menu.js";
import { byId, create, image, wrapIndex } from "./tools.js";

const DATA_ROOT = "../../data/chaos";

let chaosEntries = [];
let monsterCatalog = {};

const text = {
    dpcSingle: "总血量（单攻）：",
    dpcMulti: "总血量（群攻）：",
    cycle: "总轮数：",
    recommended: ["上半 ", "下半 ", "星启模式 "],
    waves: ["第一波", "第二波", "第三波", "第四波", "第五波", "第六波"],
    chartTitle: "混沌回忆#层血量演化",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
};

const state = {
    scheduleIndex: 0,
    floorIndex: 0,
};

function dataUrl(fileName) {
    return `${DATA_ROOT}/${fileName}`;
}

function fetchJson(fileName) {
    return fetch(dataUrl(fileName)).then(function (response) {
        if (!response.ok) {
            throw new Error(`无法读取混沌数据：${fileName}`);
        }
        return response.json();
    });
}

async function loadChaosData() {
    const index = await fetchJson("index.json");
    monsterCatalog = await fetchJson(index.monster_catalog);
    chaosEntries = await Promise.all(
        index.entries.map(function (fileName) {
            return fetchJson(fileName);
        }),
    );
}

function asset(path) {
    return `../../images/${path}`;
}

function showStance(value) {
    return typeof value === "string" ? value : String(value * 10);
}

function hasStance(monster) {
    return Number(monster.stance) > 0;
}

function htmlText(value) {
    return String(value).replaceAll("@", "<color style='color:#FFD780'>").replaceAll("#", "</color>");
}

function buffHtmlText(value) {
    const html = htmlText(value);

    return html.replace(/\d+(?:\.\d+)?%?/g, function (match, offset, source) {
        const previous = source[offset - 1] ?? "";
        if (/[\w#]/.test(previous)) return match;

        return `<color style='color:#f29e38;'>${match}</color>`;
    });
}

function currentEntry() {
    return chaosEntries[state.scheduleIndex];
}

function currentFloor() {
    return currentEntry().floors[state.floorIndex];
}

function setSchedule(index) {
    state.scheduleIndex = wrapIndex(index, chaosEntries.length);
    state.floorIndex = currentEntry().floors.length - 1;
    render();
}

function setFloor(index) {
    state.floorIndex = wrapIndex(index, currentEntry().floors.length);
    renderFloor();
}

function monsterTotalHp(monster) {
    return monster.hp * (monster.hp_ratio_sum ?? 1);
}

function battleStages(floor) {
    return floor.upper.concat(floor.lower, floor.star ?? []);
}

function floorHpSingle(floor) {
    let total = 0;

    battleStages(floor).forEach(function (stage) {
        stage.monsters.forEach(function (wave) {
            wave.forEach(function (monster) {
                total += monsterTotalHp(monster);
            });
        });
    });

    return Math.round(total);
}

function floorHpMultiple(floor) {
    let total = 0;

    battleStages(floor).forEach(function (stage) {
        stage.monsters.forEach(function (wave) {
            const waveHp = wave.map(function (monster) {
                return monsterTotalHp(monster);
            });
            total += Math.max(...waveHp);
        });
    });

    return Math.round(total);
}

function renderScheduleSelect() {
    const select = byId("scheduleSelect");
    const options = chaosEntries.map(function (entry, index) {
        return create("option", {
            text: `${entry.chaos_name} | ${entry.time}`,
            attrs: {
                value: index,
                selected: index === state.scheduleIndex,
            },
        });
    });
    select.replaceChildren(...options);
}

function renderScheduleHeader() {
    const entry = currentEntry();
    byId("scheduleName").textContent = entry.chaos_name;
    byId("scheduleTime").textContent = entry.time;
    byId("scheduleSelect").value = String(state.scheduleIndex);
}

function renderBuffAndTargets() {
    const entry = currentEntry();
    const floor = currentFloor();
    const buff = entry.buff;
    const target = document.querySelector(".target");

    byId("buffName").innerHTML = buff.id ? `${buff.name}<br>${buff.id}` : buff.name;
    byId("buffDesc").innerHTML = buffHtmlText(buff.description);

    byId("dpc").innerHTML =
        `${text.dpcSingle}<b><color style="color:#f29e38;">${floorHpSingle(floor)}</color></b>` +
        `<br>${text.dpcMulti}<b><color style="color:#f29e38;">${floorHpMultiple(floor)}</color></b>`;

    const targets = floor.targets ?? [];
    target.style.display = targets.length ? "" : "none";
    byId("targetCycle").textContent = `${text.cycle}${floor.turn_num ?? ""}`;
    byId("targetList").replaceChildren(
        ...targets.map(function (line) {
            return create("p", {
                style: { lineHeight: "28px" },
                children: [image(asset("others/Star.png"), "star", "星"), document.createTextNode(line)],
            });
        }),
    );
}

function renderElementIcons(elements, className) {
    return elements.map(function (elementName) {
        return image(asset(`element/${elementName}.png`), className, elementName);
    });
}

function renderRecommend(targetId, labelIndex, level, elements) {
    const children = [
        create("p", { text: `${text.recommended[labelIndex]}Lv${level}` }),
        ...renderElementIcons(elements, "elem_"),
    ];

    children.push(
        create("p", {
            text: text.chartSubtitle,
            style: {
                fontSize: "0.75em",
                color: "#0066FF",
            },
        }),
    );

    byId(targetId).replaceChildren(create("div", { children }));
}

function stageHpCoefficientText(stage) {
    const coefficient = Number(stage.hp_coefficient);

    if (!Number.isFinite(coefficient)) {
        return "";
    }

    return `<br>HP <color style="color:#cc0000">${(coefficient * 100).toFixed(0)}%</color>`;
}

function renderStage(stage, level) {
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
                html: `<color style="color:#2545ba">${stage.stage_id}</color>${stageHpCoefficientText(stage)}`,
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
                    return renderWave(index, wave, level);
                }),
            }),
        ],
    });
}

function monsterValueLine(monster, info, key, color) {
    const value = monster[key];
    let html = `<b><color style="color:${color};">${String(value)}</color></b>`;

    if (key === "hp" && info["3"] > 1) {
        html += `<b>×${info["3"]}</b>`;
    }

    if (key !== "hp") {
        if (info["6"]) {
            html += ` <color style='color:#666;'>[${(info["6"] * 100).toFixed(0)}%]</color>`;
        }

        const showKey = `${key}_show`;
        if (monster[showKey]) {
            html += ` <color style='color:#666;'>[${(monster[showKey] * 100).toFixed(0)}%]</color>`;
        }
    }

    return create("span", { className: "monname", html });
}

function renderMonster(monster, stageLevel) {
    const info = monsterCatalog[monster.id];
    const name = info["4"];
    const icon = image(asset(info["1"]), "monicon hasimg", name);
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
        icon.parentElement.classList.add("monicon");
    });

    const weaknessRow = create("div", {
        className: "monbottom",
        children: [
            create("div", {
                className: "monelem",
                children: renderElementIcons(info["2"], "elem").map(function (node) {
                    return create("span", { children: [node] });
                }),
            }),
            create("span", {
                className: "monname",
                html: `${hasStance(monster) ? showStance(monster.stance) : ""}${info["11"] ? `×${info["11"]}` : ""}`,
                style: {
                    marginLeft: "5px",
                    position: "relative",
                    bottom: "2px",
                    fontWeight: "bold",
                },
            }),
        ],
    });

    const rightChildren = [
        monsterValueLine(monster, info, "hp", "#cc0000"),
        create("br"),
        monsterValueLine(monster, info, "speed", "#2545ba"),
    ];

    return create("span", {
        className: "monster_card hover-shadow",
        attrs: {
            "data-id": monster.id,
            "data-lv": stageLevel,
        },
        children: [
            create("div", {
                className: "monleft",
                children: [icon, nameLayer],
            }),
            ...(hasStance(monster) ? [weaknessRow] : []),
            create("div", {
                className: "monright",
                style: { marginTop: hasStance(monster) ? "" : "0px" },
                children: rightChildren,
            }),
        ],
    });
}

function renderWave(index, wave, stageLevel) {
    const singleName = wave.length === 1 ? monsterCatalog[wave[0].id]["4"] : "";

    return create("div", {
        className: "wave_wrap",
        children: [
            create("p", {
                className: "wave_name",
                html: singleName ? `<color style='font-weight:bold'>${singleName}</color>` : text.waves[index],
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

function renderLineup(targetId, stages, level) {
    byId(targetId).replaceChildren(
        ...stages.map(function (stage) {
            return renderStage(stage, level);
        }),
    );
}

function toggleSection(sectionId, shouldShow) {
    byId(sectionId).style.display = shouldShow ? "" : "none";
}

const chartStartName = "长眠不醒";

function pointsForFloor(floorNumber) {
    const startIndex = chaosEntries.findIndex(function (entry) {
        return entry.chaos_name === chartStartName;
    });
    const first = startIndex >= 0 ? startIndex : chaosEntries.length - 1;
    const chronological = chaosEntries.slice(0, first + 1).reverse();

    return chronological
        .map(function (entry) {
            const floor = entry.floors.find(function (item) {
                return item.floor === floorNumber;
            });
            if (!floor) return null;

            return {
                id: String(entry.chaos_id),
                name: entry.chaos_name,
                single: floorHpSingle(floor),
                multi: floorHpMultiple(floor),
            };
        })
        .filter(Boolean);
}

function renderChart() {
    const floor = currentFloor();
    const points = pointsForFloor(floor.floor);
    if (!points.length) {
        byId("chart").replaceChildren();
        return;
    }

    const currentId = String(currentEntry().chaos_id);
    const activeIndex = Math.max(
        0,
        points.findIndex(function (point) {
            return point.id === currentId;
        }),
    );
    const chartElement = byId("chart");
    const existingChart = window.echarts.getInstanceByDom(chartElement);
    if (existingChart) window.echarts.dispose(existingChart);

    const chartInstance = window.echarts.init(chartElement);
    const option = {
        title: {
            text: text.chartTitle.replace("#", floor.floor),
            subtext: text.chartSubtitle,
            left: "center",
            textStyle: { color: "#000" },
            subtextStyle: { color: "#2545ba" },
            top: "8%",
        },
        tooltip: { trigger: "axis" },
        legend: {
            data: [text.dpcSingle, text.dpcMulti],
            top: "20%",
        },
        grid: {
            left: "3%",
            right: "4%",
            top: "26%",
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
            data: points.map(function (point) {
                return point.name;
            }),
            axisLabel: {
                color: "#000",
                interval: 0,
                padding: [5, 0],
            },
        },
        yAxis: { type: "value" },
        series: [
            {
                name: text.dpcSingle,
                type: "line",
                data: points.map(function (point) {
                    return point.single;
                }),
                lineStyle: { color: "#cc0000" },
                itemStyle: { color: "#cc0000" },
            },
            {
                name: text.dpcMulti,
                type: "line",
                data: points.map(function (point) {
                    return point.multi;
                }),
                lineStyle: { color: "#2545ba" },
                itemStyle: { color: "#2545ba" },
            },
        ],
    };
    chartInstance.setOption(option, true);
    chartInstance.dispatchAction({
        type: "showTip",
        dataIndex: activeIndex,
        seriesIndex: 1,
    });
}

function renderFloor() {
    const floor = currentFloor();
    byId("floorText").textContent = String(floor.floor);

    renderBuffAndTargets();
    renderRecommend("upperRecommend", 0, floor.level, floor.element_upper);
    renderRecommend("lowerRecommend", 1, floor.level, floor.element_lower);
    renderLineup("upperLineup", floor.upper, floor.level);
    renderLineup("lowerLineup", floor.lower, floor.level);

    const hasStar = Boolean(floor.star?.length);
    toggleSection("starSection", hasStar);
    if (hasStar) {
        renderRecommend("starRecommend", 2, floor.level, floor.element_star);
        renderLineup("starLineup", floor.star, floor.level);
    }

    renderChart();
}

function render() {
    renderScheduleSelect();
    renderScheduleHeader();
    renderFloor();
}

byId("scheduleSelect").addEventListener("change", function (event) {
    setSchedule(Number(event.target.value));
});

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

document.body.addEventListener(
    "mouseenter",
    function (event) {
        const card = event.target.closest(".monster_card");
        if (!card) return;
        card.querySelectorAll(".hasimgname").forEach(function (node) {
            node.style.display = "";
        });
        card.querySelectorAll(".hasimg").forEach(function (node) {
            node.style.opacity = "0.2";
        });
    },
    true,
);

document.body.addEventListener(
    "mouseleave",
    function (event) {
        const card = event.target.closest(".monster_card");
        if (!card) return;
        card.querySelectorAll(".hasimgname").forEach(function (node) {
            node.style.display = "none";
        });
        card.querySelectorAll(".hasimg").forEach(function (node) {
            node.style.opacity = "1";
        });
    },
    true,
);

async function init() {
    await loadChaosData();
    initMenu();
    setSchedule(0);
}

init();
