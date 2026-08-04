import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/deadly";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

let deadlyEntries = [];
let monstersData = [];
let indexData = null;

const text = {
    title: "危局强袭战",
    chartTotalTitle: "总血量演化",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
    stageLabels: ["Boss一", "Boss二", "Boss三"],
};

const state = {
    scheduleIndex: 0,
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
    deadlyEntries = await Promise.all(indexData.entries.map(f => fetchJson(f)));
};

const currentEntry = () => deadlyEntries[state.scheduleIndex];

const setSchedule = (index) => {
    state.scheduleIndex = wrapIndex(index, deadlyEntries.length);
    render();
};

const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...deadlyEntries.map((e, i) => create("option", {
            text: `${indexData.entries[i].replace('.json', '')} | ${e.deadly_name || ''}`,
            attrs: { value: i, selected: i === state.scheduleIndex },
        })),
    );
};

const renderScheduleHeader = () => {
    const e = currentEntry();
    byId("scheduleName").textContent = indexData.entries[state.scheduleIndex].replace('.json', '');
    byId("scheduleTime").textContent = e.time || "";
    byId("scheduleSelect").value = String(state.scheduleIndex);
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

const renderMonsterCard = (monster, stageLevel) => {
    const info = monstersData.find(m => m.name === monster.name) || {};
    const type = info.type || "S";
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
            create("div", { className: "monleft", children: [img, nameLayer] }),
            renderWeaknessBars(monster),
            create("div", { className: "monright", style: { textAlign: "center", marginTop: "4px" }, children: [
                create("span", { className: "monname_2", html: `<b><color style="color:#000000;">${stun}</color></b>` }),
                create("br"),
                create("span", { className: "monname_2", html: `<b><color style="color:#cc0000;">${hp}</color></b>` }),
                create("br"),
                create("span", { className: "monname_2", html: `<b><color style="color:#2545ba;">${def}</color></b>` }),
            ]}),
        ].filter(Boolean),
    });
};

const renderBossSection = (zoneData, letter, label, elements) => {
    const roomKey = Object.keys(zoneData.layer_room)[0];
    const room = zoneData.layer_room[roomKey];
    const monster = room.monsters[0][0];
    const buffKeys = Object.keys(zoneData.layer_buff || {});

    const section = create("div", { className: letter, style: { display: "flex", flexDirection: "column" } });
    const recommend = create("div", { className: `${letter}_r` });
    const lineup = create("div", { className: `${letter}_m` });
    
    recommend.appendChild(create("div", {
        children: [
            create("p", { text: `${label} Lv${zoneData.monster_level || 70}` }),
            ...renderElementIcons(elements, "elem_"),
            create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF" } }),
        ],
    }));

    lineup.appendChild(create("div", { className: "wave_monsters", children: [renderMonsterCard(monster, zoneData.monster_level)] }));

    section.appendChild(recommend);
    section.appendChild(lineup);

    const buffContainer = create("div", { className: `${letter}_b u_b`, style: { backgroundColor: "#27363E", color: "#eee", borderRadius: "5px", margin: "3px 0", padding: "12px" } });
    buffKeys.forEach(bk => {
        const buff = zoneData.layer_buff[bk];
        if (buff && buff.desc) {
            buffContainer.appendChild(create("p", {
                html: `<b>${buff.title || ''}</b>${buff.title ? '<br>' : ''}${buff.desc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">')}`,
                style: { lineHeight: "1.7", margin: "4px 0", fontSize: "13px" }
            }));
        }
    });
    section.appendChild(buffContainer);

    return section;
};

const renderAllBosses = () => {
    const entry = currentEntry();
    const zone = entry.zone;
    const zoneKeys = Object.keys(zone).filter(k => k.length <= 7).sort();
    const container = byId("deadlyLayout");
    container.replaceChildren();

    const bossColors = ["u", "l", "t"];
    const allSelectableBuffs = [];

    const bossRow = create("div", { className: "u_l" });
    zoneKeys.forEach((zk, i) => {
        const zoneData = zone[zk];
        const elements = zoneData.layer_room ? Object.values(zoneData.layer_room)[0]?.weakness || [] : [];
        const label = text.stageLabels[i] || `Boss${i+1}`;
        bossRow.appendChild(renderBossSection(zoneData, bossColors[i], label, elements));
        if (i === 0 && zoneData.selectable_buff) {
            Object.values(zoneData.selectable_buff).forEach(b => allSelectableBuffs.push(b));
        }
    });
    container.appendChild(bossRow);

    if (allSelectableBuffs.length > 0) {
        const sharedBuffBox = create("div", {
            style: {
                width: "calc(100% - 36px)",
                backgroundColor: "#27363E",
                color: "#eeeeee",
                borderRadius: "5px",
                margin: "10px auto",
                padding: "20px",
                lineHeight: "1.8",
            },
            children: allSelectableBuffs.map(buff =>
                create("p", {
                    html: `<b>${buff.title}</b><br>${buff.desc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">')}`,
                    style: { margin: "0 0 15px 0" }
                })
            ),
        });
        container.appendChild(sharedBuffBox);
    }

    const hasFinal = entry.final_zone && Object.keys(entry.final_zone).length > 0;
    byId("finalSection").style.display = hasFinal ? "" : "none";
};

const renderCharts = () => {
    const entries = deadlyEntries.slice().reverse();
    const labels = entries.map(e => indexData.entries[deadlyEntries.indexOf(e)].replace('.json', ''));
    const totalData = entries.map(e => {
        const zone = e.zone;
        let total = 0;
        for (const zk of Object.keys(zone).filter(k => k.length <= 7)) {
            for (const rk of Object.keys(zone[zk].layer_room || {})) {
                const room = zone[zk].layer_room[rk];
                if (room.monsters) {
                    room.monsters.forEach(w => w.forEach(m => { total += m.hp * (m.hp_ratio_sum ?? 1); }));
                }
            }
        }
        return Math.round(total);
    });
    renderLineChart("totalChart", "危局强袭战总血量演化", [{ name: "总血量", color: "#cc0000", data: totalData }], labels);
};

const renderLineChart = (targetId, title, seriesData, labels) => {
    const chartElement = byId(targetId);
    if (!chartElement || !seriesData.length || !window.echarts) return;
    const existingChart = window.echarts.getInstanceByDom(chartElement);
    if (existingChart) window.echarts.dispose(existingChart);
    const chartInstance = window.echarts.init(chartElement);
    chartInstance.setOption({
        title: { text: title, subtext: text.chartSubtitle, left: "center", textStyle: { color: "#000" }, subtextStyle: { color: "#2545ba" }, top: "8%" },
        tooltip: { trigger: "axis" },
        grid: { left: "3%", right: "4%", top: "22%", containLabel: true },
        toolbox: { feature: { saveAsImage: {} }, right: "75%", top: "10%" },
        xAxis: { type: "category", data: labels, axisLabel: { color: "#000", interval: 0, rotate: 45, fontSize: 10 } },
        yAxis: { type: "value" },
        legend: { data: seriesData.map(s => s.name), top: "16%" },
        series: seriesData.map(s => ({ name: s.name, type: "line", data: s.data, lineStyle: { color: s.color }, itemStyle: { color: s.color } })),
        dataZoom: [{ type: "slider", start: 0, end: labels.length > 30 ? 30 : 100 }],
    }, true);
};

const render = () => {
    renderScheduleSelect();
    renderScheduleHeader();
    renderAllBosses();
    renderCharts();
};

const bindEvents = () => {
    byId("prevSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex + 1));
    byId("nextSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex - 1));
    byId("scheduleSelect").addEventListener("change", e => setSchedule(Number(e.target.value)));
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
        html2canvas(document.body, { scale: 2, backgroundColor: "#29105a", useCORS: true, windowHeight: document.body.scrollHeight, windowWidth: document.body.scrollWidth }).then(canvas => {
            const a = document.createElement("a");
            a.download = `危局强袭战_${currentEntry().name || ''}.png`;
            a.href = canvas.toDataURL("image/png");
            a.click();
            container.setAttribute("style", origStyle);
            document.body.style.overflow = "";
            document.body.style.height = "";
            dl.style.display = "";
        });
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
    render();
};

init().catch(console.error);