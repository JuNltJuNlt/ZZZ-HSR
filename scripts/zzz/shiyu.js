import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/shiyu";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

let shiyuEntries = [];
let monstersData = [];
let indexData = null;

const text = {
    title: "式舆防卫战",
    chartTotalTitle: "总血量演化",
    chartStageTitle: "各间血量演化",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
    waveNames: ["第一波", "第二波", "第三波", "第四波"],
    stageLabels: ["房间一", "房间二", "房间三"],
};

const state = {
    scheduleIndex: 0,
    floorIndex: 0,
};

const dataUrl = (fileName) => `${DATA_ROOT}/${fileName}`;

const fetchJson = async (fileName) => {
    const res = await fetch(dataUrl(fileName));
    if (!res.ok) throw new Error(`无法读取：${fileName}`);
    return res.json();
};

const loadData = async () => {
    indexData = await fetchJson("index.json");
    const mRes = await fetch('../../data/zzz/monsters.json');
    monstersData = (await mRes.json()).monsters;
    shiyuEntries = await Promise.all(indexData.entries.map(f => fetchJson(f)));
};

const currentEntry = () => shiyuEntries[state.scheduleIndex];
const currentFloor = () => {
    const zone = currentEntry().zone;
    const keys = Object.keys(zone).filter(k => k.length <= 7).sort();
    return zone[keys[state.floorIndex]];
};

const setSchedule = (index) => {
    const prevZone = currentEntry().zone;
    const prevKeys = Object.keys(prevZone).filter(k => k.length <= 7);
    const prevMaxFloor = prevKeys.length;
    const prevFloor = state.floorIndex;

    state.scheduleIndex = wrapIndex(index, shiyuEntries.length);
    
    const newZone = currentEntry().zone;
    const newKeys = Object.keys(newZone).filter(k => k.length <= 7);
    const newMaxFloor = newKeys.length;
    
    if (prevFloor >= newMaxFloor) {
        state.floorIndex = newMaxFloor - 1;
    } else {
        state.floorIndex = prevFloor;
    }
    
    render();
};

const setFloor = (index) => {
    const zone = currentEntry().zone;
    const keys = Object.keys(zone).filter(k => k.length <= 7);
    state.floorIndex = wrapIndex(index, keys.length);
    renderFloor();
};

const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...shiyuEntries.map((e, i) => create("option", {
            text: `${indexData.entries[i].replace('.json', '')} | ${e.begin_time} - ${e.end_time}`,
            attrs: { value: i, selected: i === state.scheduleIndex },
        })),
    );
};

const renderScheduleHeader = () => {
    const e = currentEntry();
    byId("scheduleName").textContent = indexData.entries[state.scheduleIndex].replace('.json', '');
    byId("scheduleTime").textContent = `${e.begin_time} - ${e.end_time}`;
    byId("scheduleSelect").value = String(state.scheduleIndex);
};

const renderFloorText = () => {
    const floor = currentFloor();
    byId("floorText").textContent = String(floor.stage_num);
};

const renderElementIcons = (elements = [], className = "elem_") =>
    elements.map(name => image(`${ELEMENT_ROOT}/${name}.webp`, className, name));

const renderWeaknessBars = (monster) => {
    const weakness = monster.weakness || [];
    const resistance = monster.resistance || [];
    const items = [];
    weakness.forEach(el => items.push({ element: el, type: "weak" }));
    resistance.forEach(el => items.push({ element: el, type: "resist" }));
    if (items.length === 0) return null;

    return create("div", {
        style: { display: "flex", justifyContent: "center", gap: "3px", marginTop: "4px" },
        children: items.map(item => {
            const barColor = item.type === "weak" ? "#4CAF50" : "#C62828";
            return create("div", {
                style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" },
                children: [
                    image(`${ELEMENT_ROOT}/${item.element}.webp`, "elem_small", item.element),
                    create("span", {
                        style: { width: "14px", height: "2px", borderRadius: "1px", backgroundColor: barColor, display: "block" }
                    })
                ]
            });
        })
    });
};

const stageTotalHp = (stage) =>
    Math.round(
        (stage.monsters || []).reduce((total, wave) =>
            total + wave.reduce((wt, m) => wt + m.hp * (m.hp_ratio_sum ?? 1) * (m.number ?? 1), 0), 0
        )
    );

const renderMonsterCard = (monster, stageLevel) => {
    const info = monstersData.find(m => m.name === monster.name) || {};
    const type = info.type || "C";
    const imagePath = `${IMAGE_ROOT}/${type}/${monster.name}.webp`;
    const hp = Math.round(monster.hp * (monster.hp_ratio_sum ?? 1));
    const def = monster.defense || 0;
    const stun = monster.stun || 0;

    return create("span", {
        className: "monster_card hover-shadow",
        attrs: { "data-lv": stageLevel },
        children: [
            create("div", {
                className: "monleft",
                children: [
                    image(imagePath, "monicon hasimg", monster.name),
                    ...(monster.number >= 2 ? [create("span", { className: "monicon_num", text: String(monster.number) })] : []),
                ],
            }),
            renderWeaknessBars(monster),
            create("div", {
                className: "monright",
                style: { textAlign: "center", marginTop: "4px" },
                children: [
                    create("span", { className: "monname", html: `<b><color style="color:#2545ba;">${stun}</color></b>` }),
                    create("br"),
                    create("span", { className: "monname", html: `<b><color style="color:#cc0000;">${hp}</color></b>` }),
                    create("br"),
                    create("span", { className: "monname", html: `<b><color style="color:#2545ba;">${def}</color></b>` }),
                ],
            }),
        ].filter(Boolean),
    });
};

const renderWave = (wave, index, stageLevel, waveNames) => {
    const waveName = waveNames?.[index];
    const displayName = waveName 
        ? (waveName.bold ? `<b>${waveName.name}</b>` : waveName.name)
        : (text.waveNames[index] || `第${index + 1}波`);
    
    return create("div", {
        className: "wave_wrap",
        children: [
            create("p", { className: "wave_name", html: displayName }),
            create("div", { className: "wave_monsters", children: wave.map(m => renderMonsterCard(m, stageLevel)) }),
        ],
    });
};

const renderStage = (stageData, label, elements, index) => {
    const letter = ["a", "b", "c"][index];
    return create("div", {
        className: "u_l",
        children: [
            create("div", {
                className: "u",
                children: [
                    create("div", {
                        className: `${letter}_r u_r`,
                        children: [
                            create("div", {
                                children: [
                                    create("p", { text: `${label} Lv${stageData.level || 70}` }),
                                    ...renderElementIcons(elements, "elem_"),
                                ],
                            }),
                        ],
                    }),
                    create("div", {
                        className: `${letter}_m u_m`,
                        children: [
                            create("div", {
                                className: "stage",
                                children: [
                                    create("div", {
                                        className: "emote_block_",
                                        children: [create("div", { className: "emote_", children: [image(`../../images/ZZZ%20images/emote/${1 + Math.floor(Math.random() * 6)}.png`, "", "")] })],
                                    }),
                                    create("div", {
                                        className: "stage_waves",
                                        children: (stageData.monsters || []).map((wave, wi) => renderWave(wave, wi, stageData.level, stageData.waveNames)),
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
};

const renderAllStages = () => {
    const floor = currentFloor();
    const rooms = Object.keys(floor.layer_room).sort();
    const buffKeys = Object.keys(floor.layer_buff).sort();
    const container = byId("shiyuStages");
    container.replaceChildren();
    
    if (rooms.length >= 3) {
        const buffRow = document.createElement("div");
        buffRow.style.display = "flex";
        buffRow.style.flexWrap = "wrap";
        buffRow.style.gap = "12px";
        buffRow.style.justifyContent = "center";
        buffRow.style.marginBottom = "12px";
        buffRow.style.width = "100%";
        
        buffKeys.forEach((bk) => {
            const buff = floor.layer_buff[bk];
            if (buff) {
                buffRow.appendChild(create("div", {
                    className: "smallbuff",
                    style: { flex: "1 1 30%", minWidth: "280px" },
                    children: [
                        create("p", { className: "smallbuff_name", text: buff.title || "" }),
                        create("p", { className: "smallbuff_desc", html: (buff.desc || "").replace(/<color=([^>]+)>/g, '<color style="color:$1;">').replace(/\n/g, '<br>').replace(/^· /gm, '<br>· ') }),
                    ],
                }));
            }
        });
        container.appendChild(buffRow);
    }
    
    const monsterRow = document.createElement("div");
    monsterRow.style.display = "flex";
    monsterRow.style.flexWrap = "wrap";
    monsterRow.style.gap = "12px";
    monsterRow.style.justifyContent = "center";
    monsterRow.style.width = "100%";
    
    rooms.forEach((rk, i) => {
        const stageData = floor.layer_room[rk];
        const elements = stageData.weakness || [];
        const label = text.stageLabels[i] || `房间${i + 1}`;
        const wrapper = document.createElement("div");
        wrapper.style.flex = `1 1 ${rooms.length === 3 ? '30%' : '45%'}`;
        wrapper.style.minWidth = "300px";
        wrapper.appendChild(renderStage(stageData, label, elements, i));
        monsterRow.appendChild(wrapper);
    });
    container.appendChild(monsterRow);
};

const renderBuffs = () => {
    const floor = currentFloor();
    const buffKeys = Object.keys(floor.layer_buff).sort();
    const stages = Object.keys(floor.layer_room).sort();
    const container = byId("shiyuBuffs");
    container.replaceChildren();

    if (stages.length >= 3) return;

    const buffs = buffKeys.map(k => floor.layer_buff[k]).filter(b => b && (b.title || b.desc));
    buffs.forEach((buff) => {
        container.appendChild(create("div", {
            className: "smallbuff a_b_0",
            style: { width: "100%" },
            children: [
                create("p", { className: "smallbuff_name", text: buff.title || "" }),
                create("p", { className: "smallbuff_desc", html: (buff.desc || "").replace(/<color=([^>]+)>/g, '<color style="color:$1;">').replace(/\n/g, '<br>').replace(/^· /gm, '<br>· ') }),
            ],
        }));
    });
};

const chartEntries = () => shiyuEntries.slice().reverse();

const renderCharts = () => {
    const floor = currentFloor();
    const floorNum = floor.stage_num;
    const entries = chartEntries();

    const totalData = entries.map(e => {
        const zone = e.zone;
        const keys = Object.keys(zone).filter(k => k.length <= 7).sort();
        const target = zone[keys[state.floorIndex]];
        if (!target) return 0;
        return Object.values(target.layer_room).reduce((sum, room) => sum + stageTotalHp(room), 0);
    });

    renderLineChart("totalChart", `节点${floorNum} 总血量演化`, [{ name: "总血量", color: "#cc0000", data: totalData }]);

    const rooms = Object.keys(floor.layer_room).sort();
    const stageSeries = rooms.map((rk, i) => {
        const color = ["#cc0000", "#2545ba", "#4CAF50"][i];
        return {
            name: text.stageLabels[i] || `房间${i + 1}`,
            color,
            data: entries.map(e => {
                const zone = e.zone;
                const keys = Object.keys(zone).filter(k => k.length <= 7).sort();
                const target = zone[keys[state.floorIndex]];
                if (!target || !target.layer_room[rk]) return 0;
                return stageTotalHp(target.layer_room[rk]);
            }),
        };
    });
    renderLineChart("stageChart", `节点${floorNum} 各间血量演化`, stageSeries);
};

const renderLineChart = (targetId, title, seriesData) => {
    const chartElement = byId(targetId);
    const entries = chartEntries();
    if (!chartElement || !entries.length || !window.echarts) return;

    const existingChart = window.echarts.getInstanceByDom(chartElement);
    if (existingChart) window.echarts.dispose(existingChart);

    const chartInstance = window.echarts.init(chartElement);
    const activeIndex = entries.findIndex(e => e.name === currentEntry().name);

    chartInstance.setOption({
        title: { text: title, subtext: text.chartSubtitle, left: "center", textStyle: { color: "#000" }, subtextStyle: { color: "#2545ba" }, top: "8%" },
        tooltip: { trigger: "axis" },
        grid: { left: "3%", right: "4%", top: "22%", containLabel: true },
        toolbox: { feature: { saveAsImage: {} }, right: "75%", top: "10%" },
        xAxis: { type: "category", data: entries.map(e => e.name || (indexData && indexData.entries[shiyuEntries.indexOf(e)] || "").replace('.json', '') || ""), axisLabel: { color: "#000", interval: 0, rotate: 30 } },
        yAxis: { type: "value" },
        legend: { data: seriesData.map(s => s.name), top: "16%" },
        series: seriesData.map(s => ({
            name: s.name, type: "line", data: s.data,
            lineStyle: { color: s.color }, itemStyle: { color: s.color },
        })),
    }, true);

    chartInstance.dispatchAction({ type: "showTip", dataIndex: activeIndex >= 0 ? activeIndex : entries.length - 1, seriesIndex: 0 });
};

const renderFloor = () => {
    renderFloorText();
    renderBuffs();
    renderAllStages();
    renderCharts();
};

const render = () => {
    renderScheduleSelect();
    renderScheduleHeader();
    renderFloor();
};

const bindEvents = () => {
    byId("prevSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex + 1));
    byId("nextSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex - 1));
    byId("scheduleSelect").addEventListener("change", e => setSchedule(Number(e.target.value)));
    byId("prevFloor").addEventListener("click", () => setFloor(state.floorIndex - 1));
    byId("nextFloor").addEventListener("click", () => setFloor(state.floorIndex + 1));
    
    byId("downloadBtn").addEventListener("click", (e) => {
        e.preventDefault();
        const title = document.querySelector(".content_title");
        const ver = document.querySelector(".ver");
        const floor = document.querySelector(".floor_select");
        const dl = byId("downloadBtn");
        if (title) title.style.marginBottom = "0";
        if (ver) ver.style.display = "none";
        if (floor) floor.style.display = "none";
        dl.style.display = "none";
        html2canvas(document.querySelector(".content"), { scale: 2, backgroundColor: "#f7f9fc", useCORS: true }).then(canvas => {
            const a = document.createElement("a");
            a.download = `式舆防卫战_${currentEntry().name}.png`;
            a.href = canvas.toDataURL("image/png");
            a.click();
            if (title) title.style.marginBottom = "";
            if (ver) ver.style.display = "";
            if (floor) floor.style.display = "";
            dl.style.display = "";
        });
    });

    document.body.addEventListener("click", (event) => {
        if (event.target.closest(".emote_block_")) {
            document.querySelectorAll(".emote_").forEach(node => {
                node.replaceChildren(image(`../../images/ZZZ%20images/emote/${1 + Math.floor(Math.random() * 6)}.png`, "", ""));
            });
        }
    });
};

const init = async () => {
    initMenu();
    await loadData();
    bindEvents();
    state.scheduleIndex = 0;
    const zone = currentEntry().zone;
    const keys = Object.keys(zone).filter(k => k.length <= 7);
    state.floorIndex = keys.length - 1;
    render();
};

init().catch(console.error);