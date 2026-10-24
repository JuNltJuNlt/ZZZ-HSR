import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/simulation";
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
    render();
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

// 修复需求3：顶部节点切换 UI
const renderNodeHeader = () => {
    const nodes = getCurrentNodes();
    byId("nodeIndexText").textContent = nodes.length > 0 ? `节点 ${state.nodeIndex + 1}` : "无节点";
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

// 小怪直接排布，不显示波次名字
const renderWave = (wave, index, stageLevel, customWaveNames, multiplier = 1) => {
    return create("div", { className: "wave_wrap", style: { width: "100%", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }, children: 
        wave.map(m => renderMonsterCard(m, stageLevel, multiplier))
    });
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

    // 1. 剧情节点
    if (node.type === "story") {
        node.branches.forEach((branch, idx) => {
            const details = create("details", {
                style: { backgroundColor: "#fff", border: "1px solid #dcdcdc", borderRadius: "8px", marginBottom: "16px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }
            });
            const summary = create("summary", {
                text: `走向 ${idx + 1}：${branch.name}`,
                style: { cursor: "pointer", padding: "16px 20px", fontWeight: "bold", fontSize: "16px", color: "#2545ba", backgroundColor: "#f8f9fa", borderBottom: "1px solid transparent", userSelect: "none", listStyle: "none" }
            });
            const contentDiv = create("div", { style: { padding: "20px", color: "#333", lineHeight: "1.8", fontSize: "14px", borderTop: "1px solid #eee" } });
            contentDiv.appendChild(create("div", { html: (branch.desc || "").replace(/\n/g, '<br>') }));
            
            if (branch.record) {
                contentDiv.appendChild(create("div", {
                    style: { marginTop: "20px", padding: "16px", backgroundColor: "#fff8e1", borderLeft: "4px solid #ffc107", borderRadius: "4px", color: "#5d4037" },
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
        // 前战/选战容器 (修复需求1：一行四个)
        if (node.small_stages && node.small_stages.length > 0) {
            const smallWarContainer = create("div", { style: { display: "flex", flexWrap: "wrap", gap: "15px", justifyContent: "center", marginBottom: "30px", width: "100%" } });
            let preBattleCount = 1;

            node.small_stages.forEach((stage) => {
                let displayLabel = stage.name;
                if (stage.tag === "前战") {
                    displayLabel = `前战${preBattleCount === 1 ? '一' : preBattleCount === 2 ? '二' : preBattleCount === 3 ? '三' : preBattleCount}`;
                    preBattleCount++;
                } else if (stage.tag === "选战") {
                    displayLabel = "选战";
                }
                
                // 修复需求1：计算 flex 宽度。如果刚好是4个，每个宽度 23%；如果不够4个，按剩余空间平分。
                const count = node.small_stages.length;
                const flexBasis = count >= 4 ? "calc(25% - 15px)" : `calc(${100/count}% - 15px)`;
                
                const wrapper = create("div", { style: { flex: `1 1 ${flexBasis}`, minWidth: "260px", maxWidth: "350px" } });
                const u_l = create("div", { className: "u_l" });
                const u = create("div", { className: "u" });
                
                const u_r = create("div", { className: "a_r u_r" });
                u_r.appendChild(create("div", { children: [
                    create("p", { text: `${displayLabel} Lv${stage.level}` }),
                    ...renderElementIcons(stage.weakness, "elem_"),
                    create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF", fontWeight: "normal" } })
                ]}));
                
                const u_m = create("div", { className: "a_m u_m" });
                const stageDiv = create("div", { className: "stage", style: { paddingBottom: "10px" } });
                const stageWaves = create("div", { className: "stage_waves" });
                
                stage.monsters.forEach((wave, wi) => {
                    stageWaves.appendChild(renderWave(wave, wi, stage.level, stage.waveNames, 1));
                });
                
                stageDiv.appendChild(stageWaves);
                u_m.appendChild(stageDiv);
                u.appendChild(u_r);
                u.appendChild(u_m);
                u_l.appendChild(u);
                wrapper.appendChild(u_l);
                smallWarContainer.appendChild(wrapper);
            });
            container.appendChild(smallWarContainer);
        }

        // Boss战 (修复需求2：恢复深色卡片)
        if (node.boss_stage) {
            const bossData = node.boss_stage;
            const monster = bossData.monsters?.[0]?.[0]; 
            
            if (monster) {
                const bossContainer = create("div", {
                    style: {
                        marginTop: "20px", padding: "20px", backgroundColor: "#27363E",
                        borderRadius: "8px", display: "flex", gap: "30px",
                        alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap"
                    }
                });

                const leftCol = create("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "10px" } });
                leftCol.appendChild(create("div", { className: "u_r", style: { textAlign: "center", color: "#fff", marginBottom: "15px" }, children: [
                    create("p", { text: monster.name, style: { fontSize: "20px", fontWeight: "bold", margin: "0 0 5px 0" } }),
                    ...renderElementIcons(bossData.weakness, "elem_"),
                    create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF", fontWeight: "normal", marginTop: "5px" } })
                ]}));
                
                const lineup = create("div", { className: "u_m" });
                // Boss 血量乘 8.74
                lineup.appendChild(create("div", { className: "wave_monsters", children: [
                    renderMonsterCard(monster, bossData.level, 8.74)
                ]}));
                leftCol.appendChild(lineup);

                const buffHtml = bossData.layer_buffs.map(b => b.desc).filter(Boolean).join('\n')
                    .replace(/<color=([^>]+)>/g, '<color style="color:$1;">')
                    .replace(/\n/g, '<br>')
                    .replace(/^· /gm, '<br>· ')
                    .replace(/^<br>/, '');
                
                const rightCol = create("div", {
                    className: "u_b",
                    style: { flex: "1 1 400px", backgroundColor: "#1e2a30", color: "#eee", borderRadius: "5px", padding: "20px", lineHeight: "1.8", fontSize: "14px", textAlign: "left", maxWidth: "600px" },
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
    renderNodeHeader();
    renderNodeContent();
};

const bindEvents = () => {
    byId("prevSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex + 1));
    byId("nextSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex - 1));
    byId("scheduleSelect").addEventListener("change", e => setSchedule(Number(e.target.value)));

    // 修复需求3：绑定顶部节点的切换按钮
    byId("prevNode").addEventListener("click", () => setNode(state.nodeIndex - 1));
    byId("nextNode").addEventListener("click", () => setNode(state.nodeIndex + 1));
    
    // 图片悬停
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