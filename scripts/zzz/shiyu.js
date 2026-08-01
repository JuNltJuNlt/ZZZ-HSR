import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/shiyu";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

let shiyuEntries = [];
let monsterCatalog = {};

const text = {
    title: "式舆防卫战",
    chartTotalTitle: "式舆防卫战总血量演化",
    chartStageTitle: "式舆防卫战三路血量演化",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
    waveNames: ["第一波", "第二波", "第三波"],
    stageNames: ["上路", "中路", "下路"],
};

const state = {
    scheduleIndex: 0,
};

const dataUrl = (fileName) => `${DATA_ROOT}/${fileName}`;

const fetchJson = async (fileName) => {
    const response = await fetch(dataUrl(fileName));
    if (!response.ok) throw new Error(`无法读取数据：${fileName}`);
    return response.json();
};

const loadShiyuData = async () => {
    const index = await fetchJson("index.json");
    monsterCatalog = await fetchJson("monster_catalog.json");
    shiyuEntries = await Promise.all(index.entries.map((fileName) => fetchJson(fileName)));
};

const currentEntry = () => shiyuEntries[state.scheduleIndex];

const setSchedule = (index) => {
    state.scheduleIndex = wrapIndex(index, shiyuEntries.length);
    render();
};

const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...shiyuEntries.map((entry, index) =>
            create("option", {
                text: `${entry.shiyu_name} | ${entry.time}`,
                attrs: { value: index, selected: index === state.scheduleIndex },
            }),
        ),
    );
};

const renderScheduleHeader = () => {
    const entry = currentEntry();
    byId("scheduleName").textContent = entry.shiyu_name;
    byId("scheduleTime").textContent = entry.time;
    byId("scheduleSelect").value = String(state.scheduleIndex);
};

const renderElementIcons = (elements = []) =>
    elements.map((name) => image(`${ELEMENT_ROOT}/${name}.webp`, "elem_", name));

const renderWeaknessBars = (weakness = [], resistance = []) => {
    const items = [];
    weakness.forEach((el) => items.push({ element: el, type: "weak" }));
    resistance.forEach((el) => items.push({ element: el, type: "resist" }));
    if (items.length === 0) return null;

    return create("div", {
        style: { display: "flex", justifyContent: "center", gap: "4px", marginTop: "6px" },
        children: items.map((item) => {
            const barColor = item.type === "weak" ? "#4CAF50" : "#C62828";
            return create("div", {
                style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
                children: [
                    image(`${ELEMENT_ROOT}/${item.element}.webp`, "elem", item.element),
                    create("span", {
                        style: {
                            width: "18px", height: "3px", borderRadius: "2px",
                            backgroundColor: barColor, display: "block"
                        }
                    })
                ]
            });
        })
    });
};

const stageTotalHp = (stage) =>
    Math.round(
        stage.monsters.reduce(
            (total, wave) =>
                total + wave.reduce((waveTotal, m) =>
                    waveTotal + m.hp * (m.hp_ratio_sum ?? 1) * (m.number ?? 1), 0),
            0,
        ),
    );

const renderMonsterCard = (monster, stageLevel) => {
    const info = monsterCatalog[monster.id] || {};
    const name = info.name || `怪物 ${monster.id}`;
    const type = info.type || "C";
    const imagePath = `${IMAGE_ROOT}/${type}/${name}.webp`;
    const hp = Math.round(monster.hp * (monster.hp_ratio_sum ?? 1));

    return create("span", {
        className: "monster_card hover-shadow",
        attrs: { "data-id": monster.id, "data-lv": stageLevel },
        children: [
            create("div", {
                className: "monleft",
                children: [
                    image(imagePath, "monicon hasimg", name),
                    ...(monster.number >= 2
                        ? [create("span", { className: "monicon_num", text: String(monster.number) })]
                        : []),
                ],
            }),
            create("div", {
                className: "monright",
                children: [
                    create("span", {
                        className: "monname",
                        html: `<b><color style="color:#cc0000;">${hp}</color></b>`,
                    }),
                ],
            }),
            renderWeaknessBars(info.weakness, info.resistance),
        ].filter(Boolean),
    });
};

const renderWave = (wave, index, stageLevel) => {
    const info = wave.length === 1 ? monsterCatalog[wave[0].id] : null;
    const waveTitle = info ? `<color style='font-weight:bold'>${info.name}</color>` : text.waveNames[index];

    return create("div", {
        className: "wave_wrap",
        children: [
            create("p", { className: "wave_name", html: waveTitle }),
            create("div", {
                className: "wave_monsters",
                children: wave.map((monster) => renderMonsterCard(monster, stageLevel)),
            }),
        ],
    });
};

const renderStage = (stage, label, elements) =>
    create("div", {
        className: "stage",
        children: [
            create("div", { className: "emote_block_", children: [
                create("div", { className: "emote_", children: [
                    image(`../../images/ZZZ%20images/emote/3.png`, "", "")
                ] })
            ]}),
            create("p", {
                html: `<color style="color:#2545ba">${label}</color>`,
                style: { textAlign: "center", fontWeight: "bold", fontSize: "0.9em", marginBottom: "15px" },
            }),
            create("div", {
                className: "stage_waves",
                children: stage.monsters.map((wave, index) => renderWave(wave, index, stage.level)),
            }),
        ],
    });

const renderAllStages = () => {
    const entry = currentEntry();
    const stages = [
        { stage: entry.monster_a, label: "上路", elements: entry.element_a },
        { stage: entry.monster_b, label: "中路", elements: entry.element_b },
        { stage: entry.monster_c, label: "下路", elements: entry.element_c },
    ];

    byId("shiyuStages").replaceChildren(
        ...stages.map(({ stage, label, elements }) =>
            create("div", {
                className: "u_l",
                children: [
                    create("div", {
                        className: "u",
                        children: [
                            create("div", {
                                className: "a_r u_r",
                                children: [
                                    create("div", {
                                        children: [
                                            create("p", { text: `${label} Lv${stage.level}` }),
                                            ...renderElementIcons(elements),
                                        ],
                                    }),
                                ],
                            }),
                            create("div", {
                                className: "a_m u_m",
                                children: [renderStage(stage, label, elements)],
                            }),
                        ],
                    }),
                ],
            }),
        ),
    );
};

const renderBuffs = () => {
    const entry = currentEntry();
    const buffs = [
        { label: "上路", buffs: entry.debuff_a },
        { label: "中路", buffs: entry.debuff_b },
        { label: "下路", buffs: entry.debuff_c },
    ];

    byId("shiyuBuffs").replaceChildren(
        ...buffs.map(({ label, buffs }, index) =>
            create("div", {
                className: `smallbuff a_b_${index}`,
                children: [
                    create("p", { className: "smallbuff_name", text: label }),
                    ...buffs.map((buff) =>
                        create("p", {
                            className: "smallbuff_desc",
                            html: `<b>${buff.name}</b><br>${buff.description}`,
                        }),
                    ),
                ],
            }),
        ),
    );
};

const chartEntries = () => [...shiyuEntries].reverse();

const renderLineChart = (targetId, title, seriesData) => {
    const chartElement = byId(targetId);
    const entries = chartEntries();
    if (!chartElement || !entries.length || !window.echarts) return;

    const existingChart = window.echarts.getInstanceByDom(chartElement);
    if (existingChart) window.echarts.dispose(existingChart);

    const chartInstance = window.echarts.init(chartElement);
    const activeIndex = entries.findIndex((e) => e.shiyu_id === currentEntry().shiyu_id);

    chartInstance.setOption({
        title: { text: title, subtext: text.chartSubtitle, left: "center", textStyle: { color: "#000" }, subtextStyle: { color: "#2545ba" }, top: "8%" },
        tooltip: { trigger: "axis" },
        grid: { left: "3%", right: "4%", top: "22%", containLabel: true },
        toolbox: { feature: { saveAsImage: {} }, right: "75%", top: "10%" },
        xAxis: { type: "category", data: entries.map((e) => e.shiyu_name), axisLabel: { color: "#000" } },
        yAxis: { type: "value" },
        legend: { data: seriesData.map((s) => s.name), top: "16%" },
        series: seriesData.map((s) => ({
            name: s.name, type: "line", data: s.data,
            lineStyle: { color: s.color }, itemStyle: { color: s.color },
        })),
    }, true);

    chartInstance.dispatchAction({ type: "showTip", dataIndex: activeIndex >= 0 ? activeIndex : entries.length - 1, seriesIndex: 0 });
};

const renderCharts = () => {
    const entries = chartEntries();
    renderLineChart("totalChart", text.chartTotalTitle, [
        { name: "总血量", color: "#cc0000", data: entries.map((e) =>
            stageTotalHp(e.monster_a) + stageTotalHp(e.monster_b) + stageTotalHp(e.monster_c)) },
    ]);
    renderLineChart("stageChart", text.chartStageTitle, [
        { name: "上路", color: "#cc0000", data: entries.map((e) => stageTotalHp(e.monster_a)) },
        { name: "中路", color: "#2545ba", data: entries.map((e) => stageTotalHp(e.monster_b)) },
        { name: "下路", color: "#4CAF50", data: entries.map((e) => stageTotalHp(e.monster_c)) },
    ]);
};

const render = () => {
    renderScheduleSelect();
    renderScheduleHeader();
    renderBuffs();
    renderAllStages();
    renderCharts();
};

const bindEvents = () => {
    byId("prevSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex + 1));
    byId("nextSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex - 1));
    byId("scheduleSelect").addEventListener("change", (e) => setSchedule(Number(e.target.value)));
};

const init = async () => {
    initMenu();
    await loadShiyuData();
    bindEvents();
    setSchedule(0);
};

init().catch(console.error);