import { initMenu } from "./menu.js";
import { byId, create, image, wrapIndex } from "./tools.js";

const DATA_ROOT = "../../data/arbitration";

let arbitrationEntries = [];
let arbitrationMonsterCatalog = {};
let arbitrationRewardLines = {};

const asset = (path) => `../../images/${path}`;
const text = {
    title: "异相仲裁",
    trialCycle: "骑士轮数：",
    finalCycle: "王棋轮数：",
    chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
    trialReward: "骑士奖励",
    finalReward: "王棋奖励",
    waveNames: ["第一波", "第二波", "第三波", "第四波", "第五波", "第六波"],
};

const state = {
    scheduleIndex: 0,
};

const dataUrl = (fileName) => `${DATA_ROOT}/${fileName}`;

const fetchJson = async (fileName) => {
    const response = await fetch(dataUrl(fileName));
    if (!response.ok) {
        throw new Error(`无法读取异相仲裁数据：${fileName}`);
    }
    return response.json();
};

const loadArbitrationData = async () => {
    const index = await fetchJson("index.json");
    arbitrationMonsterCatalog = await fetchJson(index.monster_catalog);
    arbitrationRewardLines = await fetchJson(index.reward_lines);
    arbitrationEntries = await Promise.all(index.entries.map((fileName) => fetchJson(fileName)));
};

const showStance = (value) => (typeof value === "string" ? value : String(value * 10));
const hasStance = (monster) => Number(monster.stance) > 0;

const currentEntry = () => arbitrationEntries[state.scheduleIndex];

const setSchedule = (index) => {
    state.scheduleIndex = wrapIndex(index, arbitrationEntries.length);
    render();
};

const renderScheduleSelect = () => {
    byId("scheduleSelect").replaceChildren(
        ...arbitrationEntries.map((entry, index) =>
            create("option", {
                text: `${entry.arbitration_name} | ${entry.time}`,
                attrs: {
                    value: index,
                    selected: index === state.scheduleIndex,
                },
            }),
        ),
    );
};

const renderScheduleHeader = () => {
    const entry = currentEntry();
    byId("scheduleName").textContent = entry.arbitration_name;
    byId("scheduleTime").textContent = entry.time;
    byId("scheduleSelect").value = String(state.scheduleIndex);
};

const renderElementIcons = (elements = [], className = "elem_") =>
    elements.map((elementName) => image(asset(`element/${elementName}.png`), className, elementName));

const renderTargets = (targetId, targets = []) => {
    byId(targetId).replaceChildren(
        ...targets.map((line) =>
            create("p", {
                style: { lineHeight: "28px" },
                children: [image(asset("others/Star.png"), "star", "星"), create("span", { html: line })],
            }),
        ),
    );
};

function rewardIconPath(icon) {
    const fileName = String(icon).replace(/^\/+/, "");
    if (fileName.startsWith("others/")) {
        return asset(`${fileName}.png`);
    }
    return asset(`item/${fileName}.webp`);
}

const renderRewards = (targetId, title, type) => {
    const rewards = arbitrationRewardLines["1"] ?? [];
    byId(targetId).replaceChildren(
        create("p", {
            className: "reward_text",
            text: title,
        }),
        ...rewards
            .filter((reward) => reward.type === type)
            .map((reward) =>
                create("div", {
                    children: [
                        create("p", {
                            className: "reward_stars",
                            text: String(reward.count),
                        }),
                        create("div", {
                            className: "reward_items",
                            children: reward.reward.map((item) =>
                                create("div", {
                                    className: "reward_block",
                                    children: [
                                        image(rewardIconPath(item.icon), "reward_img", item.icon),
                                        create("p", {
                                            className: "reward_count",
                                            text: String(item.count),
                                        }),
                                    ],
                                }),
                            ),
                        }),
                    ],
                }),
            ),
    );
};

const renderRecommend = (className, label, stage, elements = []) => {
    document.querySelector(`.${className}`).replaceChildren(
        create("div", {
            children: [
                create("p", { text: `${label} Lv${stage.level}` }),
                ...renderElementIcons(elements, "elem_"),
                create("p", {
                    text: text.chartSubtitle,
                    style: {
                        fontSize: "0.75em",
                        color: "#0066FF",
                    },
                }),
            ],
        }),
    );
};

const stageHpCoefficientText = (stage) => {
    const coefficient = Number(stage.hp_coefficient);
    if (!Number.isFinite(coefficient)) return "";
    return `<br>HP <color style="color:#cc0000">${(coefficient * 100).toFixed(0)}%</color>`;
};

function buffTitle(buff) {
    return buff.id ? `${buff.name}<br>${buff.id}` : buff.name;
}

const renderTrialBuffCard = (label, buffs = [], className = "") =>
    create("div", {
        className: `smallbuff ${className}`.trim(),
        children: [
            create("p", {
                className: "smallbuff_name",
                text: label,
            }),
            ...buffs.map((buff) =>
                create("p", {
                    className: "smallbuff_desc",
                    html: `<b>${buffTitle(buff)}</b><br>${buff.description}`,
                }),
            ),
        ],
    });

const renderSmallBuff = (buff, className = "smallbuff") =>
    create("div", {
        className,
        children: [
            create("p", {
                className: "smallbuff_name",
                html: buffTitle(buff),
            }),
            create("p", {
                className: "smallbuff_desc",
                html: buff.description ?? "",
            }),
        ],
    });

const renderTagCard = (label, tags = [], className = "smallbuff_half") =>
    create("div", {
        className,
        children: [
            create("p", {
                className: "smallbuff_name",
                text: label,
            }),
            ...tags.map((tag) =>
                create("p", {
                    className: "smallbuff_desc",
                    html: `<b>${buffTitle(tag)}</b><br>${tag.description}`,
                }),
            ),
        ],
    });

const splitList = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const monsterValueLine = (monster, info, key, color) => {
    const value = monster[key];
    if (!value) return null;

    let html = `<b><color style="color:${color};">${String(value)}</color></b>`;
    if (key === "hp" && monster.hp_ratio_sum && monster.hp_ratio_sum > 1) {
        html += `<b>×${monster.hp_ratio_sum}</b>`;
    }
    return create("span", { className: "monname", html });
};

const renderMonster = (monster, stage, letter) => {
    const info = arbitrationMonsterCatalog[monster.id] ?? {};
    const name = info.name ?? `未知怪物 ${monster.id}`;
    const icon = image(info.icon ? asset(info.icon) : "", "monicon hasimg", name);
    const nameLayer = create("div", {
        className: "monnameload hasimgname",
        children: [create("p", { text: name })],
    });

    icon.addEventListener("load", () => {
        nameLayer.style.display = "none";
    });
    icon.addEventListener("error", () => {
        icon.style.opacity = "0";
        icon.classList.remove("hasimg");
        nameLayer.classList.remove("hasimgname");
        icon.parentElement?.classList.add("monicon");
    });

    const hp = monsterValueLine(monster, info, "hp", "#cc0000");
    const spd = monsterValueLine(monster, info, "speed", "#2545ba");
    const rightChildren = [];
    if (hp) rightChildren.push(hp);
    if (hp && spd) rightChildren.push(create("br"));
    if (spd) rightChildren.push(spd);

    return create("span", {
        className: "monster_card hover-shadow",
        attrs: {
            "data-id": monster.id,
            "data-lv": stage.level,
        },
        children: [
            create("div", {
                className: "monleft",
                children: [
                    icon,
                    ...(Number(monster.number ?? 1) >= 2
                        ? [
                              create("span", {
                                  className: "monicon_num",
                                  text: String(monster.number),
                              }),
                          ]
                        : []),
                    nameLayer,
                ],
            }),
            ...(hasStance(monster)
                ? [
                      create("div", {
                          className: "monbottom",
                          children: [
                              create("span", {
                                  className: "monelem",
                                  children: renderElementIcons(info.weakness ?? [], "elem").map((node) =>
                                      create("span", { children: [node] }),
                                  ),
                              }),
                              create("span", {
                                  className: "monname",
                                  html: showStance(monster.stance),
                                  style: {
                                      marginLeft: "5px",
                                      position: "relative",
                                      bottom: "2px",
                                      fontWeight: "bold",
                                  },
                              }),
                          ],
                      }),
                  ]
                : []),
            create("div", {
                className: "monright",
                style: { marginTop: hasStance(monster) ? "" : "0px" },
                children: rightChildren,
            }),
        ],
    });
};

const renderWave = (wave, index, stage, letter) => {
    const monsters = wave.map((monster) => renderMonster(monster, stage, letter));
    const chunkSize = window.innerWidth <= 600 ? 100 : 5;
    const waveTitle =
        wave.length === 1 && arbitrationMonsterCatalog[wave[0].id]
            ? `<color style='font-weight:bold'>${arbitrationMonsterCatalog[wave[0].id].name}</color>`
            : (text.waveNames[index] ?? `第${index + 1}波`);

    return create("div", {
        className: "wave_wrap",
        children: [
            create("p", {
                className: "wave_name",
                html: waveTitle,
            }),
            ...splitList(monsters, chunkSize).map((chunk) =>
                create("div", {
                    className: "wave_monsters",
                    children: chunk,
                }),
            ),
        ],
    });
};

const renderStage = (stage, letter) =>
    create("div", {
        className: "stage",
        children: [
            create("div", {
                className: "emote_block_",
                children: [
                    create("div", {
                        className: "emote_",
                        children: [image(asset(`emote/Yunli/${1 + Math.floor(Math.random() * 3)}.png`), "", "")],
                    }),
                ],
            }),
            create("p", {
                html: `<color style="color:#2545ba">${stage.stage_id}</color>${stageHpCoefficientText(stage)}`,
                style: {
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: "0.9em",
                    marginTop: "-5px",
                    marginBottom: "15px",
                    lineHeight: "1.9",
                },
            }),
            create("div", {
                className: "stage_waves",
                children: stage.monsters.map((wave, index) => renderWave(wave, index, stage, letter)),
            }),
        ],
    });

const renderStageBlock = (letter, label, stage, elements) => {
    const wrapper = create("div", {
        className: "u_l",
        children: [
            create("div", {
                className: "u",
                children: [
                    create("div", { className: `${letter}_r u_r` }),
                    create("div", {
                        className: `${letter}_m u_m`,
                        children: [renderStage(stage, letter)],
                    }),
                ],
            }),
        ],
    });
    requestAnimationFrame(() => renderRecommend(`${letter}_r`, label, stage, elements));
    return wrapper;
};

const monsterTotalHp = (monster) =>
    Number(monster.hp ?? 0) * Number(monster.hp_ratio_sum ?? 1) * Number(monster.number ?? 1);

const stageTotalHp = (stage) =>
    Math.round(
        stage.monsters.reduce(
            (total, wave) => total + wave.reduce((waveTotal, monster) => waveTotal + monsterTotalHp(monster), 0),
            0,
        ),
    );

const trialTotalHp = (entry) => stageTotalHp(entry.monster_a) + stageTotalHp(entry.monster_b) + stageTotalHp(entry.monster_c);

const hardFinalTotalHp = (entry) => stageTotalHp(entry.monster_final_hard);

const chartEntries = () => [...arbitrationEntries].reverse();

const renderLineChart = (targetId, title, valueGetter) => {
    const chartElement = byId(targetId);
    const entries = chartEntries();
    if (!chartElement || !entries.length || !window.echarts) return;

    const existingChart = window.echarts.getInstanceByDom(chartElement);
    if (existingChart) window.echarts.dispose(existingChart);

    const chartInstance = window.echarts.init(chartElement);
    const activeIndex = entries.findIndex((entry) => entry.arbitration_id === currentEntry().arbitration_id);

    chartInstance.setOption(
        {
            title: {
                text: title,
                subtext: text.chartSubtitle,
                left: "center",
                textStyle: { color: "#000" },
                subtextStyle: { color: "#2545ba" },
                top: "8%",
            },
            tooltip: { trigger: "axis" },
            grid: {
                left: "3%",
                right: "4%",
                top: "20%",
                containLabel: true,
            },
            toolbox: {
                feature: { saveAsImage: {} },
                right: "75%",
                top: "10%",
            },
            xAxis: {
                type: "category",
                boundaryGap: true,
                data: entries.map((entry) => entry.arbitration_name),
                axisLabel: {
                    color: "#000",
                    interval: 0,
                    padding: [5, 0],
                },
            },
            yAxis: { type: "value" },
            series: [
                {
                    name: "总血量",
                    type: "line",
                    data: entries.map(valueGetter),
                    lineStyle: { color: "#cc0000" },
                    itemStyle: { color: "#cc0000" },
                },
            ],
        },
        true,
    );

    chartInstance.dispatchAction({
        type: "showTip",
        dataIndex: activeIndex >= 0 ? activeIndex : entries.length - 1,
        seriesIndex: 0,
    });
};

const renderCharts = () => {
    renderLineChart("trialChart", "异相仲裁骑士总血量演化", trialTotalHp);
    renderLineChart("hardFinalChart", "异相仲裁王棋绝境血量演化", hardFinalTotalHp);
};

const renderFinalSections = (entry) => {
    const easyTag = renderTagCard("将杀王棋", entry.debuff_final_easy, "smallbuff_half d_e_3");
    const hardTag = renderTagCard("将杀王棋•绝境", entry.debuff_final_hard, "smallbuff_half d_e_4");
    const easyStage = renderStageBlock("d", "将杀王棋", entry.monster_final_easy, entry.element_final);
    const hardStage = renderStageBlock("e", "将杀王棋•绝境", entry.monster_final_hard, entry.element_final);

    if (window.innerWidth <= 900) {
        return [
            create("div", {
                className: "a_b u_b smallbuff_wrap",
                children: [easyTag],
            }),
            create("div", {
                className: "u_l_wrapper",
                children: [easyStage],
            }),
            create("div", {
                className: "a_b u_b smallbuff_wrap",
                children: [hardTag],
            }),
            create("div", {
                className: "u_l_wrapper",
                children: [hardStage],
            }),
        ];
    }

    return [
        create("div", {
            className: "a_b u_b smallbuff_wrap",
            children: [easyTag, hardTag],
        }),
        create("div", {
            className: "u_l_wrapper",
            children: [easyStage, hardStage],
        }),
    ];
};

const rotateEmotes = () => {
    document.querySelectorAll(".emote_").forEach((node) => {
        node.replaceChildren(image(asset(`emote/Yunli/${1 + Math.floor(Math.random() * 3)}.png`), "", ""));
    });
};

const render = () => {
    const entry = currentEntry();
    renderScheduleSelect();
    renderScheduleHeader();
    byId("trialCycle").innerHTML = `${text.trialCycle}7`;
    byId("finalCycle").innerHTML = `${text.finalCycle}7 / <color style='color:#FF8877'> 3 </color>`;
    renderTargets("trialTargets", entry.target_abc);
    renderTargets("finalTargets", entry.target_final);
    renderRewards("trialRewards", text.trialReward, 2);
    renderRewards("finalRewards", text.finalReward, 3);

    byId("trialBuffs").replaceChildren(
        renderTrialBuffCard("骑士一", entry.debuff_a, "a_b_0"),
        renderTrialBuffCard("骑士二", entry.debuff_b, "a_b_1"),
        renderTrialBuffCard("骑士三", entry.debuff_c, "a_b_2"),
    );
    byId("trialStages").replaceChildren(
        renderStageBlock("a", "骑士一", entry.monster_a, entry.element_a),
        renderStageBlock("b", "骑士二", entry.monster_b, entry.element_b),
        renderStageBlock("c", "骑士三", entry.monster_c, entry.element_c),
    );

    byId("finalBuffs").replaceChildren(...entry.buff_final.map((buff) => renderSmallBuff(buff)));
    byId("finalSections").replaceChildren(...renderFinalSections(entry));
    renderCharts();
    rotateEmotes();
};

const bindEvents = () => {
    byId("prevSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex + 1));
    byId("nextSchedule").addEventListener("click", () => setSchedule(state.scheduleIndex - 1));
    byId("scheduleSelect").addEventListener("change", (event) => setSchedule(Number(event.target.value)));

    document.body.addEventListener(
        "mouseenter",
        (event) => {
            const card = event.target.closest?.(".monster_card");
            if (!card) return;
            card.querySelector(".hasimgname")?.style.setProperty("display", "");
            card.querySelector(".hasimg")?.style.setProperty("opacity", "0.2");
        },
        true,
    );

    document.body.addEventListener(
        "mouseleave",
        (event) => {
            const card = event.target.closest?.(".monster_card");
            if (!card) return;
            card.querySelector(".hasimgname")?.style.setProperty("display", "none");
            card.querySelector(".hasimg")?.style.setProperty("opacity", "1");
        },
        true,
    );

    document.body.addEventListener("click", (event) => {
        if (event.target.closest(".emote_block_")) rotateEmotes();
    });

    document.querySelector(".title").addEventListener("dblclick", () => {
        document.querySelectorAll(".under").forEach((node) => {
            node.style.display = node.style.display === "none" ? "" : "none";
        });
        document.querySelector("h3").style.display =
            document.querySelector("h3").style.display === "none" ? "" : "none";
        document.querySelector(".dl_button").style.display = "none";
        document.querySelectorAll(".buff").forEach((node) => {
            node.style.color = "white";
        });
    });
};

const init = async () => {
    initMenu();
    await loadArbitrationData();
    bindEvents();
    setSchedule(0);
};

init().catch((error) => {
    console.error(error);
});
