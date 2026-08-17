import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/skill";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

let skillEntries = [];
let monstersData = [];
let indexData = null;

const text = {
    title: "拟境湮灭战",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
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

const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...skillEntries.map((e, i) => create("option", {
            text: `${indexData.entries[i].replace('.json', '')} | ${e.skill_name || ''}`,
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

const renderWeaknessBars = (boss) => {
    const weakness = boss.weakness || [];
    const resistance = boss.resistance || [];
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

const renderBossCard = (boss) => {
    const info = monstersData.find(m => m.name === boss.name) || {};
    const type = info.type || boss.type || "S";
    const imagePath = `${IMAGE_ROOT}/${type}/${boss.name}.webp`;
    const hpDisplay = `${boss.easy_hp.toLocaleString()} / ${boss.hard_hp.toLocaleString()}`;
    const def = boss.defense || 0;
    const stun = boss.stun || 0;
    const img = image(imagePath, "monicon hasimg", boss.name);
    img.style.height = "180px";
    img.style.width = "auto";
    const nameLayer = create("div", { className: "monnameload hasimgname", children: [create("p", { text: boss.name })] });
    img.addEventListener("load", () => { nameLayer.style.display = "none"; });
    img.addEventListener("error", () => { img.style.opacity = "0"; img.classList.remove("hasimg"); nameLayer.classList.remove("hasimgname"); img.parentElement.classList.add("monicon"); });
    return create("span", {
        className: "monster_card hover-shadow",
        children: [
            create("div", { className: "monleft", children: [img, nameLayer] }),
            renderWeaknessBars(boss),
            create("div", { className: "monright", style: { textAlign: "center", marginTop: "4px" }, children: [
                create("span", { className: "monname_2", html: `<b><color style="color:#000000;">${stun}</color></b>` }),
                create("br"),
                create("span", { className: "monname_2", html: `<b><color style="color:#cc0000;">${hpDisplay}</color></b>` }),
                create("br"),
                create("span", { className: "monname_2", html: `<b><color style="color:#2545ba;">${def}</color></b>` }),
            ]}),
        ],
    });
};

const processModeDesc = (desc) => {
    const lines = desc.split('\n').filter(l => l.trim());
    let result = '';
    let first = true;
    lines.forEach(line => {
        if (line.includes('【特殊挑战】')) {
            if (first) { result += line + '\n\n'; first = false; }
            else result += line + '\n';
        } else {
            result += line + '\n';
        }
    });
    return result.trim();
};

const renderBossBuffBox = (buffs, title) => {
    if (!buffs || buffs.length === 0) return null;
    return create("div", {
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
        },
        children: [
            ...(title ? [create("p", { text: title, style: { fontWeight: "bold", marginBottom: "8px" } })] : []),
            ...buffs.map(buff => create("p", {
                html: `<b>${buff.title || '无标题'}</b><br><span style="font-size:14px;">${(buff.desc || '').replace(/<color=([^>]+)>/g, '<color style="color:$1;">').replace(/\n/g, '<br>')}</span>`,
                style: { margin: "0 0 12px 0" }
            }))
        ],
    });
};

const render = () => {
    renderScheduleSelect();
    renderScheduleHeader();
    const entry = currentEntry();
    const container = byId("skillLayout");
    container.replaceChildren();

    const bosses = entry.bosses || [];
    
    if (bosses.length === 0) return;

    // 顶部共用 Buff（取第一个 Boss 的 layer_buffs，三个 Boss 相同）
    const sharedBuffs = bosses[0].layer_buffs || [];
    if (sharedBuffs.length > 0) {
        container.appendChild(renderBossBuffBox(sharedBuffs, ""));
    }

    // 三个 Boss 并排
    const bossRow = create("div", {
        style: {
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            width: "100%",
            padding: "0 40px",
            boxSizing: "border-box",
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
            
            wrapper.appendChild(create("div", {
                children: [
                    create("p", { text: `拟境${i + 1} Lv70` }),
                    ...renderElementIcons(boss.weakness || [], "elem_"),
                    create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF" } }),
                ],
            }));
            
            wrapper.appendChild(create("div", { className: "wave_monsters", children: [renderBossCard(boss)] }));
            
            // 机制框
            const modeDescHtml = processModeDesc(boss.mode_desc || '')
                .replace(/<color=([^>]+)>/g, '<color style="color:$1;">')
                .replace(/\n/g, '<br>');
            
            wrapper.appendChild(create("div", {
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
                },
                children: [create("p", { html: modeDescHtml || "无机制说明", style: { margin: "4px 0" } })]
            }));
            
            // Boss 专属 Buff 框
            const selectableBuffs = boss.selectable_buffs || [];
            if (selectableBuffs.length > 0) {
                wrapper.appendChild(renderBossBuffBox(selectableBuffs, ""));
            }
            
            return wrapper;
        })
    });
    
    container.appendChild(bossRow);
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

        html2canvas(document.body, {
            scale: 2,
            backgroundColor: "#29105a",
            useCORS: true,
            windowHeight: document.body.scrollHeight,
            windowWidth: document.body.scrollWidth
        }).then(canvas => {
            const a = document.createElement("a");
            a.download = `拟境湮灭战_${currentEntry().skill_name || ''}.png`;
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