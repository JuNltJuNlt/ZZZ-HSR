import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/skill";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const SKILL_IMAGE_ROOT = "../../images/ZZZ%20images/monster/skill";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

let skillEntries = [];
let monstersData = [];
let indexData = null;
let chartInstance = null;
let bossChartInstance = null;

const text = {
    title: "拟境湮灭战",
    chartTotalTitle: "总血量演化",
    chartBossTitle: "各Boss血量演化",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
    stageLabels: ["拟境1", "拟境2", "拟境3"],
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
    skillEntries = await Promise.all(indexData.entries.map(f => fetchJson(f)));
};

const currentEntry = () => skillEntries[state.scheduleIndex];

const setSchedule = (index) => {
    state.scheduleIndex = wrapIndex(index, skillEntries.length);
    render();
};

const isLowDef = (defense) => {
    return Math.abs((defense || 0) - 476) <= 2;
};

const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...skillEntries.map((e, i) => create("option", {
            text: `${indexData.entries[i].replace('.json', '')} | ${e.skill_name || ''} | ${e.time || ''}`,
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

const getAbnormalValue = (monster) => {
    const info = monstersData.find(m => m.name === monster.name) || {};
    return info.stun || 0;
};

const renderWeaknessBars = (monster, abnormalValue) => {
    const isSkillPage = document.title.includes("拟境湮灭战");
    const monsterInfo = monstersData.find(m => m.name === monster.name) || {};
    
    // 合并深渊怪物数据和基础数据库中的弱点和抗性
    const allWeakness = [...(monster.weakness || []), ...(monsterInfo.weakness || [])];
    const allResistance = [...(monster.resistance || []), ...(monsterInfo.resistance || [])];
    
    // 使用 Map 来合并同名属性，并记录最高星数
    const mapItems = new Map();

    const parseItem = (str, isWeak) => {
        // 提取纯净属性名（去掉所有 *）
        const cleanEl = str.replace(/\*/g, "");
        // 计算星号数量
        const starCount = (str.match(/\*/g) || []).length;
        // 如果是抗性，有星号则取星号数，无星号默认 1 根线。如果是弱点，固定 1 根绿线。
        const count = isWeak ? 1 : (starCount > 0 ? starCount : 1);
        
        if (!mapItems.has(cleanEl)) {
            mapItems.set(cleanEl, { element: cleanEl, type: isWeak ? "weak" : "resist", count });
        } else {
            const existing = mapItems.get(cleanEl);
            // 如果有一方是弱点，优先显示为弱点（绿色），否则合并红线数量
            if (isWeak) {
                existing.type = "weak";
                existing.count = 1;
            } else if (existing.type === "resist") {
                existing.count = Math.max(existing.count, count);
            }
        }
    };

    // 先处理弱点（优先级高）
    allWeakness.forEach(el => parseItem(el, true));
    // 再处理抗性
    allResistance.forEach(el => parseItem(el, false));

    const items = Array.from(mapItems.values());
    
    if (items.length === 0 && !abnormalValue) return null;

    return create("div", {
        style: { display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "4px", minHeight: "28px" },
        children: [
            ...items.map(item => {
                // 颜色判断
                let barColor = item.type === "weak" ? "#4CAF50" : "#C62828";
                if (isSkillPage) barColor = "#888888"; // 拟境强制灰色
                
                // 绘制多根横线（等号效果）
                const bars = Array.from({ length: item.count }).map(() => 
                    create("span", { 
                        style: { 
                            width: "14px", 
                            height: "2px", 
                            borderRadius: "1px", 
                            backgroundColor: barColor, 
                            display: "block",
                            marginTop: "1px" // 线与线之间的微小间距
                        } 
                    })
                );

                const imgStyle = isSkillPage ? { filter: "grayscale(100%)" } : {};

                return create("div", {
                    style: { display: "flex", flexDirection: "column", alignItems: "center" },
                    children: [
                        image(`${ELEMENT_ROOT}/${item.element}.webp`, "elem_small", item.element, {
                            style: imgStyle,
                            error: "remove"
                        }),
                        create("div", { 
                            style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "2px" },
                            children: bars 
                        })
                    ]
                });
            }),
            abnormalValue ? create("span", {
                style: { color: "#6a1b9a", fontWeight: "bold", marginLeft: "4px" },
                text: String(abnormalValue)
            }) : null,
        ].filter(Boolean)
    });
};

const renderBossCard = (boss) => {
    const info = monstersData.find(m => m.name === boss.name) || {};
    const type = info.type || boss.type || "S";
    const imagePath = `${IMAGE_ROOT}/${type}/${boss.name}.webp`;
    const def = boss.defense || 0;
    const stun = boss.stun || 0;
    const img = image(imagePath, "monicon hasimg", boss.name);
    img.style.height = "180px";
    img.style.width = "auto";
    const nameLayer = create("div", { className: "monnameload hasimgname", children: [create("p", { text: boss.name })] });
    img.addEventListener("load", () => { nameLayer.style.display = "none"; });
    img.addEventListener("error", () => { img.style.opacity = "0"; img.classList.remove("hasimg"); nameLayer.classList.remove("hasimgname"); img.parentElement.classList.add("monicon"); });
    
    const hpChildren = [
        create("span", { className: "monname_2", html: `<b><color style="color:#cc0000;">${boss.easy_hp}</color> / <color style="color:#9b59b6;">${boss.hard_hp}</color></b>` })
    ];
    
    if (isLowDef(def)) {
        const normEasy = Math.round(boss.easy_hp / 1.375);
        const normHard = Math.round(boss.hard_hp / 1.375);
        hpChildren.push(
            create("br"),
            create("span", { className: "monname_2", html: `<b><color style="color:#cc0000;">（${normEasy}</color> / <color style="color:#9b59b6;">${normHard}）</color></b>` })
        );
    }
    
    return create("span", {
        className: "monster_card hover-shadow",
        children: [
            create("div", { className: "monleft", children: [img, nameLayer] }),
            renderWeaknessBars(boss, getAbnormalValue(boss)),
            create("div", { className: "monright", style: { textAlign: "center", marginTop: "4px" }, children: [
                create("span", { className: "monname_2", html: `<b><color style="color:#000000;">${stun}</color></b>` }),
                create("br"),
                ...hpChildren,
                create("br"),
                create("span", { className: "monname_2", html: `<b><color style="color:#2545ba;">${def}</color></b>` }),
            ]}),
        ],
    });
};

const processModeDesc = (desc) => {
    const lines = desc.split('\n').filter(l => l.trim());
    let specialLines = [];
    let otherLines = [];
    lines.forEach(line => {
        if (line.includes('【特殊挑战】')) {
            specialLines.push(line.replace('【特殊挑战】', '').trim());
        } else if (line.includes('【关卡介绍】')) {
            otherLines.push(line.replace('【关卡介绍】', '').trim());
        } else {
            otherLines.push(line);
        }
    });
    
    let result = '';
    if (specialLines.length > 0) {
        result += '【特殊挑战】' + specialLines.join('') + '\n\n';
    }
    if (otherLines.length > 0) {
        result += '【关卡介绍】' + otherLines.join('\n');
    }
    return result.trim();
};

const render = () => {
    renderScheduleSelect();
    renderScheduleHeader();
    const entry = currentEntry();
    const container = byId("skillLayout");
    container.replaceChildren();

    const bosses = entry.bosses || [];
    if (bosses.length === 0) return;

    const bossRow = create("div", {
        style: {
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            width: "100%",
            padding: "0 40px",
            boxSizing: "border-box",
            alignItems: "flex-start",
        },
        children: bosses.map((boss, i) => {
            const wrapper = create("div", {
                style: {
                    flex: "0 0 auto",
                    width: "calc(33.33% - 16px)",
                    maxWidth: "420px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }
            });
            
            // 上方信息容器
            const topInfo = create("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" } });
            
            topInfo.appendChild(create("div", {
                style: {
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                },
                children: [
                    image(`${SKILL_IMAGE_ROOT}/${boss.name}.webp`, "", boss.name, {
                        style: { width: "100%", height: "auto", borderRadius: "5px" },
                        error: "remove",
                    }),
                ],
            }));
            
            topInfo.appendChild(create("div", {
                className: "u_r",
                style: { marginTop: "8px" },
                children: [
                    create("div", {
                        children: [
                            create("p", { text: boss.name }),
                            create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF", fontWeight: "normal" } }),
                        ],
                    }),
                ],
            }));
            
            topInfo.appendChild(create("div", { 
                className: "wave_monsters", 
                style: { marginTop: "16px" },
                children: [renderBossCard(boss)] 
            }));
            
            wrapper.appendChild(topInfo);
            
            const modeDescHtml = processModeDesc(boss.mode_desc || '')
                .replace(/<color=([^>]+)>/g, '<color style="color:$1;">')
                .replace(/\n/g, '<br>');
            
            // 机制框
            const mechanismBox = create("div", {
                style: {
                    backgroundColor: "#27363E",
                    color: "#eee",
                    borderRadius: "5px",
                    margin: "8px 0",
                    padding: "14px",
                    lineHeight: "1.8",
                    fontSize: "14px",
                    textAlign: "left",
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                },
                children: [create("p", { html: modeDescHtml || "无机制说明", style: { margin: "4px 0" } })]
            });
            wrapper.appendChild(mechanismBox);
            
            return wrapper;
        })
    });
    
    container.appendChild(bossRow);

    setTimeout(() => {
        const wrappers = Array.from(bossRow.children);
        const topInfos = wrappers.map(w => w.children[0]);
        const mechBoxes = wrappers.map(w => w.children[1]);
        
        if (wrappers.length === 3) {
            // 1. 重置高度和边距，让其自然渲染
            topInfos.forEach(el => el.style.minHeight = "");
            mechBoxes.forEach(el => {
                el.style.height = "auto";
                el.style.marginTop = "8px";
            });
            
            // 2. 计算三个“上方信息块”的最大高度
            const maxTopH = Math.max(...topInfos.map(el => el.offsetHeight));
            
            // 3. 强制上方信息块等底对齐
            topInfos.forEach(el => el.style.minHeight = maxTopH + "px");
            
            // 4. 强制机制框等高
            // 使用 requestAnimationFrame 确保上一步的 minHeight 生效后再测高度
            requestAnimationFrame(() => {
                const maxMechH = Math.max(...mechBoxes.map(el => el.offsetHeight));
                mechBoxes.forEach(el => el.style.height = maxMechH + "px");
            });
        }
    }, 500);

    renderCharts();
};

const renderCharts = () => {
    const entries = skillEntries.slice().reverse();
    const labels = entries.map(e => indexData.entries[skillEntries.indexOf(e)].replace('.json', ''));
    
    const totalData = entries.map(e => {
        const bosses = e.bosses || [];
        let total = 0;
        bosses.forEach(b => { total += b.hard_hp || 0; });
        return total;
    });
    
    renderLineChart("chart", text.chartTotalTitle, [{ name: "总血量", color: "#cc0000", data: totalData }], labels);
    
    const bossData = [[], [], []];
    entries.forEach(e => {
        const bosses = e.bosses || [];
        for (let i = 0; i < 3; i++) {
            bossData[i].push(bosses[i] ? (bosses[i].hard_hp || 0) : 0);
        }
    });
    
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
        }, false);
        return;
    }
    
    const newInstance = window.echarts.init(chartElement);
    if (isTotalChart) chartInstance = newInstance;
    else bossChartInstance = newInstance;
    
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

const bindEvents = () => {
    byId("prevSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex + 1));
    byId("nextSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex - 1));
    byId("scheduleSelect").addEventListener("change", e => setSchedule(Number(e.target.value)));
    byId("downloadBtn").addEventListener("click", (e) => {
        e.preventDefault();
        const container = document.querySelector("container");
        const content = document.querySelector(".content");
        const origStyle = container.getAttribute("style") || "";
        const bodyOrigStyle = document.body.getAttribute("style") || "";
        const contentOrigStyle = content.getAttribute("style") || "";
        
        container.style.overflow = "visible";
        container.style.height = "auto";
        document.body.style.overflow = "visible";
        document.body.style.height = "auto";
        content.style.overflow = "visible";
        content.style.height = "auto";
        
        const dl = byId("downloadBtn");
        dl.style.display = "none";

        setTimeout(() => {
            if (chartInstance && !chartInstance.isDisposed()) chartInstance.resize();
            if (bossChartInstance && !bossChartInstance.isDisposed()) bossChartInstance.resize();
            
            requestAnimationFrame(() => {
                html2canvas(content, {
                    scale: 2,
                    backgroundColor: "#ffffff",
                    useCORS: true,
                }).then(canvas => {
                    const a = document.createElement("a");
                    a.download = `拟境湮灭战_${currentEntry().skill_name || ''}.png`;
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                    container.setAttribute("style", origStyle);
                    document.body.setAttribute("style", bodyOrigStyle);
                    content.setAttribute("style", contentOrigStyle);
                    dl.style.display = "";
                });
            });
        }, 500);
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