import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/simulation"; // 请确认你的数据目录
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

let simulationEntries = [];
let monstersData = [];
let indexData = null;

const text = {
    title: "临界推演",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
};

const state = {
    scheduleIndex: 0,
    nodeIndex: 0, 
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
    simulationEntries = await Promise.all(indexData.entries.map(f => fetchJson(f)));
};

const currentEntry = () => simulationEntries[state.scheduleIndex];
const getCurrentNodes = () => currentEntry().nodes || [];
const currentNode = () => getCurrentNodes()[state.nodeIndex] || null;

const setSchedule = (index) => {
    state.scheduleIndex = wrapIndex(index, simulationEntries.length);
    state.nodeIndex = 0;
    render();
};

const setNode = (index) => {
    const nodes = getCurrentNodes();
    state.nodeIndex = wrapIndex(index, nodes.length);
    renderNodeContent(); 
};

// ================= 顶部 UI =================
const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...simulationEntries.map((e, i) => create("option", {
            text: `${indexData.entries[i].replace('.json', '')} | ${e.simulation_name || ''}`,
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

const renderNodeNav = () => {
    const navContainer = byId("nodeNavContainer");
    navContainer.replaceChildren();
    const nodes = getCurrentNodes();
    if (nodes.length === 0) return;

    const navRow = create("div", { style: { display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", margin: "20px 0" } });
    
    nodes.forEach((node, idx) => {
        const isActive = idx === state.nodeIndex;
        const isBattle = node.type === "battle"; 
        const btn = create("button", {
            text: `${isBattle ? '⚔️' : '📜'} ${node.name}`,
            style: {
                padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer",
                backgroundColor: isActive ? "#27363E" : "#e0e0e0",
                color: isActive ? "#fff" : "#333",
                fontWeight: isActive ? "bold" : "normal"
            }
        });
        btn.addEventListener("click", () => setNode(idx));
        navRow.appendChild(btn);
    });
    navContainer.appendChild(navRow);
};

// ================= 通用组件 =================
const renderElementIcons = (elements = [], className = "elem_") =>
    elements.map(name => image(`${ELEMENT_ROOT}/${name}.webp`, className, name));

const getAbnormalValue = (monster) => {
    const info = monstersData.find(m => m.name === monster.name) || {};
    return info.stun || 0;
};

const renderWeaknessBars = (monster, abnormalValue) => {
    const monsterInfo = monstersData.find(m => m.name === monster.name) || {};
    const allWeakness = [...(monster.weakness || []), ...(monsterInfo.weakness || [])];
    const allResistance = [...(monster.resistance || []), ...(monsterInfo.resistance || [])];
    const mapItems = new Map();

    const parseItem = (str, isWeak) => {
        const cleanEl = str.replace(/\*/g, "");
        const starCount = (str.match(/\*/g) || []).length;
        const lines = Math.ceil(starCount / 2) + 1;
        if (!mapItems.has(cleanEl)) {
            mapItems.set(cleanEl, { element: cleanEl, type: isWeak ? "weak" : "resist", lines });
        } else {
            const existing = mapItems.get(cleanEl);
            if (isWeak) { existing.type = "weak"; existing.lines = Math.max(existing.lines, lines); }
            else if (existing.type === "resist") { existing.lines = Math.max(existing.lines, lines); }
        }
    };

    allWeakness.forEach(el => parseItem(el, true));
    allResistance.forEach(el => parseItem(el, false));
    const items = Array.from(mapItems.values());
    
    if (items.length === 0 && !abnormalValue) return null;

    return create("div", {
        style: { display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "4px", minHeight: "28px" },
        children: [
            ...items.map(item => {
                let barColor = item.type === "weak" ? "#4CAF50" : "#C62828";
                const bars = create("div", {
                    style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", marginTop: "2px" },
                    children: Array.from({ length: item.lines }).map(() => 
                        create("span", { style: { width: "14px", height: "2px", borderRadius: "1px", backgroundColor: barColor, display: "block" } })
                    )
                });
                return create("div", {
                    style: { display: "flex", flexDirection: "column", alignItems: "center" },
                    children: [
                        image(`${ELEMENT_ROOT}/${item.element}.webp`, "elem_small", item.element, { error: "remove" }),
                        bars
                    ]
                });
            }),
            abnormalValue ? create("span", { style: { color: "#6a1b9a", fontWeight: "bold", marginLeft: "4px" }, text: String(abnormalValue) }) : null,
        ].filter(Boolean)
    });
};

const renderMonsterCard = (monster, stageLevel, multiplier = 1) => {
    const info = monstersData.find(m => m.name === monster.name) || {};
    const type = info.type || monster.type || "C";
    const imagePath = `${IMAGE_ROOT}/${type}/${monster.name}.webp`;
    
    // 注意：数据转换时已经算过 hp_ratio_sum，此处 multiplier 默认为 1
    const hp = Math.round((monster.hp || 0) * (monster.hp_ratio_sum ?? 1) * multiplier);
    const def = Math.round(monster.defense || 0);
    const stun = Math.round(monster.stun || 0);
    
    const img = image(imagePath, "monicon hasimg", monster.name);
    const nameLayer = create("div", { className: "monnameload hasimgname", children: [create("p", { text: monster.name })] });
    img.addEventListener("load", () => { nameLayer.style.display = "none"; });
    img.addEventListener("error", () => { img.style.opacity = "0"; img.classList.remove("hasimg"); nameLayer.classList.remove("hasimgname"); img.parentElement.classList.add("monicon"); });
    
    return create("span", {
        className: "monster_card hover-shadow", attrs: { "data-lv": stageLevel },
        children: [
            create("div", { className: "monleft", children: [img, nameLayer] }),
            renderWeaknessBars(monster, getAbnormalValue(monster)),
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

// 波次渲染 (修复需求2：如果传入 customWaveNames，则使用自定义名字替换“第x波”)
const renderWave = (wave, index, stageLevel, customWaveNames) => {
    let waveNameStr = `第${index + 1}波`;
    if (customWaveNames && customWaveNames[index]) {
        const wn = customWaveNames[index];
        waveNameStr = wn.bold ? `<b>${wn.name}</b>` : wn.name;
    }
    
    return create("div", { className: "wave_wrap", children: [
        create("p", { className: "wave_name", html: waveNameStr }), 
        create("div", { className: "wave_monsters", children: wave.map(m => renderMonsterCard(m, stageLevel)) })
    ]});
};

// ================= 节点内容渲染 =================
const renderNodeContent = () => {
    const container = byId("simulationContent");
    container.replaceChildren();
    
    const node = currentNode();
    if (!node) {
        container.appendChild(create("p", { text: "暂无节点数据", style: { textAlign: "center", padding: "40px" } }));
        return;
    }

    // 1. 剧情节点 (折叠面板)
    if (node.type === "story") {
        node.branches.forEach((branch, idx) => {
            const details = create("details", {
                style: {
                    backgroundColor: "#fff",
                    border: "1px solid #dcdcdc",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                }
            });
            
            const summary = create("summary", {
                text: `走向 ${idx + 1}：${branch.name}`,
                style: {
                    cursor: "pointer",
                    padding: "16px 20px",
                    fontWeight: "bold",
                    fontSize: "16px",
                    color: "#2545ba",
                    backgroundColor: "#f8f9fa",
                    borderBottom: "1px solid transparent",
                    userSelect: "none",
                    listStyle: "none" // 隐藏默认箭头
                }
            });
            
            const contentDiv = create("div", { style: { padding: "20px", color: "#333", lineHeight: "1.8", fontSize: "14px", borderTop: "1px solid #eee" } });
            contentDiv.appendChild(create("div", { html: (branch.desc || "").replace(/\n/g, '<br>') }));
            
            if (branch.record) {
                contentDiv.appendChild(create("div", {
                    style: {
                        marginTop: "20px", padding: "16px", backgroundColor: "#fff8e1", borderLeft: "4px solid #ffc107",
                        borderRadius: "4px", color: "#5d4037"
                    },
                    children: [
                        create("h4", { text: branch.record.name, style: { margin: "0 0 8px 0", color: "#e65100" } }),
                        create("p", { text: branch.record.desc, style: { fontWeight: "bold", margin: "0 0 8px 0" } }),
                        create("p", { html: (branch.record.text || "").replace(/\n/g, '<br>'), style: { margin: 0 } })
                    ]
                }));
            }
            
            details.appendChild(summary);
            details.appendChild(contentDiv);
            container.appendChild(details);
        });
        return;
    }

    // 2. 战斗节点
    if (node.type === "battle") {
        // A. 小怪战 (前战/选战)
        if (node.small_stages && node.small_stages.length > 0) {
            const smallWarContainer = create("div", { style: { display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "center", marginBottom: "30px" } });
            let preBattleCount = 1;

            node.small_stages.forEach((stage) => {
                // 修复需求3：前战编号，选战固定名字
                let displayLabel = stage.name;
                if (stage.tag === "前战") {
                    displayLabel = `前战${preBattleCount === 1 ? '一' : preBattleCount === 2 ? '二' : preBattleCount === 3 ? '三' : preBattleCount}`;
                    preBattleCount++;
                } else if (stage.tag === "选战") {
                    displayLabel = "选战";
                }

                const wrapper = create("div", { style: { flex: "1 1 30%", minWidth: "320px", maxWidth: "450px" } });
                
                const stageBox = create("div", { className: "u_l", style: { border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden", background: "#fff" } });
                
                // 头部
                const header = create("div", { style: { padding: "12px", backgroundColor: "#f0f4f8", borderBottom: "1px solid #ddd", textAlign: "center" }, children: [
                    create("p", { text: `${displayLabel} Lv${stage.level}`, style: { margin: 0, fontWeight: "bold" } }),
                    ...renderElementIcons(stage.weakness, "elem_"),
                ]});
                
                // 主体
                const body = create("div", { className: "stage", style: { padding: "15px" }, children: [
                    create("div", { className: "stage_waves", children: stage.monsters.map((wave, wi) => 
                        renderWave(wave, wi, stage.level, stage.waveNames) // 修复需求2：传入 waveNames
                    ) })
                ]});
                
                stageBox.appendChild(header);
                stageBox.appendChild(body);
                wrapper.appendChild(stageBox);
                smallWarContainer.appendChild(wrapper);
            });
            container.appendChild(smallWarContainer);
        }

        // B. 强敌战 (复用危局绝境布局)
        if (node.boss_stage) {
            const bossData = node.boss_stage;
            const monster = bossData.monsters?.[0]?.[0]; // 取第一波第一个怪物
            
            if (monster) {
                const bossContainer = create("div", {
                    style: {
                        marginTop: "20px", padding: "20px", backgroundColor: "#27363E",
                        borderRadius: "8px", display: "flex", gap: "30px",
                        alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap"
                    }
                });

                // 左侧：怪物卡
                const leftCol = create("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "10px" } });
                leftCol.appendChild(create("div", { className: "u_r", style: { textAlign: "center", color: "#fff", marginBottom: "15px" }, children: [
                    create("p", { text: monster.name, style: { fontSize: "20px", fontWeight: "bold", margin: "0 0 5px 0" } }),
                    ...renderElementIcons(bossData.weakness, "elem_"),
                    create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF", fontWeight: "normal", marginTop: "5px" } })
                ]}));
                
                const lineup = create("div", { className: "u_m" });
                // 修复需求2：Boss 波次名字使用 Boss 名字
                lineup.appendChild(create("div", { className: "wave_monsters", children: [
                    renderMonsterCard(monster, bossData.level, 1)
                ]}));
                leftCol.appendChild(lineup);

                // 右侧：机制说明框
                const buffHtml = bossData.layer_buffs.map(b => b.desc).filter(Boolean).join('\n')
                    .replace(/<color=([^>]+)>/g, '<color style="color:$1;">')
                    .replace(/\n/g, '<br>')
                    .replace(/^· /gm, '<br>· ')
                    .replace(/^<br>/, '');
                
                const rightCol = create("div", {
                    className: "u_b",
                    style: {
                        flex: "1 1 400px", backgroundColor: "#1e2a30", color: "#eee",
                        borderRadius: "5px", padding: "20px", lineHeight: "1.8", fontSize: "14px",
                        textAlign: "left", maxWidth: "600px"
                    },
                    children: [ create("p", { html: buffHtml || "无特殊机制说明", style: { margin: 0 } }) ]
                });

                bossContainer.appendChild(leftCol);
                bossContainer.appendChild(rightCol);
                container.appendChild(bossContainer);
            }
        }
    }
};

// ================= 总渲染与事件 =================
const render = () => {
    renderScheduleSelect();
    renderScheduleHeader();
    renderNodeNav();
    renderNodeContent();
};

const bindEvents = () => {
    byId("prevSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex + 1));
    byId("nextSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex - 1));
    byId("scheduleSelect").addEventListener("change", e => setSchedule(Number(e.target.value)));
    
    // 图片悬停效果
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
    state.nodeIndex = 0;
    render();
};

init().catch(console.error);