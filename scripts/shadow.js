import { initMenu } from "./menu.js";
import { byId, create, image, wrapIndex } from "./tools.js";

const DATA_ROOT = "../data/shadow";

const text = {
    totalHp: "总血量：",
    recommended: ["上半 ", "下半 ", "星启模式 "],
    waves: ["第一波", "第二波", "第三波", "第四波", "第五波", "第六波"],
    chartTitle: "末日幻影#层血量演化",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
    buff: "- 终焉公理 -",
    bossFeatures: "- 首领特性 -",
    res: "首领抗性",
};

const allElements = ["Phys", "Fire", "Ice", "Elec", "Wind", "Quantum", "Imaginary"];

const state = {
    scheduleIndex: 0,
    floorIndex: 0,
};

let shadowIndex = null;
let shadowEntries = [];
let shadowSchedules = [];
let monsterCatalog = {};

function dataUrl(path) {
    return new URL(`${DATA_ROOT}/${path}`, import.meta.url);
}

async function loadJson(path) {
    const response = await fetch(dataUrl(path));

    if (!response.ok) {
        throw new Error(`加载末日幻影数据失败：${path}`);
    }

    return response.json();
}

async function loadShadowData() {
    shadowIndex = await loadJson("index.json");
    shadowEntries = await Promise.all(
        shadowIndex.entries.map(function (fileName) {
            return loadJson(fileName);
        }),
    );
    shadowSchedules = shadowEntries.map(function (entry) {
        return {
            shadow_id: entry.shadow_id,
            shadow_name: entry.shadow_name,
            time: entry.time,
        };
    });
    monsterCatalog = await loadJson(shadowIndex.monster_catalog);
}

function asset(path) {
    return `../../images/${path}`;
}

function htmlText(value = "") {
    return String(value).replaceAll("@", "<color style='color:#FFD780'>").replaceAll("#", "</color>");
}

function buffHtmlText(value = "") {
    const html = htmlText(value);

    return html.replace(/\d+(?:\.\d+)?%?/g, function (match, offset, source) {
        const previous = source[offset - 1] ?? "";
        if (/[\w#]/.test(previous)) return match;

        return `<color style='color:#f29e38;'>${match}</color>`;
    });
}

function showStance(value) {
    return typeof value === "string" ? value : String(value * 10);
}

function hasStance(monster) {
    return Number(monster.stance) > 0;
}

function currentEntry() {
    return shadowEntries[state.scheduleIndex];
}

function currentSchedule() {
    return shadowSchedules[state.scheduleIndex];
}

function currentFloor() {
    return currentEntry().floors[state.floorIndex];
}

function setSchedule(index) {
    state.scheduleIndex = wrapIndex(index, shadowEntries.length);
    state.floorIndex = Math.max(0, currentEntry().floors.length - 1);
    render();
}

function setFloor(index) {
    state.floorIndex = wrapIndex(index, currentEntry().floors.length);
    renderFloor();
}

function allStages(floor) {
    return floor.upper.concat(floor.lower, floor.star ?? []);
}

function monsterTotalHp(monster) {
    return Number(monster.hp ?? 0) * Number(monster.hp_ratio_sum ?? 1);
}

function floorTotalHp(floor) {
    let total = 0;

    allStages(floor).forEach(function (stage) {
        stage.monsters.forEach(function (wave) {
            wave.forEach(function (monster) {
                total += monsterTotalHp(monster);
            });
        });
    });

    return Math.round(total);
}

function renderScheduleSelect() {
    byId("scheduleSelect").replaceChildren(
        ...shadowSchedules.map(function (schedule, index) {
            return create("option", {
                text: `${schedule.shadow_name} | ${schedule.time}`,
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
    byId("scheduleName").textContent = schedule.shadow_name;
    byId("scheduleTime").textContent = schedule.time;
    byId("scheduleSelect").value = String(state.scheduleIndex);
}

const darkStyle = {
    border: "none",
    backgroundColor: "#27363E",
    color: "#eeeeee",
};

function asSection(id, className, recommendClass, lineupClass, resClass) {
    const prefix = id.replace("Section", "");

    return create("div", {
        className,
        attrs: { id },
        children: [
            create("div", { className: recommendClass, attrs: { id: `${prefix}Recommend` } }),
            create("div", { className: lineupClass, attrs: { id: `${prefix}Lineup` } }),
            create("div", { className: resClass, attrs: { id: `${prefix}Res` } }),
        ],
    });
}

function darkCard(id, className) {
    return create("div", {
        className,
        attrs: { id },
        style: darkStyle,
    });
}

function buildAsLayout() {
    const floor = currentFloor();
    const hasStar = Boolean(floor.star?.length);
    const twoColumnStyle = !hasStar && window.innerWidth > 800 ? { width: "calc(50% - 42px)" } : {};

    const upper = asSection("upperSection", "u", "u_r", "u_m", "u_s");
    const lower = asSection("lowerSection", "l", "l_r", "l_m", "l_s");
    const star = asSection("starSection", "t", "t_r", "t_m", "t_s");
    const upperBuff = darkCard("upperBuff", "u u_b_b");
    const lowerBuff = darkCard("lowerBuff", "l l_b_b");
    const starBuff = darkCard("starBuff", "t t_b_b");
    const upperFeatures = darkCard("upperFeatures", "u u_b");
    const lowerFeatures = darkCard("lowerFeatures", "l l_b");
    const starFeatures = darkCard("starFeatures", "t t_b");

    [upper, lower, upperBuff, lowerBuff, upperFeatures, lowerFeatures].forEach(function (node) {
        Object.assign(node.style, twoColumnStyle);
    });

    const children =
        window.innerWidth <= 800
            ? [
                  upper,
                  upperBuff,
                  upperFeatures,
                  lower,
                  lowerBuff,
                  lowerFeatures,
                  ...(hasStar ? [star, starBuff, starFeatures] : []),
              ]
            : [
                  create("div", { className: "u_l_w", children: hasStar ? [upper, lower, star] : [upper, lower] }),
                  upperBuff,
                  lowerBuff,
                  ...(hasStar ? [starBuff] : []),
                  upperFeatures,
                  lowerFeatures,
                  ...(hasStar ? [starFeatures] : []),
              ];

    byId("asLayout").replaceChildren(create("div", { className: "u_l", children }));
}

function renderBuff() {
    const entry = currentEntry();
    const floor = currentFloor();
    const buff = entry.buff_total;
    const title = buff.id ? `${buff.name}<br>${buff.id}` : buff.name;

    byId("buffName").innerHTML = title;
    byId("buffDesc").innerHTML = buffHtmlText(buff.description);
    byId("dpc").innerHTML = `${text.totalHp}<b><color style="color:#f29e38;">${floorTotalHp(floor)}</color></b>`;
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
                create("p", { text: `${text.recommended[labelIndex]}Lv${level}` }),
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

function stageHpCoefficientText(stage, floorNumber) {
    const coefficient = Number(stage.hp_coefficient);

    if (floorNumber !== 4 || !Number.isFinite(coefficient)) {
        return "";
    }

    return `<br>HP <color style="color:#cc0000">${(coefficient * 100).toFixed(0)}%</color>`;
}

function monsterValueLine(monster, info, key, color) {
    const value = monster[key];
    if (!value) return null;

    let html = `<b><color style="color:${color};">${String(value)}</color></b>`;

    if (key === "hp" && Number(monster.hp_ratio_sum) > 1) {
        html += `<b>×${monster.hp_ratio_sum}</b>`;
    }

    if (key === "speed" && info["6"]) {
        html += ` <color style='color:#666;'>[${(info["6"] * 100).toFixed(0)}%]</color>`;
    }

    return create("span", { className: "monname_2", html });
}

function renderMonster(monster, stageLevel) {
    const info = monsterCatalog[monster.id] ?? {};
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

    const bottom = create("div", {
        className: "monbottom",
        children: [
            create("span", {
                className: "monelem",
                children: renderElementIcons(info["2"] ?? [], "elem_as").map(function (node) {
                    return create("span", { children: [node] });
                }),
            }),
            create("span", {
                className: "monname_2",
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
            create("div", { className: "monleft", children: [icon, nameLayer] }),
            ...(hasStance(monster) ? [bottom] : []),
            create("div", { className: "monright", children: rightChildren }),
        ],
    });
}

function renderWave(wave, index, stageLevel) {
    const singleName = wave.length === 1 ? monsterCatalog[wave[0].id]?.["4"] : "";

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

function renderStage(stage, floorNumber) {
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
                html: `<color style="color:#2545ba">${stage.stage_id}</color>${stageHpCoefficientText(stage, floorNumber)}`,
                style: {
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: "0.9em",
                    marginTop: "-5px",
                    marginBottom: "5px",
                    lineHeight: "1.9",
                },
            }),
            create("div", {
                className: "stage_waves",
                children: stage.monsters.map(function (wave, index) {
                    return renderWave(wave, index, stage.level);
                }),
            }),
        ],
    });
}

function renderLineup(targetId, stages = [], floorNumber) {
    byId(targetId).replaceChildren(
        ...stages.map(function (stage) {
            return renderStage(stage, floorNumber);
        }),
    );
}

function renderRes(targetId, stages = []) {
    const monster = stages
        .flatMap(function (stage) {
            return stage.monsters;
        })
        .flat()
        .reduce(function (best, item) {
            return Number(item.hp ?? 0) > Number(best?.hp ?? 0) ? item : best;
        }, null);
    const info = monsterCatalog[monster?.id] ?? {};
    const statusRes = Number(monster?.status_res);
    const weakElements = new Set(info["2"] ?? []);
    const estimatedRes = Number.isFinite(statusRes) && statusRes > 0
        ? Object.fromEntries(
              allElements
                  .filter(function (elementName) {
                      return !weakElements.has(elementName);
                  })
                  .map(function (elementName) {
                      return [elementName, statusRes];
                  }),
          )
        : null;
    const res = info["9"] ?? estimatedRes;

    if (!res || !Object.keys(res).length) {
        byId(targetId).replaceChildren();
        return;
    }

    byId(targetId).replaceChildren(
        create("p", {
            text: text.res,
            style: {
                textAlign: "center",
                fontWeight: "bold",
            },
        }),
        create("div", {
            className: "res_wrapper",
            children: Object.entries(res).map(function ([elementName, value]) {
                return create("div", {
                    className: "res_each",
                    children: [
                        image(asset(`element/${elementName}.png`), "statpageicon_2", elementName, { style: "top:0" }),
                        create("span", { text: `${(Number(value) * 100).toFixed(0)}%` }),
                    ],
                });
            }),
        }),
    );
}

function paragraph(html) {
    return create("p", {
        html,
        style: {
            lineHeight: "1.7",
            marginBottom: "0",
        },
    });
}

function sectionTitle(title) {
    return [
        create("p", {
            text: title,
            className: "buff_name b1",
            style: {
                lineHeight: "1.7",
                margin: "0",
                fontWeight: "bold",
            },
        }),
        create("p", {
            text: title,
            className: "buff_name b2",
            style: {
                lineHeight: "1.7",
                margin: "0",
                fontWeight: "bold",
            },
        }),
    ];
}

function renderBuffRules(targetId, items = []) {
    byId(targetId).replaceChildren(
        ...sectionTitle(text.buff),
        ...items.map(function (item) {
            const title = item.id ? `${item.name}<br>${item.id}` : item.name;
            return paragraph(`<b>${title}</b><br>${buffHtmlText(item.description)}`);
        }),
    );
}

function renderBossFeatures(targetId, items = []) {
    const blocks = items.map(function (item) {
        const title = item.id ? `${item.name}<br>${item.id}` : item.name;
        const extra = (item.extra ?? [])
            .filter(function (effect) {
                return effect?.name || effect?.description;
            })
            .map(function (effect) {
                const title = effect.id ? `${effect.name}<br>${effect.id}` : effect.name;
                const name = title ? `<br><b>${title}</b>` : "";
                const description = effect.description ? `<br>${buffHtmlText(effect.description)}` : "";
                return `${name}${description}`;
            })
            .join("");

        return paragraph(`<b>${title}</b><br>${buffHtmlText(item.description)}${extra}`);
    });

    byId(targetId).replaceChildren(...sectionTitle(text.bossFeatures), ...blocks);
}

function renderSideExtras(prefix, entry) {
    renderBuffRules(`${prefix}Buff`, entry.buff[prefix] ?? []);
    renderBossFeatures(`${prefix}Features`, entry.boss_features[prefix] ?? []);
}

function toggle(id, show) {
    const node = byId(id);
    if (node) node.style.display = show ? "" : "none";
}

function chartEntries() {
    return shadowEntries.slice().reverse();
}

function pointsForFloor(floorNumber) {
    return chartEntries()
        .map(function (entry) {
            const floor = entry.floors.find(function (item) {
                return item.floor === floorNumber;
            });

            return floor
                ? {
                      id: entry.shadow_id,
                      name: entry.shadow_name,
                      hp: floorTotalHp(floor),
                  }
                : null;
        })
        .filter(Boolean);
}

function renderChart() {
    const floor = currentFloor();
    const points = pointsForFloor(floor.floor);
    const chartElement = byId("chart");
    const existingChart = window.echarts.getInstanceByDom(chartElement);

    if (existingChart) window.echarts.dispose(existingChart);
    if (!points.length) {
        chartElement.replaceChildren();
        return;
    }

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
            data: points.map(function (point) {
                return point.name;
            }),
            axisLabel: {
                color: "#000",
                padding: [5, 0],
            },
        },
        yAxis: { type: "value" },
        series: [
            {
                name: text.totalHp.replace("：", ""),
                type: "line",
                data: points.map(function (point) {
                    return point.hp;
                }),
                lineStyle: { color: "#cc0000" },
                itemStyle: { color: "#cc0000" },
            },
        ],
    };

    chartInstance.setOption(option, true);
    chartInstance.dispatchAction({
        type: "showTip",
        dataIndex: Math.max(
            0,
            points.findIndex(function (point) {
                return point.id === currentEntry().shadow_id;
            }),
        ),
        seriesIndex: 0,
    });
}

function renderFloor() {
    const entry = currentEntry();
    const floor = currentFloor();
    const hasStar = Boolean(floor.star?.length);

    buildAsLayout();
    byId("floorText").textContent = String(floor.floor);
    renderBuff();

    renderRecommend("upperRecommend", 0, floor.level, entry.element_upper);
    renderLineup("upperLineup", floor.upper, floor.floor);
    renderRes("upperRes", floor.upper);
    renderSideExtras("upper", entry);

    renderRecommend("lowerRecommend", 1, floor.level, entry.element_lower);
    renderLineup("lowerLineup", floor.lower, floor.floor);
    renderRes("lowerRes", floor.lower);
    renderSideExtras("lower", entry);

    for (const id of ["starSection", "starBuff", "starFeatures"]) {
        toggle(id, hasStar);
    }

    if (hasStar) {
        renderRecommend("starRecommend", 2, floor.level, entry.element_star);
        renderLineup("starLineup", floor.star, floor.floor);
        renderRes("starRes", floor.star);
        renderSideExtras("star", entry);
    }

    if (window.innerWidth <= 800) {
        document.querySelectorAll(".b1").forEach(function (node) {
            node.style.display = "";
            [...node.parentElement.children].forEach(function (child) {
                if (child !== node) child.style.display = "none";
            });
        });
    } else {
        document.querySelectorAll(".b1").forEach(function (node) {
            node.style.display = "none";
        });
    }

    renderChart();
}

function render() {
    renderScheduleSelect();
    renderScheduleHeader();
    renderFloor();
}

function toggleParagraphs(selector) {
    document.querySelectorAll(selector).forEach(function (node) {
        node.style.display = node.style.display === "none" ? "" : "none";
    });
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
        const card = event.target.closest?.(".monster_card");
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
        const card = event.target.closest?.(".monster_card");
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

document.body.addEventListener("click", function (event) {
    if (event.target.closest(".u_b .buff_name, .l_b .buff_name, .t_b .buff_name")) {
        toggleParagraphs(".u_b p, .l_b p, .t_b p");
    }
    if (event.target.closest(".u_b_b .buff_name, .l_b_b .buff_name, .t_b_b .buff_name")) {
        toggleParagraphs(".u_b_b p, .l_b_b p, .t_b_b p");
    }
});

async function init() {
    await loadShadowData();
    initMenu();
    setSchedule(0);
}

init().catch(function (error) {
    console.error(error);
    byId("asLayout").replaceChildren(
        create("p", {
            text: error.message,
            style: {
                textAlign: "center",
                color: "#cc0000",
                fontWeight: "bold",
            },
        }),
    );
});
