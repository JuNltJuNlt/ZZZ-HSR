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
    return create("span", {
        className: "monster_card hover-shadow",
        children: [
            create("div", { className: "monleft", children: [img, nameLayer] }),
            create("div", { style: { minHeight: "28px" } }),
            create("div", { className: "monright", style: { textAlign: "center", marginTop: "4px" }, children: [
                create("span", { className: "monname_2", html: `<b><color style="color:#000000;">${stun}</color></b>` }),
                create("br"),
                create("span", { className: "monname_2", html: `<b><color style="color:#cc0000;">${boss.easy_hp}</color> / <color style="color:#9b59b6;">${boss.hard_hp}</color></b>` }),
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

const renderBuffItems = (buffs) => {
    if (!buffs || buffs.length === 0) return [];
    return buffs.map(buff => create("p", {
        html: `<b>${buff.title}</b><br><span style="font-size:14px;">${(buff.desc || '').replace(/<color=([^>]+)>/g, '<color style="color:$1;">').replace(/\n/g, '<br>')}</span>`,
        style: { margin: "0 0 12px 0" }
    }));
};

const render = () => {
    renderScheduleSelect();
    renderScheduleHeader();
    const entry = currentEntry();
    const container = byId("skillLayout");
    container.replaceChildren();

    const bosses = entry.bosses || [];
    if (bosses.length === 0) return;

    const sharedBuffs = bosses[0].layer_buffs || [];
    if (sharedBuffs.length > 0) {
        const sharedBox = create("div", {
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
            children: renderBuffItems(sharedBuffs)
        });
        container.appendChild(sharedBox);
    }

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
            
            wrapper.appendChild(create("div", {
                className: "u_r",
                children: [
                    create("div", {
                        children: [
                            create("p", { text: `拟境${i + 1} Lv70` }),
                            create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF" } }),
                        ],
                    }),
                ],
            }));
            
            wrapper.appendChild(create("div", { 
                className: "wave_monsters", 
                style: { marginTop: "16px" },
                children: [renderBossCard(boss)] 
            }));
            
            const modeDescHtml = processModeDesc(boss.mode_desc || '')
                .replace(/<color=([^>]+)>/g, '<color style="color:$1;">')
                .replace(/\n/g, '<br>');
            
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
                },
                children: [create("p", { html: modeDescHtml || "无机制说明", style: { margin: "4px 0" } })]
            });
            wrapper.appendChild(mechanismBox);
            
            const selectableBuffs = boss.selectable_buffs || [];
            if (selectableBuffs.length > 0) {
                const buffBox = create("div", {
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
                    children: renderBuffItems(selectableBuffs)
                });
                wrapper.appendChild(buffBox);
            }
            
            return wrapper;
        })
    });
    
    container.appendChild(bossRow);

    setTimeout(() => {
        const mechanismBoxes = bossRow.querySelectorAll('.u_b, [style*="border-radius"]');
        const boxes = Array.from(bossRow.children).map(child => {
            const mech = child.children[2];
            const buff = child.children[3];
            return { mech, buff };
        });
        
        const validMechs = boxes.map(b => b.mech).filter(el => el);
        const validBuffs = boxes.map(b => b.buff).filter(el => el);
        
        if (validMechs.length > 0) {
            const maxH = Math.max(...validMechs.map(el => el.offsetHeight));
            validMechs.forEach(el => el.style.height = maxH + "px");
        }
        if (validBuffs.length > 0) {
            const maxH = Math.max(...validBuffs.map(el => el.offsetHeight));
            validBuffs.forEach(el => el.style.height = maxH + "px");
        }
    }, 200);
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