import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/shiyu";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

let shiyuEntries = [];
let monstersData = [];
let indexData = null;
let showPeakChart = false;
let peakChartLoaded = false;
let totalChartInstance = null;
let stageChartInstance = null;
let peakChartInstance = null;

const text = {
    title: "式舆防卫战",
    chartTotalTitle: "总血量演化",
    chartStageTitle: "各间血量演化",
    chartPeakTitle: "最高层总血量演化",
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
    if (prevFloor >= newMaxFloor) state.floorIndex = newMaxFloor - 1;
    else state.floorIndex = prevFloor;
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
    byId("floorText").textContent = String(currentFloor().stage_num);
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
                    create("span", { style: { width: "14px", height: "2px", borderRadius: "1px", backgroundColor: barColor, display: "block" } })
                ]
            });
        })
    });
};

const stageTotalHp = (stage) => {
    const allMonsters = (stage.monsters || []).flat();
    const aList = allMonsters.filter(m => { const info = monstersData.find(x => x.name === m.name); return info && (info.type === 'A' || info.type === 'S'); });
    const bList = allMonsters.filter(m => { const info = monstersData.find(x => x.name === m.name); return info && info.type === 'B'; });
    const cList = allMonsters.filter(m => { const info = monstersData.find(x => x.name === m.name); return info && info.type === 'C'; });
    let total = 0;
    if (aList.length > 0) total += Math.max(...aList.map(m => m.hp * (m.hp_ratio_sum ?? 1)));
    if (bList.length > 0) total += Math.max(...bList.map(m => m.hp * (m.hp_ratio_sum ?? 1)));
    if (cList.length > 0) total += cList.reduce((s, m) => s + m.hp * (m.hp_ratio_sum ?? 1), 0) / cList.length;
    return Math.round(total);
};

const floorTotalHp = (zone, floorNum) => {
    const fkey = Object.keys(zone).find(k => zone[k].stage_num === floorNum);
    if (!fkey) return 0;
    return Object.values(zone[fkey].layer_room).reduce((sum, room) => sum + stageTotalHp(room), 0);
};

const roomHp = (zone, floorNum, roomIndex) => {
    const fkey = Object.keys(zone).find(k => zone[k].stage_num === floorNum);
    if (!fkey) return 0;
    const rooms = Object.keys(zone[fkey].layer_room).sort();
    if (!rooms[roomIndex]) return 0;
    return stageTotalHp(zone[fkey].layer_room[rooms[roomIndex]]);
};

const parseVersion = (label) => {
    const match = label.match(/^(\d+)\.(\d+)/);
    if (!match) return 0;
    return parseFloat(match[1] + '.' + match[2]);
};

const isOldEntry = (e) => {
    const label = (indexData.entries[shiyuEntries.indexOf(e)] || "").replace('.json', '');
    return parseVersion(label) < 2.5;
};

const entryLabel = (e) => (indexData.entries[shiyuEntries.indexOf(e)] || "").replace('.json', '');

const renderMonsterCard = (monster, stageLevel) => {
    const info = monstersData.find(m => m.name === monster.name) || {};
    const type = info.type || "C";
    const imagePath = `${IMAGE_ROOT}/${type}/${monster.name}.webp`;
    const hp = Math.round(monster.hp * (monster.hp_ratio_sum ?? 1));
    const def = monster.defense || 0;
    const stun = monster.stun || 0;
    const img = image(imagePath, "monicon hasimg", monster.name);
    const nameLayer = create("div", { className: "monnameload hasimgname", children: [create("p", { text: monster.name })] });
    img.addEventListener("load", () => { nameLayer.style.display = "none"; });
    img.addEventListener("error", () => { img.style.opacity = "0"; img.classList.remove("hasimg"); nameLayer.classList.remove("hasimgname"); img.parentElement.classList.add("monicon"); });
    return create("span", {
        className: "monster_card hover-shadow", attrs: { "data-lv": stageLevel },
        children: [
            create("div", { className: "monleft", children: [img, nameLayer, ...(monster.number >= 2 ? [create("span", { className: "monicon_num", text: String(monster.number) })] : [])] }),
            renderWeaknessBars(monster),
            create("div", { className: "monright", style: { textAlign: "center", marginTop: "4px" }, children: [
                create("span", { className: "monname", html: `<b><color style="color:#000000;">${stun}</color></b>` }),
                create("br"),
                create("span", { className: "monname", html: `<b><color style="color:#cc0000;">${hp}</color></b>` }),
                create("br"),
                create("span", { className: "monname", html: `<b><color style="color:#2545ba;">${def}</color></b>` }),
            ]}),
        ].filter(Boolean),
    });
};

const renderWave = (wave, index, stageLevel, waveNames) => {
    const waveName = waveNames?.[index];
    const displayName = waveName ? (waveName.bold ? `<b>${waveName.name}</b>` : waveName.name) : (text.waveNames[index] || `第${index + 1}波`);
    return create("div", { className: "wave_wrap", children: [create("p", { className: "wave_name", html: displayName }), create("div", { className: "wave_monsters", children: wave.map(m => renderMonsterCard(m, stageLevel)) })] });
};

const renderStage = (stageData, label, elements, index) => {
    const letter = ["a", "b", "c"][index];
    const allWeakness = new Set(); const allResistance = new Set(); const aResistance = new Set();
    (stageData.monsters || []).flat().forEach(m => {
        (m.weakness || []).forEach(w => allWeakness.add(w));
        (m.resistance || []).forEach(r => { allResistance.add(r); const info = monstersData.find(x => x.name === m.name); if (info && (info.type === 'A' || info.type === 'S')) aResistance.add(r); });
    });
    const roomWeakness = [...allWeakness].filter(w => !allResistance.has(w) && !aResistance.has(w));
    const roomResistance = [...new Set([...allResistance, ...aResistance])].filter(r => !allWeakness.has(r) || aResistance.has(r));
    const summaryItems = []; roomWeakness.forEach(el => summaryItems.push({ element: el, type: "weak" })); roomResistance.forEach(el => summaryItems.push({ element: el, type: "resist" }));
    const summaryBars = summaryItems.length > 0 ? create("div", { style: { display: "flex", justifyContent: "center", gap: "4px", marginTop: "6px" }, children: summaryItems.map(item => create("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }, children: [image(`${ELEMENT_ROOT}/${item.element}.webp`, "elem_small", item.element), create("span", { style: { width: "14px", height: "2px", borderRadius: "1px", backgroundColor: item.type === "weak" ? "#4CAF50" : "#C62828", display: "block" } })] })) }) : null;
    return create("div", { className: "u_l", children: [create("div", { className: "u", children: [create("div", { className: `${letter}_r u_r`, children: [create("div", { children: [create("p", { text: `${label} Lv${stageData.level || 70}` }), ...renderElementIcons(elements, "elem_"), create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF" } }), summaryBars].filter(Boolean) })] }), create("div", { className: `${letter}_m u_m`, children: [create("div", { className: "stage", children: [create("div", { className: "emote_block_", children: [create("div", { className: "emote_", children: [image(`../../images/ZZZ%20images/emote/${1 + Math.floor(Math.random() * 6)}.png`, "", "")] })] }), create("div", { className: "stage_waves", children: (stageData.monsters || []).map((wave, wi) => renderWave(wave, wi, stageData.level, stageData.waveNames)) })] })] })] })] });
};

const renderAllStages = () => {
    const floor = currentFloor();
    const rooms = Object.keys(floor.layer_room).sort();
    const buffKeys = Object.keys(floor.layer_buff).sort();
    const container = byId("shiyuStages"); container.replaceChildren();
    if (rooms.length >= 3) {
        const buffRow = document.createElement("div"); buffRow.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:12px;width:100%";
        buffKeys.forEach(bk => { const buff = floor.layer_buff[bk]; if (buff) buffRow.appendChild(create("div", { className: "smallbuff", style: { flex: "1 1 30%", minWidth: "280px" }, children: [create("p", { className: "smallbuff_name", text: buff.title || "" }), create("p", { className: "smallbuff_desc", html: (buff.desc || "").replace(/<color=([^>]+)>/g, '<color style="color:$1;">').replace(/\n/g, '<br>').replace(/^· /gm, '<br>· ') })] })); });
        container.appendChild(buffRow);
    }
    const monsterRow = document.createElement("div"); monsterRow.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;justify-content:center;width:100%";
    rooms.forEach((rk, i) => { const stageData = floor.layer_room[rk]; const wrapper = document.createElement("div"); wrapper.style.cssText = `flex:1 1 ${rooms.length === 3 ? '30%' : '45%'};min-width:300px`; wrapper.appendChild(renderStage(stageData, text.stageLabels[i] || `房间${i + 1}`, stageData.weakness || [], i)); monsterRow.appendChild(wrapper); });
    container.appendChild(monsterRow);
};

const renderBuffs = () => {
    const floor = currentFloor();
    const buffKeys = Object.keys(floor.layer_buff).sort();
    const stages = Object.keys(floor.layer_room).sort();
    const container = byId("shiyuBuffs"); container.replaceChildren();
    if (stages.length >= 3) return;
    buffKeys.map(k => floor.layer_buff[k]).filter(b => b && (b.title || b.desc)).forEach(buff => { container.appendChild(create("div", { className: "smallbuff a_b_0", style: { width: "100%" }, children: [create("p", { className: "smallbuff_name", text: buff.title || "" }), create("p", { className: "smallbuff_desc", html: (buff.desc || "").replace(/<color=([^>]+)>/g, '<color style="color:$1;">').replace(/\n/g, '<br>').replace(/^· /gm, '<br>· ') })] })); });
};

let prevIsOld = null;

const renderCharts = () => {
    const floorNum = currentFloor().stage_num;
    const allReversed = shiyuEntries.slice().reverse();
    const oldEntries = allReversed.filter(e => isOldEntry(e));
    const newEntries = allReversed.filter(e => !isOldEntry(e));

    const isOld = isOldEntry(currentEntry());
    const activeEntries = isOld ? oldEntries : newEntries;
    const labels = activeEntries.map(e => entryLabel(e));

    const versionChanged = prevIsOld !== null && prevIsOld !== isOld;
    prevIsOld = isOld;

    const totalData = activeEntries.map(e => floorTotalHp(e.zone, floorNum));
    renderLineChart("totalChart", `节点${floorNum} 总血量演化`, [{ name: "总血量", color: "#cc0000", data: totalData }], labels, versionChanged);

    const currentFloorData = currentFloor();
    const actualRoomCount = Object.keys(currentFloorData.layer_room || {}).length;
    const roomCount = Math.min(actualRoomCount, 3);
    
    const stageSeries = [];
    const colors = ["#cc0000", "#2545ba", "#4CAF50"];
    for (let i = 0; i < roomCount; i++) {
        const data = activeEntries.map(e => roomHp(e.zone, floorNum, i));
        stageSeries.push({ name: text.stageLabels[i] || `房间${i + 1}`, color: colors[i], data });
    }
    renderLineChart("stageChart", `节点${floorNum} 各间血量演化`, stageSeries, labels, versionChanged);
};

const renderPeakChart = () => {
    const allReversed = shiyuEntries.slice().reverse();
    const oldEntries = allReversed.filter(e => isOldEntry(e));
    const newEntries = allReversed.filter(e => !isOldEntry(e));
    const allEntries = [...oldEntries, ...newEntries];
    const peakLabels = allEntries.map(e => entryLabel(e));
    const peakData = allEntries.map(e => {
        const label = entryLabel(e);
        const version = parseVersion(label);
        const floorToUse = version < 2.5 ? 7 : 5;
        return floorTotalHp(e.zone, floorToUse);
    });
    renderLineChart("peakChart", text.chartPeakTitle, [{ name: "最高层总血量", color: "#cc0000", data: peakData }], peakLabels, false);
};

const renderLineChart = (targetId, title, seriesData, labels, resetZoom = false) => {
    const chartElement = byId(targetId);
    if (!chartElement || !seriesData.length || !window.echarts) return;
    if (targetId === "peakChart") {
        chartElement.style.width = chartElement.parentElement.offsetWidth + "px";
        chartElement.style.height = "600px";
    }
    
    let currentInstance;
    if (targetId === "totalChart") currentInstance = totalChartInstance;
    else if (targetId === "stageChart") currentInstance = stageChartInstance;
    else currentInstance = peakChartInstance;
    
    if (currentInstance && !currentInstance.isDisposed()) {
        currentInstance.resize();
        
        if (resetZoom) {
            currentInstance.setOption({
                title: { text: title },
                legend: { data: seriesData.map(s => s.name) },
                xAxis: { data: labels },
                series: seriesData.map(s => ({ name: s.name, type: "line", data: s.data, lineStyle: { color: s.color }, itemStyle: { color: s.color } })),
                dataZoom: [{ type: "slider", start: 0, end: 100 }],
            }, { replaceMerge: ['series'] });
        } else {
            const currentOption = currentInstance.getOption();
            const currentDataZoom = currentOption.dataZoom;
            const currentStart = currentDataZoom?.[0]?.start ?? 0;
            const currentEnd = currentDataZoom?.[0]?.end ?? 100;
            
            currentInstance.setOption({
                title: { text: title },
                legend: { data: seriesData.map(s => s.name) },
                xAxis: { data: labels },
                series: seriesData.map(s => ({ name: s.name, type: "line", data: s.data, lineStyle: { color: s.color }, itemStyle: { color: s.color } })),
                dataZoom: [{ type: "slider", start: currentStart, end: currentEnd }],
            }, { replaceMerge: ['series'] });
        }
        return;
    }
    
    const newInstance = window.echarts.init(chartElement);
    if (targetId === "totalChart") totalChartInstance = newInstance;
    else if (targetId === "stageChart") stageChartInstance = newInstance;
    else peakChartInstance = newInstance;
    
    newInstance.setOption({
        title: { text: title, subtext: text.chartSubtitle, left: "center", textStyle: { color: "#000" }, subtextStyle: { color: "#2545ba" }, top: "8%" },
        tooltip: { trigger: "axis" },
        grid: { left: "3%", right: "4%", top: "22%", containLabel: true },
        toolbox: { feature: { saveAsImage: {} }, right: "75%", top: "10%" },
        xAxis: { type: "category", data: labels, axisLabel: { color: "#000", interval: 0, rotate: 45, fontSize: 10 } },
        yAxis: { type: "value" },
        legend: { data: seriesData.map(s => s.name), top: "16%" },
        series: seriesData.map(s => ({ name: s.name, type: "line", data: s.data, lineStyle: { color: s.color }, itemStyle: { color: s.color } })),
        dataZoom: [{ type: "slider", start: 0, end: 100 }],
    }, true);
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
    byId("togglePeakChart").addEventListener("click", () => {
        showPeakChart = !showPeakChart;
        const container = document.getElementById("peakChartContainer");
        if (showPeakChart) {
            container.style.display = "";
            if (!peakChartLoaded) {
                setTimeout(() => {
                    const peakChart = document.getElementById("peakChart");
                    peakChart.style.width = container.offsetWidth + "px";
                    peakChart.style.height = "600px";
                    renderPeakChart();
                    peakChartLoaded = true;
                }, 200);
            }
        } else {
            container.style.display = "none";
        }
    });
    byId("downloadBtn").addEventListener("click", (e) => {
        e.preventDefault();
        const container = document.querySelector("container");
        const origStyle = container.getAttribute("style") || "";
        container.style.overflow = "visible";
        container.style.height = "auto";
        document.body.style.overflow = "visible";
        document.body.style.height = "auto";
        
        const dl = byId("downloadBtn");
        dl.style.display = "none";

        html2canvas(document.body, {
            scale: 2,
            backgroundColor: "#29105a",
            useCORS: true,
            windowHeight: document.body.scrollHeight,
            windowWidth: document.body.scrollWidth
        }).then(canvas => {
            const a = document.createElement("a");
            a.download = `式舆防卫战_${currentEntry().name}.png`;
            a.href = canvas.toDataURL("image/png");
            a.click();
            container.setAttribute("style", origStyle);
            document.body.style.overflow = "";
            document.body.style.height = "";
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
    document.body.addEventListener("mouseenter", (event) => {
        const card = event.target.closest(".monster_card");
        if (!card) return;
        card.querySelectorAll(".hasimgname").forEach(node => node.style.display = "");
        card.querySelectorAll(".hasimg").forEach(node => node.style.opacity = "0.2");
    }, true);
    document.body.addEventListener("mouseleave", (event) => {
        const card = event.target.closest(".monster_card");
        if (!card) return;
        card.querySelectorAll(".hasimgname").forEach(node => node.style.display = "none");
        card.querySelectorAll(".hasimg").forEach(node => node.style.opacity = "1");
    }, true);
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