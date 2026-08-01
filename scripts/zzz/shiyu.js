import { initMenu } from "../menu.js";
import { byId, create, image, wrapIndex } from "../tools.js";

const DATA_ROOT = "../../data/zzz/shiyu";
const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
const ELEMENT_ROOT = "../../images/ZZZ%20images/element";

let shiyuEntries = [];
let monstersData = [];

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

const knownMap = {
    'Notorious - Thanatos': '恶名·塔纳托斯',
    'Notorious - Dullahan': '恶名·杜拉罕',
    'Notorious - Dead End Butcher': '恶名·死路屠夫',
    'Mandrake': '曼德拉',
    'Hoplitai': '霍普利泰',
    'Thanatos': '塔纳托斯',
    'Dullahan': '杜拉罕',
    'Dead End Butcher': '死路屠夫',
    'Farbauti': '法布提',
    'Armored Hati': '装甲哈提',
    'Alpeca': '阿佩卡',
    'Greta - Overclocked': '格莱特·超频型',
    'Hans': '汉斯',
    'Wicked Wraith': '恶灵',
    'Frenzied Maniac': '狂乱暴徒',
    'Vicious Striker': '恶毒打手',
    'Greedy Ranger': '贪婪射手',
    'Lightfoot Rover MK II': '「捷足巡游者Ⅱ型」',
    'Assault Gunner': '突击炮手',
    'Scout Jaeger': '巡防猎兵',
    'Patrol Jaeger': '戍卫猎兵',
    'Guardian': '「卫士」',
    'Heavy Striker': '重装炮手',
    'Strike Jaeger': '掠袭猎兵',
    'Light Jaeger': '袭扰猎兵',
    'Ionized - Dullahan': '离子体·杜拉罕',
    'Ionized - Farbauti': '离子体·法布提',
    'Ionized - Cyrtoidea': '离子体·瑟托迪亚',
    'Ionized - Nassellaria': '离子体·纳塞勒亚',
    'Ionized - Thanatos': '离子体·塔纳托斯',
    'Bulky Enforcer': '魁梧施虐者',
    'Bulky Intimidator': '魁梧打手',
    'Assaulter': '袭击者',
    'Pyromaniac': '纵火犯',
    'Raider': '掠夺者',
    'Poacher': '偷猎者',
    'Heavy Striker MK II': '「重装侵袭者Ⅱ型」',
    'Guardian MK II': '「卫士Ⅱ型」',
    'Enraged Sweeper': '盛怒恶霸',
    'Private Jaeger': '新晋猎兵',
    'Troublemaker - Wanted Enforcer': '祸首·通缉打手',
    'Ambusher': '偷袭者',
    'Rustler': '盗猎客',
    'Beholder Engine': '眼魔引擎',
    'Greta': '格莱特',
    'Ahriman': '秽息原牲',
    'Airspace Patrolboo': '空域侦巡布',
    'Airspace Sentinel': '「空域戒戍者」',
    'Arlaune': '阿劳恩',
    'Arsonist': '焚毁狂',
    'Banyrek': '班尼雷克',
    'Blastcrawler': '绽壳虫',
    'City Guardboo': '城防戍卫布',
    'Demolition Jaeger': '掷弹猎兵',
    'Doppelganger - Abyssal Enforcer': '多佩冈亚·暗渊惩戒者',
    'Doppelganger - Bellum': '多佩冈亚·「变节者」',
    'Doppelganger - Jane': '多佩冈亚·简',
    'Doppelganger - Mors': '多佩冈亚·莫尔斯',
    'Doppelganger - Pulchra': '多佩冈亚·波可娜',
    'Doppelganger - Starlight - Billy': '多佩冈亚·星辉·比利',
    'Exalting Hymnist': '颂礼赞者',
    'Faun': '萨提尔',
    'Flame Cantor': '秉火领颂',
    'Fossor': '弗瑟尔',
    'Fossor - Energized': '弗瑟尔·蓄能型',
    'Friday': '星期五',
    'Friday - Energized': '星期五·蓄能型',
    'Goblin': '地精',
    'Goblin - Energized': '地精·蓄能型',
    'Grenadier Jaegers': '轰击猎兵',
    'Guard Jaeger': '戍卫猎兵',
    'Harrier Jaeger': '掠袭猎兵',
    'Hati': '哈提',
    'Hati - Energized': '哈提·蓄能型',
    'Hati Pack Leader — Energized': '哈提头犬·蓄能型',
    'Haytor': '赫由托',
    'Heavy Gunner': '轰击猎兵',
    'Hitchspiker': '游魂',
    'Huskron': '赫斯克龙',
    'Ionized - Pugnus': '离子体·普格努斯',
    'Lahmu': '拉赫穆',
    'Lightfoot Rover': '「捷足巡游者」',
    'Lockspring': '索迪代斯',
    'Looter': '偷猎者',
    'Lumberjack': '伐木机',
    'Metamorphosed - Avarus': '蜕生·阿瓦鲁斯',
    'Metamorphosed - City Guardboo': '蜕生·城防戍卫布',
    'Metamorphosed - Scorpse': '蜕生·蝎骸',
    'Metamorphosed - Special Anti-Riotboo': '蜕生·特勤镇暴布',
    'Metro Goblin': '铁道地精',
    'Miasma Ravager - Avarus': '秽息蚀者·阿瓦鲁斯',
    'Miasma Spawn': '秽息原牲',
    'Miasma Walker - Arcavor': '秽息行者·阿卡沃尔',
    'Miasma Walker - Scorpse': '秽息行者·蝎骸',
    'Miasmic - Abyssal Enforcer': '秽蚀·暗渊惩戒者',
    'Miasmic - Doppelganger - The Defector': '秽蚀·多佩冈亚·「变节者」',
    'Miasmic - Huskron': '秽蚀·赫斯克龙',
    'Miasmic - Jane': '秽蚀·简',
    'Miasmic - Lightfoot Rover': '秽蚀·「捷足巡游者」',
    'Miasmic - Rampant Brute': '秽蚀·蛮横力士',
    'Miasmic - Terror Raptor': '秽蚀·「骸鸟」',
    'Miasmic - Thracian': '秽蚀·色雷斯人',
    'Miasmic - Trinox': '秽蚀·特里诺斯',
    'Miasmic Komano Manato': '秽蚀·狛野真斗',
    'Miasmic Trooper - Cannoneer': '秽息残兵·炮手',
    'Miasmic Trooper - Shieldguard': '秽息残兵·盾卫',
    'Mirage Archer Unit': '幻矢单元',
    'Mushussu': '怒蛇',
    'Palicus': '帕里库斯',
    'Rampant Brute': '蛮横力士',
    'Rookie Jaeger': '新晋猎兵',
    'Ruthless Fiend': '凶心疯汉',
    'Sacrifice - Heretic Jester': '牲鬼·凶魁愚者',
    'Shielded Defender': '「护戍盾卫」',
    'Shielded Defender Omega': '「护戍盾卫Ω型」',
    'Sordidus': '索迪代斯',
    'Sordidus - Energized': '索迪代斯·蓄能型',
    'Special Anti-Riotboo': '特勤镇暴布',
    'Specialized Assault Bomber': '特战强袭轰击者',
    'Specter': '游魂',
    'Tarasque Mixer': '泰拉斯奎祸车',
    'Tepes': '特佩什',
    'Terror Raptor': '骸鸟',
    'Thracian': '色雷斯人',
    'Typhon Challenger': '「提丰·挑战者型」',
    'Typhon Slugger': '「提丰·重击者型」',
    'Tyrfing': '提尔锋',
    'Tyrfing (Infested)': '提尔锋（寄生态）',
    'Wanted Enforcer': '通缉打手',
    'Wanted Intimidator': '通缉虐待狂',
};

function fuzzyMatch(name) {
    for (const [en, cn] of Object.entries(knownMap)) {
        if (name.toLowerCase().includes(en.toLowerCase())) return cn;
    }
    const match = monstersData.find(m => m.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(m.name.toLowerCase()));
    return match ? match.name : name;
}

const dataUrl = (fileName) => `${DATA_ROOT}/${fileName}`;

const fetchJson = async (fileName) => {
    const res = await fetch(dataUrl(fileName));
    if (!res.ok) throw new Error(`无法读取：${fileName}`);
    return res.json();
};

const loadData = async () => {
    const index = await fetchJson("index.json");
    const mRes = await fetch('../../data/zzz/monsters.json');
    monstersData = (await mRes.json()).monsters;
    shiyuEntries = await Promise.all(index.entries.map(f => fetchJson(f)));
};

const currentEntry = () => shiyuEntries[state.scheduleIndex];
const currentFloor = () => {
    const zone = currentEntry().zone;
    const keys = Object.keys(zone).sort();
    return zone[keys[state.floorIndex]];
};

const setSchedule = (index) => {
    const prevZone = currentEntry().zone;
    const prevMaxFloor = Object.keys(prevZone).length;
    const prevFloor = state.floorIndex;

    state.scheduleIndex = wrapIndex(index, shiyuEntries.length);
    
    const newZone = currentEntry().zone;
    const newMaxFloor = Object.keys(newZone).length;
    
    if (prevFloor >= newMaxFloor) {
        state.floorIndex = newMaxFloor - 1;
    } else {
        state.floorIndex = prevFloor;
    }
    
    render();
};

const setFloor = (index) => {
    const zone = currentEntry().zone;
    const len = Object.keys(zone).length;
    state.floorIndex = wrapIndex(index, len);
    renderFloor();
};

const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...shiyuEntries.map((e, i) => create("option", {
            text: `${e.name} | ${e.begin_time} - ${e.end_time}`,
            attrs: { value: i, selected: i === state.scheduleIndex },
        })),
    );
};

const renderScheduleHeader = () => {
    const e = currentEntry();
    byId("scheduleName").textContent = e.name;
    byId("scheduleTime").textContent = `${e.begin_time} - ${e.end_time}`;
    byId("scheduleSelect").value = String(state.scheduleIndex);
};

const renderFloorText = () => {
    const floor = currentFloor();
    byId("floorText").textContent = `节点 ${floor.stage_num}`;
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

const renderWave = (wave, index, stageLevel) => {
    return create("div", {
        className: "wave_wrap",
        children: [
            create("p", { className: "wave_name", text: text.waveNames[index] || `第${index + 1}波` }),
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
                                        children: [create("div", { className: "emote_", children: [image("../../images/ZZZ%20images/emote/3.png", "", "")] })],
                                    }),
                                    create("div", {
                                        className: "stage_waves",
                                        children: (stageData.monsters || []).map((wave, wi) => renderWave(wave, wi, stageData.level)),
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
    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    container.style.gap = "12px";
    container.style.justifyContent = "center";
    
    rooms.forEach((rk, i) => {
        const stageData = floor.layer_room[rk];
        const elements = stageData.weakness || [];
        const label = text.stageLabels[i] || `房间${i + 1}`;
        const wrapper = document.createElement("div");
        wrapper.style.flex = `1 1 ${rooms.length === 3 ? '30%' : '45%'}`;
        wrapper.style.minWidth = "300px";
        
        if (rooms.length >= 3 && buffKeys[i]) {
            const buff = floor.layer_buff[buffKeys[i]];
            if (buff && buff.title) {
                wrapper.appendChild(create("div", {
                    className: "smallbuff",
                    children: [
                        create("p", { className: "smallbuff_name", text: buff.title }),
                        create("p", { className: "smallbuff_desc", html: buff.desc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">') }),
                    ],
                }));
            }
        }
        
        wrapper.appendChild(renderStage(stageData, label, elements, i));
        container.appendChild(wrapper);
    });
};

const renderBuffs = () => {
    const floor = currentFloor();
    const buffKeys = Object.keys(floor.layer_buff).sort();
    const stages = Object.keys(floor.layer_room).sort();
    const container = byId("shiyuBuffs");
    container.replaceChildren();

    if (stages.length <= 2) {
        const buffs = buffKeys.map(k => floor.layer_buff[k]).filter(b => b.title);
        buffs.forEach((buff) => {
            container.appendChild(create("div", {
                className: "smallbuff a_b_0",
                children: [
                    create("p", { className: "smallbuff_name", text: buff.title }),
                    create("p", { className: "smallbuff_desc", html: buff.desc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">') }),
                ],
            }));
        });
    }
};

const chartEntries = () => shiyuEntries.slice().reverse();

const renderCharts = () => {
    const floor = currentFloor();
    const floorNum = floor.stage_num;
    const entries = chartEntries();

    const totalData = entries.map(e => {
        const zone = e.zone;
        const keys = Object.keys(zone).sort();
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
                const keys = Object.keys(zone).sort();
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
        xAxis: { type: "category", data: entries.map(e => e.name), axisLabel: { color: "#000", interval: 0, rotate: 30 } },
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
};

const init = async () => {
    initMenu();
    await loadData();
    bindEvents();
    state.scheduleIndex = 0;
    const zone = currentEntry().zone;
    state.floorIndex = Object.keys(zone).length - 1;
    render();
};

init().catch(console.error);