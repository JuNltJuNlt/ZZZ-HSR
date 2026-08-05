import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/deadly";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";
const EMOTE_ROOT = "../../images/ZZZ%20images/emote";

let deadlyEntries = [];
let indexData = null;
let monstersData = [];

const state = { scheduleIndex: 0 };

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
const entryLabel = (e) => (indexData.entries[deadlyEntries.indexOf(e)] || "").replace('.json', '');

const setSchedule = (index) => {
    state.scheduleIndex = wrapIndex(index, deadlyEntries.length);
    render();
};

const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...deadlyEntries.map((e, i) => create("option", {
            text: `${entryLabel(e)} | ${e.deadly_name}`,
            attrs: { value: i, selected: i === state.scheduleIndex },
        })),
    );
};

const renderScheduleHeader = () => {
    const e = currentEntry();
    byId("scheduleName").textContent = entryLabel(e);
    byId("scheduleTime").textContent = e.deadly_name || "";
    byId("scheduleSelect").value = String(state.scheduleIndex);
};

// ===== 弱点/抗性横条 =====
const renderWeaknessBars = (weakness = [], resistance = []) => {
    const items = [];
    weakness.forEach(el => items.push({ element: el, type: "weak" }));
    resistance.forEach(el => items.push({ element: el, type: "resist" }));
    if (items.length === 0) return null;

    return create("div", {
        style: { display: "flex", justifyContent: "center", gap: "4px", marginTop: "6px" },
        children: items.map(item => {
            const barColor = item.type === "weak" ? "#4CAF50" : "#C62828";
            return create("div", {
                style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
                children: [
                    image(`${ELEMENT_ROOT}/${item.element}.webp`, "elem_small", item.element),
                    create("span", {
                        style: { width: "18px", height: "3px", borderRadius: "2px", backgroundColor: barColor, display: "block" }
                    })
                ]
            });
        })
    });
};

// ===== 渲染怪物卡片（复用式舆防卫战的样式） =====
const renderMonsterCard = (monster, stageLevel) => {
    const info = monstersData.find(m => m.name === monster.name) || {};
    const type = info.type || "S";
    const imagePath = `${IMAGE_ROOT}/${type}/${monster.name}.webp`;
    const hp = Math.round(monster.hp * (monster.hp_ratio_sum ?? 1));
    const def = monster.defense || 0;
    const stun = monster.stun || 0;

    const img = image(imagePath, "monicon hasimg", monster.name);
    const nameLayer = create("div", {
        className: "monnameload hasimgname",
        children: [create("p", { text: monster.name })],
    });

    img.addEventListener("load", () => { nameLayer.style.display = "none"; });
    img.addEventListener("error", () => {
        img.style.opacity = "0";
        img.classList.remove("hasimg");
        nameLayer.classList.remove("hasimgname");
        img.parentElement?.classList.add("monicon");
    });

    return create("span", {
        className: "monster_card hover-shadow",
        attrs: { "data-lv": stageLevel },
        children: [
            create("div", { className: "monleft", children: [img, nameLayer] }),
            renderWeaknessBars(monster.weakness, monster.resistance),
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

// ===== 渲染试炼Boss（恢复原来的样式） =====
const renderTrialZone = (zoneKey, zoneData) => {
    const monster = zoneData.monsters[0];
    const card = renderMonsterCard(monster, zoneData.monster_level);
    
    // 提取所有buff（layer_buff + selectable_buff）
    const buffs = [];
    Object.values(zoneData.layer_buff || {}).forEach(b => {
        if (b.desc && b.desc.trim()) {
            buffs.push({ title: b.title || "", desc: b.desc });
        }
    });
    Object.values(zoneData.selectable_buff || {}).forEach(b => {
        if (b.desc && b.desc.trim()) {
            buffs.push({ title: b.title || "", desc: b.desc });
        }
    });

    const buffElements = buffs.map(b => 
        create("p", {
            className: "buff_desc",
            html: `<b>${b.title}</b><br>${b.desc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">')}`,
            style: { lineHeight: "1.7", marginTop: "11px", marginBottom: "0" }
        })
    );

    return create("div", {
        className: "u_l",
        children: [
            create("div", {
                className: "u",
                children: [
                    create("div", {
                        className: "u_r",
                        children: [
                            create("div", {
                                children: [
                                    create("p", { text: `${zoneData.name} Lv${zoneData.monster_level}` }),
                                    card,
                                ]
                            })
                        ]
                    }),
                    create("div", {
                        className: "u_m",
                        children: [
                            create("div", {
                                className: "stage",
                                children: [
                                    create("div", {
                                        className: "emote_block_",
                                        children: [create("div", { className: "emote_", children: [image(`${EMOTE_ROOT}/${1 + Math.floor(Math.random() * 6)}.png`, "", "")] })]
                                    }),
                                    create("div", {
                                        className: "buff",
                                        style: { backgroundColor: "#27363E", color: "#eeeeee", borderRadius: "5px", padding: "12px" },
                                        children: buffElements.length > 0 ? buffElements : [create("p", { text: "无特殊机制" })]
                                    }),
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
};

// ===== 渲染绝境关卡 =====
const renderFinalZone = (zoneKey, zoneData) => {
    const monster = zoneData.monsters[0];
    const info = monstersData.find(m => m.name === monster.name) || {};
    const type = info.type || "S";
    const imagePath = `${IMAGE_ROOT}/${type}/${monster.name}.webp`;
    const hp = Math.round(monster.hp * (monster.hp_ratio_sum ?? 1));
    const hpFinal = Math.round(hp * 15.8);
    const def = monster.defense || 0;
    const stun = monster.stun || 0;

    // 提取buff
    const buffs = [];
    Object.values(zoneData.layer_buff || {}).forEach(b => {
        if (b.desc && b.desc.trim()) {
            buffs.push({ title: b.title || "", desc: b.desc });
        }
    });
    Object.values(zoneData.selectable_buff || {}).forEach(b => {
        if (b.desc && b.desc.trim()) {
            buffs.push({ title: b.title || "", desc: b.desc });
        }
    });

    const buffElements = buffs.map(b =>
        create("div", {
            className: "mechanic-item",
            html: `<b>${b.title || "机制"}</b><br>${b.desc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">')}`
        })
    );

    return create("div", {
        className: "final-card",
        children: [
            create("div", {
                className: "monster-info",
                children: [
                    image(imagePath, "", monster.name, { style: "width:180px;height:180px;object-fit:contain;background:#eef2f7;border-radius:8px;" }),
                    create("div", { className: "monster-name", text: monster.name }),
                    renderWeaknessBars(monster.weakness, monster.resistance),
                    create("div", { className: "monster-stats", children: [
                        create("p", { html: `血量：<span class="hp">${hpFinal.toLocaleString()}</span> (×15.8)` }),
                        create("p", { html: `防御：<span class="def">${def}</span>` }),
                        create("p", { html: `失衡条：<span class="stun">${stun}</span>` }),
                    ]}),
                ]
            }),
            create("div", {
                className: "mechanic-box",
                children: [
                    create("div", { className: "mechanic-title", text: "— 机制说明 —" }),
                    ...(buffElements.length > 0 ? buffElements : [create("div", { className: "mechanic-item", text: "无特殊机制" })]),
                ]
            })
        ]
    });
};

// ===== 渲染绝境血量演化图 =====
const renderFinalChart = () => {
    const entries = deadlyEntries.slice().reverse();
    const container = document.getElementById("finalChartContainer");
    const chartElement = document.getElementById("finalChart");
    
    const finalEntries = entries.filter(e => e.final_zone && Object.keys(e.final_zone).length > 0);
    if (finalEntries.length === 0) {
        container.style.display = "none";
        return;
    }
    container.style.display = "";

    const labels = finalEntries.map(e => entryLabel(e));
    const data = finalEntries.map(e => {
        const zone = Object.values(e.final_zone)[0];
        const monster = zone.monsters[0];
        return Math.round((monster.hp * (monster.hp_ratio_sum ?? 1)) * 15.8);
    });

    if (chartElement && window.echarts) {
        const existingChart = window.echarts.getInstanceByDom(chartElement);
        if (existingChart) window.echarts.dispose(existingChart);
        const chartInstance = window.echarts.init(chartElement);
        chartInstance.setOption({
            title: {
                text: "绝境总血量演化",
                subtext: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
                left: "center",
                textStyle: { color: "#000" },
                subtextStyle: { color: "#cc0000" },
                top: "8%"
            },
            tooltip: { trigger: "axis" },
            grid: { left: "3%", right: "4%", top: "22%", containLabel: true },
            toolbox: { feature: { saveAsImage: {} }, right: "75%", top: "10%" },
            xAxis: { type: "category", data: labels, axisLabel: { color: "#000", interval: 0, rotate: 30, fontSize: 10 } },
            yAxis: { type: "value" },
            series: [{
                name: "绝境总血量",
                type: "line",
                data: data,
                lineStyle: { color: "#cc0000" },
                itemStyle: { color: "#cc0000" },
            }],
            dataZoom: [{ type: "slider", start: 0, end: labels.length > 30 ? 30 : 100 }],
        }, true);
    }
};

// ===== 渲染试炼血量演化图 =====
const renderTrialChart = () => {
    const chartElement = byId("chart");
    if (!chartElement || !window.echarts) return;
    
    const entries = deadlyEntries.slice().reverse();
    const labels = entries.map(e => entryLabel(e));
    const data = entries.map(e => {
        let total = 0;
        if (e.normal_zone) {
            Object.values(e.normal_zone).forEach(zone => {
                zone.monsters.forEach(m => {
                    total += m.hp * (m.hp_ratio_sum ?? 1);
                });
            });
        }
        return Math.round(total);
    });

    const existingChart = window.echarts.getInstanceByDom(chartElement);
    if (existingChart) window.echarts.dispose(existingChart);
    const chartInstance = window.echarts.init(chartElement);
    chartInstance.setOption({
        title: {
            text: "试炼总血量演化",
            subtext: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
            left: "center",
            textStyle: { color: "#000" },
            subtextStyle: { color: "#2545ba" },
            top: "8%"
        },
        tooltip: { trigger: "axis" },
        grid: { left: "3%", right: "4%", top: "22%", containLabel: true },
        toolbox: { feature: { saveAsImage: {} }, right: "75%", top: "10%" },
        xAxis: { type: "category", data: labels, axisLabel: { color: "#000", interval: 0, rotate: 30, fontSize: 10 } },
        yAxis: { type: "value" },
        series: [{
            name: "试炼总血量",
            type: "line",
            data: data,
            lineStyle: { color: "#2545ba" },
            itemStyle: { color: "#2545ba" },
        }],
        dataZoom: [{ type: "slider", start: 0, end: labels.length > 30 ? 30 : 100 }],
    }, true);
};

// ===== 主渲染函数 =====
const render = () => {
    renderScheduleSelect();
    renderScheduleHeader();
    
    const entry = currentEntry();
    const layout = byId("asLayout");
    layout.replaceChildren();

    // 1. 渲染试炼三Boss（使用原有格式）
    if (entry.normal_zone && Object.keys(entry.normal_zone).length > 0) {
        const zoneKeys = Object.keys(entry.normal_zone).sort();
        zoneKeys.forEach(key => {
            layout.appendChild(renderTrialZone(key, entry.normal_zone[key]));
        });
    }

    // 2. 渲染绝境关卡
    const finalSection = document.getElementById("finalSection");
    const finalLayout = document.getElementById("finalLayout");
    if (entry.final_zone && Object.keys(entry.final_zone).length > 0) {
        finalSection.style.display = "";
        finalLayout.replaceChildren();
        const finalKeys = Object.keys(entry.final_zone).sort();
        finalKeys.forEach(key => {
            finalLayout.appendChild(renderFinalZone(key, entry.final_zone[key]));
        });
    } else {
        finalSection.style.display = "none";
    }

    // 3. 渲染绝境图表
    renderFinalChart();

    // 4. 渲染试炼图表
    renderTrialChart();
};

// ===== 事件绑定 =====
const bindEvents = () => {
    byId("prevSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex + 1));
    byId("nextSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex - 1));
    byId("scheduleSelect").addEventListener("change", e => setSchedule(Number(e.target.value)));
};

// ===== 初始化 =====
const init = async () => {
    initMenu();
    await loadData();
    bindEvents();
    setSchedule(0);
};

init().catch(console.error);