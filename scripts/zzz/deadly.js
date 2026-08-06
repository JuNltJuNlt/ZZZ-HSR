import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/deadly";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";
const EMOTE_ROOT = "../../images/ZZZ%20images/emote";

let deadlyEntries = [];
let monstersData = [];
let indexData = null;
let chartInstance = null;
let bossChartInstance = null;

const text = {
    title: "危局强袭战",
    chartTotalTitle: "试炼总血量演化",
    chartBossTitle: "试炼Boss血量演化",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
    stageLabels: ["第一间", "第二间", "第三间"],
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
    
    return create("div", {
        style: { 
            display: "flex", 
            justifyContent: "center", 
            gap: "3px", 
            marginTop: "4px",
            minHeight: "28px",
            visibility: items.length === 0 ? "hidden" : "visible"
        },
        children: items.length > 0 ? items.map(item => {
            const barColor = item.type === "weak" ? "#4CAF50" : "#C62828";
            return create("div", {
                style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" },
                children: [
                    image(`${ELEMENT_ROOT}/${item.element}.webp`, "elem_small", item.element),
                    create("span", { style: { width: "14px", height: "2px", borderRadius: "1px", backgroundColor: barColor, display: "block" } })
                ]
            });
        }) : []
    });
};

const renderMonsterCard = (monster, stageLevel, multiplier = 8.74) => {
    const info = monstersData.find(m => m.name === monster.name) || {};
    const type = info.type || "S";
    const imagePath = `${IMAGE_ROOT}/${type}/${monster.name}.webp`;
    const hp = Math.round((monster.hp || 0) * (monster.hp_ratio_sum ?? 1) * multiplier);
    const def = Math.round(monster.defense || 0);
    const stun = Math.round(monster.stun || 0);
    const img = image(imagePath, "monicon hasimg", monster.name);
    img.style.height = "180px";
    img.style.width = "auto";
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
        ],
    });
};

function processBossDesc(zoneData) {
    const allLines = [];
    
    if (zoneData.layer_buff) {
        Object.values(zoneData.layer_buff).forEach(buff => {
            if (buff && buff.desc && buff.desc.trim()) {
                const lines = buff.desc.split('\n').filter(l => l.trim());
                lines.forEach(l => allLines.push(l));
            }
        });
    }

    const suitLine = allLines.find(l => l.includes('适合') && l.includes('特性的代理人挑战'));
    const scoreLines = allLines.filter(l => l.includes('操作得分') || l.includes('可获得'));

    let result = '';
    if (suitLine) result += suitLine + '\n\n';
    const otherLines = allLines.filter(l => l !== suitLine && !scoreLines.includes(l));
    otherLines.forEach(l => result += l + '\n');
    if (scoreLines.length > 0) result += '\n';
    scoreLines.forEach(l => result += l + '\n');

    return result.trim();
}

const renderBossSection = (zoneData, letter, label, elements) => {
    let monster = null;
    
    if (zoneData.monsters && zoneData.monsters.length > 0) {
        monster = zoneData.monsters[0];
    }
    
    if (!monster && zoneData.layer_room) {
        const roomKeys = Object.keys(zoneData.layer_room);
        if (roomKeys.length > 0) {
            const room = zoneData.layer_room[roomKeys[0]];
            if (room && room.monsters && room.monsters.length > 0) {
                monster = room.monsters[0][0];
            }
        }
    }
    
    if (!monster && zoneData.monster_list) {
        const keys = Object.keys(zoneData.monster_list);
        if (keys.length > 0) {
            const rawMonster = zoneData.monster_list[keys[0]];
            if (rawMonster && rawMonster.stats) {
                monster = {
                    name: rawMonster.name,
                    hp: rawMonster.stats.hp,
                    defense: rawMonster.stats.defence,
                    stun: rawMonster.stats.stun,
                    hp_ratio_sum: 1,
                    weakness: zoneData.weakness || [],
                    resistance: []
                };
            }
        }
    }

    if (!monster) {
        const section = create("div", { className: letter, style: { display: "flex", flexDirection: "column", width: "100%" } });
        const recommend = create("div", { className: `${letter}_r` });
        recommend.appendChild(create("div", {
            children: [
                create("p", { text: `${label} Lv${zoneData.monster_level || 70}` }),
                ...renderElementIcons(elements, "elem_"),
                create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF" } }),
            ],
        }));
        section.appendChild(recommend);
        
        const lineup = create("div", { className: `${letter}_m` });
        lineup.appendChild(create("p", { text: "无怪物数据", style: { textAlign: "center", padding: "20px", color: "#999" } }));
        section.appendChild(lineup);
        
        const traitContainer = create("div", {
            className: `${letter}_b u_b`,
            style: {
                backgroundColor: "#27363E", color: "#eee", borderRadius: "5px", margin: "3px 0", padding: "14px",
                width: "100%", boxSizing: "border-box", textAlign: "left", display: "block",
            },
            children: [create("p", { text: "无机制说明", style: { lineHeight: "1.8", margin: "4px 0", fontSize: "14px", textAlign: "left", display: "block" } })],
        });
        section.appendChild(traitContainer);
        return section;
    }

    const section = create("div", { className: letter, style: { display: "flex", flexDirection: "column", width: "100%" } });
    const recommend = create("div", { className: `${letter}_r` });
    const lineup = create("div", { className: `${letter}_m` });
    
    recommend.appendChild(create("div", {
        children: [
            create("p", { text: `${label} Lv${zoneData.monster_level || 70}` }),
            ...renderElementIcons(elements, "elem_"),
            create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF" } }),
        ],
    }));

    if (!monster.weakness) monster.weakness = zoneData.weakness || [];
    if (!monster.resistance) monster.resistance = [];
    
    lineup.appendChild(create("div", { className: "wave_monsters", children: [renderMonsterCard(monster, zoneData.monster_level || 70, 8.74)] }));
    section.appendChild(recommend);
    section.appendChild(lineup);

    const combinedDesc = processBossDesc(zoneData);
    const html = combinedDesc
        .replace(/<color=([^>]+)>/g, '<color style="color:$1;">')
        .replace(/\n/g, '<br>')
        .replace(/^· /gm, '<br>· ')
        .replace(/^<br>/, '');

    const traitContainer = create("div", {
        className: `${letter}_b u_b`,
        style: {
            backgroundColor: "#27363E", color: "#eee", borderRadius: "5px", margin: "3px 0", padding: "14px",
            width: "100%", boxSizing: "border-box", textAlign: "left", display: "block",
        },
        children: [
            create("p", { html: html || "无机制说明", style: { lineHeight: "1.8", margin: "4px 0", fontSize: "14px", textAlign: "left", display: "block" } })
        ],
    });
    section.appendChild(traitContainer);

    return section;
};

const renderAllBosses = () => {
    const entry = currentEntry();
    const zone = entry.normal_zone || entry.zone || {};
    const zoneKeys = Object.keys(zone).sort();
    const container = byId("deadlyLayout");
    container.replaceChildren();

    const bossColors = ["u", "l", "t"];
    const allSharedBuffs = [];
    const sections = [];

    const bossRow = create("div", { 
        className: "u_l", 
        style: { 
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            position: "relative",
            width: "100%",
            padding: "0 40px",
            boxSizing: "border-box",
            flexWrap: "nowrap",
        } 
    });
    
    zoneKeys.forEach((zk, i) => {
        const zoneData = zone[zk];
        const elements = zoneData.weakness || [];
        if (zoneData.layer_room) {
            const roomValues = Object.values(zoneData.layer_room);
            if (roomValues.length > 0 && roomValues[0].weakness) {
                elements.push(...roomValues[0].weakness);
            }
        }
        const label = text.stageLabels[i] || `第${i+1}间`;
        
        const wrapper = create("div", {
            style: {
                flex: "0 0 auto",
                width: "calc(33.33% - 16px)",
                minWidth: "280px",
                maxWidth: "420px",
                display: "flex",
                flexDirection: "column",
            }
        });
        const section = renderBossSection(zoneData, bossColors[i], label, elements);
        sections.push({ section, wrapper, index: i });
        wrapper.appendChild(section);
        bossRow.appendChild(wrapper);
        
        if (zoneData.selectable_buff) {
            Object.values(zoneData.selectable_buff).forEach(b => {
                const exists = allSharedBuffs.find(x => x.desc === b.desc && x.title === b.title);
                if (!exists) {
                    allSharedBuffs.push(b);
                }
            });
        }
    });
    container.appendChild(bossRow);

    setTimeout(() => {
        const traitBoxes = sections.map(s => s.section.querySelector(`.u_b`));
        const validBoxes = traitBoxes.filter(b => b !== null);
        if (validBoxes.length > 0) {
            const maxH = Math.max(...validBoxes.map(b => b.offsetHeight || 0));
            validBoxes.forEach(b => { if (b) b.style.minHeight = maxH + "px"; });
        }
    }, 100);

    if (allSharedBuffs.length > 0) {
        const sharedBuffBox = create("div", {
            className: "shared-buff-box",
            style: {
                backgroundColor: "#27363E",
                color: "#eeeeee",
                borderRadius: "5px",
                margin: "16px 0 10px 0",
                padding: "20px",
                lineHeight: "1.8",
                display: "block",
                boxSizing: "border-box",
            },
            children: allSharedBuffs.map(buff => {
                const descHtml = buff.desc
                    .replace(/<color=([^>]+)>/g, '<color style="color:$1;">')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(Boolean)
                    .map(line => line.replace(/^· /, '·&nbsp;'))
                    .join('<br>');
                
                return create("p", {
                    html: `<b>${buff.title}</b><br><span style="font-size:14px;">${descHtml}</span>`,
                    style: { margin: "0 0 15px 0", textAlign: "left", display: "block" }
                });
            }),
        });
        container.appendChild(sharedBuffBox);

        setTimeout(() => {
            const allWrappers = bossRow.children;
            const firstWrapper = allWrappers[0];
            const lastWrapper = allWrappers[allWrappers.length - 1];
            
            if (firstWrapper && lastWrapper && allWrappers.length >= 3) {
                const containerRect = container.getBoundingClientRect();
                const firstRect = firstWrapper.getBoundingClientRect();
                const lastRect = lastWrapper.getBoundingClientRect();
                
                const leftOffset = firstRect.left - containerRect.left;
                const rightEdge = lastRect.right - containerRect.left;
                const totalWidth = rightEdge - leftOffset;
                
                sharedBuffBox.style.marginLeft = leftOffset + "px";
                sharedBuffBox.style.width = totalWidth + "px";
                sharedBuffBox.style.maxWidth = "none";
            }
        }, 300);
    }

    const finalSection = document.getElementById("finalSection");
    if (finalSection) finalSection.style.display = "none";
};

const renderCharts = () => {
    const entries = deadlyEntries.slice().reverse();
    const labels = entries.map(e => indexData.entries[deadlyEntries.indexOf(e)].replace('.json', ''));
    
    const totalData = entries.map(e => {
        const zone = e.normal_zone || e.zone || {};
        let total = 0;
        for (const zk of Object.keys(zone)) {
            const zd = zone[zk];
            let monsters = [];
            
            if (zd.monsters && zd.monsters.length > 0) {
                monsters = zd.monsters;
            }
            
            if (monsters.length === 0 && zd.layer_room) {
                for (const rk of Object.keys(zd.layer_room)) {
                    const room = zd.layer_room[rk];
                    if (room && room.monsters) {
                        room.monsters.forEach(w => w.forEach(m => {
                            monsters.push(m);
                        }));
                    }
                }
            }
            
            if (monsters.length === 0 && zd.monster_list) {
                monsters = Object.values(zd.monster_list).map(m => ({
                    hp: m.stats?.hp || 0,
                    hp_ratio_sum: 1
                }));
            }
            
            monsters.forEach(m => {
                total += (m.hp || 0) * (m.hp_ratio_sum || 1);
            });
        }
        return Math.round(total * 8.74);
    });
    
    const bossData = [[], [], []];
    entries.forEach(e => {
        const zone = e.normal_zone || e.zone || {};
        const zoneKeys = Object.keys(zone).sort();
        
        for (let i = 0; i < 3; i++) {
            let bossHP = 0;
            if (i < zoneKeys.length) {
                const zd = zone[zoneKeys[i]];
                let monsters = [];
                
                if (zd.monsters && zd.monsters.length > 0) {
                    monsters = zd.monsters;
                } else if (zd.layer_room) {
                    for (const rk of Object.keys(zd.layer_room)) {
                        const room = zd.layer_room[rk];
                        if (room && room.monsters) {
                            room.monsters.forEach(w => w.forEach(m => {
                                monsters.push(m);
                            }));
                        }
                    }
                } else if (zd.monster_list) {
                    monsters = Object.values(zd.monster_list).map(m => ({
                        hp: m.stats?.hp || 0,
                        hp_ratio_sum: 1
                    }));
                }
                
                monsters.forEach(m => {
                    bossHP += (m.hp || 0) * (m.hp_ratio_sum || 1);
                });
            }
            bossData[i].push(Math.round(bossHP * 8.74));
        }
    });
    
    renderLineChart("chart", text.chartTotalTitle, [{ name: "总血量", color: "#cc0000", data: totalData }], labels);
    renderLineChart("bossChart", text.chartBossTitle, [
        { name: text.stageLabels[0], color: "#cc0000", data: bossData[0] },
        { name: text.stageLabels[1], color: "#2545ba", data: bossData[1] },
        { name: text.stageLabels[2], color: "#4CAF50", data: bossData[2] },
    ], labels);
};

const renderLineChart = (targetId, title, seriesData, labels) => {
    const chartElement = byId(targetId);
    if (!chartElement || !seriesData.length || !window.echarts) return;
    
    chartElement.style.width = "100%";
    chartElement.style.height = "600px";
    
    const isTotalChart = targetId === "chart";
    const currentInstance = isTotalChart ? chartInstance : bossChartInstance;
    
    if (currentInstance && !currentInstance.isDisposed()) {
        currentInstance.resize();
        currentInstance.setOption({
            title: { text: title },
            legend: { data: seriesData.map(s => s.name) },
            xAxis: { data: labels },
            series: seriesData.map(s => ({ name: s.name, type: "line", data: s.data, lineStyle: { color: s.color }, itemStyle: { color: s.color } })),
        }, true);
        return;
    }
    
    const newInstance = window.echarts.init(chartElement);
    if (isTotalChart) {
        chartInstance = newInstance;
    } else {
        bossChartInstance = newInstance;
    }
    
    newInstance.setOption({
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
            a.download = `危局强袭战_${currentEntry().deadly_name || ''}.png`;
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