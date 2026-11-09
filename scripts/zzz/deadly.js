<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>危局强袭战 · 强敌登场次数</title>
    <!-- 引入 ECharts 和 html2canvas 用于原功能，此处保持不变 -->
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <style>
        /* 基础样式与原有风格保持一致 */
        * { box-sizing: border-box; }
        body {
            font-family: "Microsoft YaHei", sans-serif;
            margin: 0;
            background-color: #f5f5f5;
            color: #222;
        }
        container {
            display: block;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .content {
            position: relative;
            padding: 20px;
        }
        /* 原有怪物卡片样式 (来自原 CSS 或内联，此处补齐关键类) */
        .monster_card {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #f0f0f0;
            border-radius: 8px;
            padding: 8px;
            margin: 4px;
            width: 140px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            transition: box-shadow 0.2s;
            font-size: 13px;
        }
        .monster_card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .monleft { position: relative; width: 100%; display: flex; justify-content: center; }
        .monleft img { height: 180px; width: auto; object-fit: contain; }
        .monnameload {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.8);
            font-weight: bold;
            font-size: 14px;
            text-align: center;
            padding: 4px;
            border-radius: 6px;
            pointer-events: none;
        }
        .monnameload.hasimgname { display: flex; }
        .monnameload p { margin: 0; }
        .monright { text-align: center; margin-top: 4px; line-height: 1.5; }
        .monname_2 { font-size: 13px; }
        .elem_ { width: 24px; height: 24px; margin: 0 2px; vertical-align: middle; }
        .elem_small { width: 16px; height: 16px; vertical-align: middle; }
        .wave_monsters { display: flex; flex-wrap: wrap; justify-content: center; }
        .u_b, .shared-buff-box { background: #27363E; color: #eee; border-radius: 5px; padding: 14px; margin: 3px 0; width: 100%; }
        .u_r p { margin: 2px 0; }
        /* 新增按钮容器 */
        .action-bar {
            display: flex;
            justify-content: center;
            gap: 16px;
            margin: 20px 0;
        }
        .action-btn {
            display: inline-block;
            padding: 10px 24px;
            background: #2545ba;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.2s;
            text-decoration: none;
            text-align: center;
        }
        .action-btn:hover { background: #1a3580; }
        .action-btn.toggle-btn { background: #4CAF50; }
        .action-btn.toggle-btn:hover { background: #3d8b40; }
        /* 强敌登场次数区域 */
        #appearanceSection {
            margin-top: 30px;
            transition: all 0.3s;
        }
        .appearance-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 12px;
            justify-items: center;
            margin-top: 16px;
        }
        .appearance-card {
            background: #f0f0f0;
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            max-width: 160px;
            font-size: 13px;
        }
        .appearance-card .monleft { position: relative; width: 100%; display: flex; justify-content: center; }
        .appearance-card .monleft img { height: 140px; width: auto; object-fit: contain; }
        .appearance-card .monnameload {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,0.8);
            font-weight: bold; font-size: 13px; text-align: center;
            border-radius: 6px; pointer-events: none;
        }
        .appearance-card .stat-line {
            text-align: center;
            line-height: 1.6;
            margin-top: 4px;
            width: 100%;
        }
        .appearance-card .stat-line b { font-weight: bold; }
        .hp-range { color: #cc0000; font-weight: bold; }
        .appearance-count { color: #2545ba; font-weight: bold; }
        .section-title {
            font-size: 22px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0 10px;
            color: #222;
        }
        .section-subtitle {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        .empty-hint { text-align: center; color: #999; padding: 30px; }
        /* 响应式：小屏减少列数 */
        @media (max-width: 1100px) {
            .appearance-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 700px) {
            .appearance-grid { grid-template-columns: repeat(2, 1fr); }
        }
        /* 原工具栏绝对定位可能干扰，这里确保下载按钮显隐由原逻辑控制 */
        #downloadBtn { display: inline-block; }
    </style>
</head>
<body>
<container>
    <div class="content">
        <!-- 原有头部下拉、左右切换、标题等 (简化保留必要元素，实际使用您原有的 HTML) -->
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
            <button id="prevSchedule" class="action-btn" style="padding: 6px 12px;">←</button>
            <select id="scheduleSelect" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #ccc; font-size: 14px;"></select>
            <button id="nextSchedule" class="action-btn" style="padding: 6px 12px;">→</button>
            <span id="scheduleName" style="font-weight: bold; margin-left: 10px;"></span>
            <span id="scheduleTime" style="color: #666; margin-left: 6px;"></span>
        </div>

        <!-- 新增：居中的按钮组合 -->
        <div class="action-bar">
            <button id="downloadBtn" class="action-btn">下载图片</button>
            <button id="appearanceToggleBtn" class="action-btn toggle-btn">强敌登场次数</button>
        </div>

        <!-- 原有布局容器 -->
        <div id="deadlyLayout"></div>
        <div id="finalSection" style="display: none;"></div>

        <!-- 图表 -->
        <div id="chart" style="width:100%; height:600px; margin-top: 20px;"></div>
        <div id="bossChart" style="width:100%; height:600px; margin-top: 20px;"></div>
        <div id="finalChart" style="width:100%; height:600px; margin-top: 20px;"></div>

        <!-- 新增：强敌登场次数区域（默认隐藏） -->
        <div id="appearanceSection" style="display: none;">
            <div class="section-title">强敌登场次数</div>
            <div class="section-subtitle">首次登场血量 → 最后一次登场血量（试炼倍率 8.74，绝境倍率 15.8）</div>
            <div id="appearanceGrid" class="appearance-grid"></div>
        </div>
    </div>
</container>

<script>
    // ==================== 原有逻辑 (从 deadly.js 迁移，保留核心，适配为内联) ====================
    // 注意：原文件使用 ES module 导入，此处为了演示直接内联，并补充缺失的辅助函数。
    // 实际项目中请使用原 module 方式，将下面新增逻辑整合进去。

    // ---- 模拟原有依赖 ----
    const DATA_ROOT = "../../data/zzz/deadly";
    const IMAGE_ROOT = "../../images/ZZZ%20images/monster";
    const ELEMENT_ROOT = "../../images/ZZZ%20images/element";
    const EMOTE_ROOT = "../../images/ZZZ%20images/emote";

    // 工具函数
    const byId = (id) => document.getElementById(id);
    const create = (tag, props = {}) => {
        const el = document.createElement(tag);
        if (props.className) el.className = props.className;
        if (props.text) el.textContent = props.text;
        if (props.html) el.innerHTML = props.html;
        if (props.attrs) Object.entries(props.attrs).forEach(([k, v]) => el.setAttribute(k, v));
        if (props.style) Object.assign(el.style, props.style);
        if (props.children) props.children.filter(Boolean).forEach(child => el.appendChild(child));
        if (props.id) el.id = props.id;
        return el;
    };
    const image = (src, className, alt, opts = {}) => {
        const img = document.createElement('img');
        img.src = src;
        if (className) img.className = className;
        if (alt) img.alt = alt;
        if (opts.style) Object.assign(img.style, opts.style);
        if (opts.error === 'remove') img.addEventListener('error', () => img.remove());
        return img;
    };
    const wrapIndex = (i, len) => ((i % len) + len) % len;

    // 原有状态与数据占位
    let deadlyEntries = [];
    let monstersData = [];
    let bossHpData = [];
    let indexData = null;
    let chartInstance = null;
    let bossChartInstance = null;
    let finalChartInstance = null;
    let normalizeMode = false;

    const text = {
        title: "危局强袭战",
        chartTotalTitle: "试炼总血量演化",
        chartBossTitle: "试炼Boss血量演化",
        chartFinalTitle: "绝境总血量演化",
        chartSubtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
        stageLabels: ["试炼一", "试炼二", "试炼三"],
    };

    const state = { scheduleIndex: 0 };

    // 模拟数据加载（实际会 fetch json，此处为了演示，用假数据占位，保证功能可运行）
    // 注意：真实环境请保留原 fetchJson 和 loadData，此处仅提供结构，避免完全无法运行。
    // 为了演示，我们生成一些模拟条目，否则页面空白无法看到效果。
    // 您可以将这些模拟数据替换为真实数据加载逻辑。
    function initMockData() {
        // 模拟 indexData
        indexData = {
            entries: ["2.0.json", "2.1.json", "2.2.json", "2.3.json", "2.4.json", "2.5.json"]
        };
        // 模拟 monstersData
        monstersData = [
            { name: "怪物A", stun: 100, type: "S", weakness: ["冰"], resistance: [] },
            { name: "怪物B", stun: 80, type: "M", weakness: ["火"], resistance: ["冰"] },
            { name: "怪物C", stun: 120, type: "L", weakness: ["雷"], resistance: [] },
        ];
        bossHpData = [
            { name: "怪物A", base_hp: 1000 },
            { name: "怪物B", base_hp: 1200 },
            { name: "怪物C", base_hp: 1500 },
        ];
        // 生成6个entry，每个包含 normal_zone 和 final_zone
        deadlyEntries = indexData.entries.map((_, idx) => {
            const zone = {
                "z1": {
                    monsters: [{ name: "怪物A", hp: 1000 + idx * 100, defense: 476, hp_ratio_sum: 1, weakness: ["冰"], resistance: [] }],
                    weakness: ["冰"],
                    monster_level: 70,
                    layer_buff: { "b1": { desc: "适合冰属性代理人挑战" } }
                },
                "z2": {
                    monsters: [{ name: "怪物B", hp: 1200 + idx * 120, defense: 476, hp_ratio_sum: 1, weakness: ["火"], resistance: ["冰"] }],
                    weakness: ["火"],
                    monster_level: 70,
                    layer_buff: { "b1": { desc: "适合火属性代理人挑战" } }
                },
                "z3": {
                    monsters: [{ name: "怪物C", hp: 1500 + idx * 150, defense: 476, hp_ratio_sum: 1, weakness: ["雷"], resistance: [] }],
                    weakness: ["雷"],
                    monster_level: 70,
                    layer_buff: { "b1": { desc: "适合雷属性代理人挑战" } }
                }
            };
            const finalZone = idx >= 3 ? {
                "f1": {
                    monsters: [{ name: "怪物A", hp: 2500 + idx * 200, defense: 476, hp_ratio_sum: 1, weakness: ["冰"], resistance: [] }],
                    weakness: ["冰"],
                    monster_level: 80,
                    layer_buff: { "b1": { desc: "绝境机制" } }
                }
            } : undefined;
            return {
                deadly_name: `强敌${idx}`,
                time: `2025-0${idx+1}-01`,
                normal_zone: zone,
                final_zone: finalZone
            };
        });
    }

    // 原有辅助函数（从 deadly.js 提取必要部分）
    const isLowDef = (defense) => Math.abs(defense - 476) <= 2;
    const getAdjustedHp = (monster) => {
        if (!normalizeMode) return monster.hp || 0;
        if (isLowDef(monster.defense || 0)) return (monster.hp || 0) / 1.375;
        return monster.hp || 0;
    };
    const getAdjustedDef = (monster) => {
        if (!normalizeMode) return monster.defense || 0;
        if (isLowDef(monster.defense || 0)) return 952.8;
        return monster.defense || 0;
    };
    const getChartTitle = (baseTitle) => normalizeMode ? `${baseTitle}（低防血量归一）` : baseTitle;
    const parseVersion = (label) => { const m = label.match(/^(\d+)\.(\d+)/); return m ? parseFloat(m[1]+'.'+m[2]) : 0; };
    const getAbnormalValue = (monster) => {
        const info = monstersData.find(m => m.name === monster.name) || {};
        let abnormal = info.stun || 0;
        const label = indexData.entries[state.scheduleIndex]?.replace('.json','') || '';
        const version = parseVersion(label);
        if (version >= 2.1) abnormal = Math.round(abnormal * 1.1);
        return abnormal;
    };
    const getBaseHp = (monsterName) => {
        const entry = bossHpData.find(m => m.name === monsterName);
        return entry ? entry.base_hp : 0;
    };
    const getHpPercent = (monster, multiplier) => {
        const baseHp = getBaseHp(monster.name);
        if (!baseHp) return null;
        const rawHp = monster.hp || 0;
        const finalHp = rawHp * (monster.hp_ratio_sum ?? 1) * multiplier;
        return Math.round((finalHp / multiplier / 247.95 / baseHp) * 100);
    };
    const renderHpPercent = (hpPercent) => {
        if (hpPercent === null) return null;
        return create("p", { style: { fontWeight: "bold", fontSize: "13px", margin: "2px 0" }, children: [
            create("span", { text: "HP " }),
            create("span", { text: `${hpPercent}%`, style: { color: "#cc0000" } }),
        ]});
    };
    const renderElementIcons = (elements = [], className = "elem_") => elements.map(name => image(`${ELEMENT_ROOT}/${name}.webp`, className, name));

    const renderWeaknessBars = (monster, abnormalValue) => {
        const monsterInfo = monstersData.find(m => m.name === monster.name) || {};
        const allWeakness = [...(monster.weakness || []), ...(monsterInfo.weakness || [])];
        const allResistance = [...(monster.resistance || []), ...(monsterInfo.resistance || [])];
        const mapItems = new Map();
        const parseItem = (str, isWeak) => {
            const cleanEl = str.replace(/\*/g, "");
            const starCount = (str.match(/\*/g) || []).length;
            const halfStars = Math.ceil(starCount / 2);
            const lines = halfStars + 1;
            if (!mapItems.has(cleanEl)) mapItems.set(cleanEl, { element: cleanEl, type: isWeak ? "weak" : "resist", lines });
            else {
                const existing = mapItems.get(cleanEl);
                if (isWeak) { existing.type = "weak"; existing.lines = Math.max(existing.lines, lines); }
                else if (existing.type === "resist") existing.lines = Math.max(existing.lines, lines);
            }
        };
        allWeakness.forEach(el => parseItem(el, true));
        allResistance.forEach(el => parseItem(el, false));
        const items = Array.from(mapItems.values());
        if (items.length === 0 && !abnormalValue) return null;
        return create("div", { style: { display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "4px", minHeight: "28px" }, children: [
            ...items.map(item => {
                const barColor = item.type === "weak" ? "#4CAF50" : "#C62828";
                const bars = create("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", marginTop: "2px" }, children: Array.from({ length: item.lines }).map(() => create("span", { style: { width: "14px", height: "2px", borderRadius: "1px", backgroundColor: barColor, display: "block" } })) });
                return create("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" }, children: [
                    image(`${ELEMENT_ROOT}/${item.element}.webp`, "elem_small", item.element, { error: "remove" }),
                    bars
                ]});
            }),
            abnormalValue ? create("span", { style: { color: "#6a1b9a", fontWeight: "bold", marginLeft: "4px" }, text: String(abnormalValue) }) : null,
        ].filter(Boolean) });
    };

    const renderMonsterCard = (monster, stageLevel, multiplier = 8.74) => {
        const info = monstersData.find(m => m.name === monster.name) || {};
        const type = info.type || "S";
        const imagePath = `${IMAGE_ROOT}/${type}/${monster.name}.webp`;
        const hp = Math.round(getAdjustedHp(monster) * (monster.hp_ratio_sum ?? 1) * multiplier);
        const def = Math.round(getAdjustedDef(monster));
        const stun = Math.round(monster.stun || 0);
        const img = image(imagePath, "monicon hasimg", monster.name);
        img.style.height = "180px";
        img.style.width = "auto";
        const nameLayer = create("div", { className: "monnameload hasimgname", children: [create("p", { text: monster.name })] });
        img.addEventListener("load", () => { nameLayer.style.display = "none"; });
        img.addEventListener("error", () => { img.style.opacity = "0"; img.classList.remove("hasimg"); nameLayer.classList.remove("hasimgname"); img.parentElement.classList.add("monicon"); });
        return create("span", { className: "monster_card hover-shadow", attrs: { "data-lv": stageLevel }, children: [
            create("div", { className: "monleft", children: [img, nameLayer] }),
            renderWeaknessBars(monster, getAbnormalValue(monster)),
            create("div", { className: "monright", style: { textAlign: "center", marginTop: "4px" }, children: [
                create("span", { className: "monname_2", html: `<b><color style="color:#000000;">${stun}</color></b>` }),
                create("br"),
                create("span", { className: "monname_2", html: `<b><color style="color:#cc0000;">${hp}</color></b>` }),
                create("br"),
                create("span", { className: "monname_2", html: `<b><color style="color:#2545ba;">${def}</color></b>` }),
            ]}),
        ]});
    };

    function processBossDesc(zoneData) {
        const allLines = [];
        if (zoneData.layer_buff) {
            Object.values(zoneData.layer_buff).forEach(buff => {
                if (buff && buff.desc && buff.desc.trim()) {
                    buff.desc.split('\n').filter(l => l.trim()).forEach(l => allLines.push(l));
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
        if (zoneData.monsters?.length > 0) monster = zoneData.monsters[0];
        if (!monster && zoneData.layer_room) {
            const roomKeys = Object.keys(zoneData.layer_room);
            if (roomKeys.length > 0) {
                const room = zoneData.layer_room[roomKeys[0]];
                if (room?.monsters?.length > 0) monster = room.monsters[0][0];
            }
        }
        if (!monster && zoneData.monster_list) {
            const keys = Object.keys(zoneData.monster_list);
            if (keys.length > 0) {
                const raw = zoneData.monster_list[keys[0]];
                if (raw?.stats) monster = { name: raw.name, hp: raw.stats.hp, defense: raw.stats.defence, stun: raw.stats.stun, hp_ratio_sum: 1, weakness: zoneData.weakness || [], resistance: [] };
            }
        }
        if (!monster) {
            const section = create("div", { className: letter, style: { display: "flex", flexDirection: "column", width: "100%" } });
            const recommend = create("div", { className: `${letter}_r` });
            recommend.appendChild(create("div", { children: [
                create("p", { text: `${label} Lv${zoneData.monster_level || 70}` }),
                ...renderElementIcons(elements, "elem_"),
                create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF", fontWeight: "normal" } }),
            ]}));
            section.appendChild(recommend);
            const lineup = create("div", { className: `${letter}_m` });
            lineup.appendChild(create("p", { text: "无怪物数据", style: { textAlign: "center", padding: "20px", color: "#999" } }));
            section.appendChild(lineup);
            const trait = create("div", { className: `${letter}_b u_b`, style: { backgroundColor: "#27363E", color: "#eee", borderRadius: "5px", margin: "3px 0", padding: "14px", width: "100%", boxSizing: "border-box", textAlign: "left" }, children: [create("p", { text: "无机制说明", style: { lineHeight: "1.8", margin: "4px 0", fontSize: "14px" } })] });
            section.appendChild(trait);
            return section;
        }
        const hpPercent = getHpPercent(monster, 8.74);
        const section = create("div", { className: letter, style: { display: "flex", flexDirection: "column", width: "100%" } });
        const recommend = create("div", { className: `${letter}_r` });
        const lineup = create("div", { className: `${letter}_m` });
        recommend.appendChild(create("div", { children: [
            create("p", { text: monster.name }),
            ...renderElementIcons(elements, "elem_"),
            create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF", fontWeight: "normal" } }),
            renderHpPercent(hpPercent),
        ].filter(Boolean) }));
        if (!monster.weakness) monster.weakness = zoneData.weakness || [];
        if (!monster.resistance) monster.resistance = [];
        lineup.appendChild(create("div", { className: "wave_monsters", children: [renderMonsterCard(monster, zoneData.monster_level || 70, 8.74)] }));
        section.appendChild(recommend);
        section.appendChild(lineup);
        const combinedDesc = processBossDesc(zoneData);
        const html = combinedDesc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">').replace(/\n/g, '<br>').replace(/^· /gm, '<br>· ').replace(/^<br>/, '');
        const trait = create("div", { className: `${letter}_b u_b`, style: { backgroundColor: "#27363E", color: "#eee", borderRadius: "5px", margin: "3px 0", padding: "14px", width: "100%", boxSizing: "border-box", textAlign: "left" }, children: [create("p", { html: html || "无机制说明", style: { lineHeight: "1.8", margin: "4px 0", fontSize: "14px" } })] });
        section.appendChild(trait);
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
        const bossRow = create("div", { className: "u_l", style: { display: "flex", justifyContent: "center", gap: "24px", position: "relative", width: "100%", padding: "0 40px", boxSizing: "border-box", flexWrap: "nowrap" } });
        zoneKeys.forEach((zk, i) => {
            const zoneData = zone[zk];
            const elements = zoneData.weakness || [];
            if (zoneData.layer_room) {
                const roomValues = Object.values(zoneData.layer_room);
                if (roomValues.length > 0 && roomValues[0].weakness) elements.push(...roomValues[0].weakness);
            }
            const label = text.stageLabels[i] || `第${i+1}间`;
            const wrapper = create("div", { style: { flex: "0 0 auto", width: "calc(33.33% - 16px)", minWidth: "280px", maxWidth: "420px", display: "flex", flexDirection: "column" } });
            const section = renderBossSection(zoneData, bossColors[i], label, elements);
            sections.push({ section, wrapper, index: i });
            wrapper.appendChild(section);
            bossRow.appendChild(wrapper);
            if (zoneData.selectable_buff) {
                Object.values(zoneData.selectable_buff).forEach(b => {
                    if (!allSharedBuffs.find(x => x.desc === b.desc && x.title === b.title)) allSharedBuffs.push(b);
                });
            }
        });
        container.appendChild(bossRow);
        setTimeout(() => {
            const traitBoxes = sections.map(s => s.section.querySelector(`.u_b`)).filter(Boolean);
            if (traitBoxes.length > 0) {
                const maxH = Math.max(...traitBoxes.map(b => b.offsetHeight || 0));
                traitBoxes.forEach(b => b.style.minHeight = maxH + "px");
            }
        }, 100);
        if (allSharedBuffs.length > 0) {
            const sharedBuffBox = create("div", { className: "shared-buff-box", style: { backgroundColor: "#27363E", color: "#eeeeee", borderRadius: "5px", margin: "16px 0 10px 0", padding: "20px", lineHeight: "1.8", display: "block", boxSizing: "border-box" }, children: allSharedBuffs.map(buff => {
                const descHtml = buff.desc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.replace(/^· /, '·&nbsp;')).join('<br>');
                return create("p", { html: `<b>${buff.title}</b><br><span style="font-size:14px;">${descHtml}</span>`, style: { margin: "0 0 15px 0", textAlign: "left", display: "block" } });
            })});
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
    };

    const renderFinalSection = () => {
        const entry = currentEntry();
        const finalZone = entry.final_zone;
        const container = document.getElementById("finalSection");
        if (!container) return;
        if (!finalZone || Object.keys(finalZone).length === 0) { container.style.display = "none"; return; }
        container.style.display = "";
        container.replaceChildren();
        const finalKeys = Object.keys(finalZone).sort();
        finalKeys.forEach(fk => {
            const zoneData = finalZone[fk];
            const monster = zoneData.monsters?.[0];
            if (!monster) return;
            const hpPercent = getHpPercent(monster, 15.8);
            const leftCol = create("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", marginTop: "40px" } });
            const recommend = create("div", { className: "u_r" });
            recommend.appendChild(create("div", { children: [create("p", { text: monster.name }), ...renderElementIcons(zoneData.weakness || [], "elem_"), create("p", { text: text.chartSubtitle, style: { fontSize: "0.75em", color: "#0066FF", fontWeight: "normal" } }), renderHpPercent(hpPercent)].filter(Boolean) }));
            leftCol.appendChild(recommend);
            const lineup = create("div", { className: "u_m" });
            lineup.appendChild(create("div", { className: "wave_monsters", children: [renderMonsterCard(monster, zoneData.monster_level || 70, 15.8)] }));
            leftCol.appendChild(lineup);
            const combinedDesc = processBossDesc(zoneData);
            const html = combinedDesc.replace(/<color=([^>]+)>/g, '<color style="color:$1;">').replace(/\n/g, '<br>').replace(/^· /gm, '<br>· ').replace(/^<br>/, '');
            const rightCol = create("div", { className: "u_b", style: { flex: "0 0 auto", width: "480px", backgroundColor: "#27363E", color: "#eee", borderRadius: "5px", padding: "14px", lineHeight: "1.8", fontSize: "14px", textAlign: "left" }, children: [create("p", { html: html || "无机制说明", style: { margin: "4px 0" } })] });
            const row = create("div", { style: { display: "flex", gap: "20px", alignItems: "flex-start", justifyContent: "center", width: "100%" }, children: [leftCol, rightCol] });
            container.appendChild(row);
            setTimeout(() => {
                const subtitleEl = leftCol.querySelector('.u_r p:nth-child(3)');
                if (subtitleEl) {
                    const recommendRect = recommend.getBoundingClientRect();
                    const subtitleRect = subtitleEl.getBoundingClientRect();
                    const offsetToSubtitle = subtitleRect.bottom - recommendRect.top;
                    rightCol.style.marginTop = offsetToSubtitle + "px";
                }
            }, 100);
        });
    };

    const getMonsterListFromZoneData = (zd) => {
        let monsters = [];
        if (zd.monsters?.length > 0) monsters = zd.monsters;
        else if (zd.layer_room) {
            for (const rk of Object.keys(zd.layer_room)) {
                const room = zd.layer_room[rk];
                if (room?.monsters) room.monsters.forEach(w => w.forEach(m => monsters.push(m)));
            }
        } else if (zd.monster_list) {
            monsters = Object.values(zd.monster_list).map(m => ({ hp: m.stats?.hp || 0, defense: m.stats?.defence || 0, hp_ratio_sum: 1 }));
        }
        return monsters;
    };

    const renderCharts = () => {
        const entries = deadlyEntries.slice().reverse();
        const labels = entries.map(e => indexData.entries[deadlyEntries.indexOf(e)].replace('.json', ''));
        const totalData = entries.map(e => {
            const zone = e.normal_zone || e.zone || {};
            let total = 0;
            for (const zk of Object.keys(zone)) {
                getMonsterListFromZoneData(zone[zk]).forEach(m => { total += getAdjustedHp(m) * (m.hp_ratio_sum || 1); });
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
                    getMonsterListFromZoneData(zone[zoneKeys[i]]).forEach(m => { bossHP += getAdjustedHp(m) * (m.hp_ratio_sum || 1); });
                }
                bossData[i].push(Math.round(bossHP * 8.74));
            }
        });
        renderLineChart("chart", getChartTitle(text.chartTotalTitle), [{ name: "总血量", color: "#cc0000", data: totalData }], labels);
        renderLineChart("bossChart", getChartTitle(text.chartBossTitle), [
            { name: text.stageLabels[0], color: "#cc0000", data: bossData[0] },
            { name: text.stageLabels[1], color: "#2545ba", data: bossData[1] },
            { name: text.stageLabels[2], color: "#4CAF50", data: bossData[2] },
        ], labels);
        const finalEntries = entries.filter(e => e.final_zone && Object.keys(e.final_zone).length > 0);
        if (finalEntries.length > 0) {
            const finalLabels = finalEntries.map(e => indexData.entries[deadlyEntries.indexOf(e)].replace('.json', ''));
            const finalData = finalEntries.map(e => {
                const fz = e.final_zone;
                let total = 0;
                for (const fk of Object.keys(fz)) {
                    const zd = fz[fk];
                    if (zd.monsters) zd.monsters.forEach(m => { total += getAdjustedHp(m) * (m.hp_ratio_sum || 1); });
                }
                return Math.round(total * 15.8);
            });
            renderLineChart("finalChart", getChartTitle(text.chartFinalTitle), [{ name: "绝境总血量", color: "#cc0000", data: finalData }], finalLabels);
        }
    };

    const renderLineChart = (targetId, title, seriesData, labels) => {
        const chartElement = byId(targetId);
        if (!chartElement || !seriesData.length || !window.echarts) return;
        chartElement.style.width = "100%";
        chartElement.style.height = "600px";
        let currentInstance;
        if (targetId === "chart") currentInstance = chartInstance;
        else if (targetId === "bossChart") currentInstance = bossChartInstance;
        else currentInstance = finalChartInstance;
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
        if (targetId === "chart") chartInstance = newInstance;
        else if (targetId === "bossChart") bossChartInstance = newInstance;
        else finalChartInstance = newInstance;
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

    const currentEntry = () => deadlyEntries[state.scheduleIndex];

    const setSchedule = (index) => {
        state.scheduleIndex = wrapIndex(index, deadlyEntries.length);
        render();
    };

    const renderScheduleSelect = () => {
        byId("scheduleSelect").replaceChildren(
            ...deadlyEntries.map((e, i) => create("option", { text: `${indexData.entries[i].replace('.json', '')} | ${e.deadly_name || ''}`, attrs: { value: i, selected: i === state.scheduleIndex } }))
        );
    };
    const renderScheduleHeader = () => {
        const e = currentEntry();
        byId("scheduleName").textContent = indexData.entries[state.scheduleIndex].replace('.json', '');
        byId("scheduleTime").textContent = e.time || "";
        byId("scheduleSelect").value = String(state.scheduleIndex);
    };
    const renderNormalizeToggle = () => {
        let toggleEl = document.getElementById("normalizeToggle");
        if (!toggleEl) {
            toggleEl = create("div", { id: "normalizeToggle", style: { position: "absolute", top: "10px", right: "20px", display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#000", cursor: "pointer", userSelect: "none" }, children: [
                create("span", { text: "低防血量归一", style: { fontWeight: "normal" } }),
                create("input", { attrs: { type: "checkbox", checked: normalizeMode }, style: { cursor: "pointer", width: "20px", height: "20px" } }),
            ] });
            toggleEl.querySelector("input").addEventListener("change", (e) => { normalizeMode = e.target.checked; render(); });
            const contentEl = document.querySelector(".content");
            if (contentEl) { contentEl.style.position = "relative"; contentEl.appendChild(toggleEl); }
        } else toggleEl.querySelector("input").checked = normalizeMode;
    };

    const render = () => {
        renderScheduleSelect();
        renderScheduleHeader();
        renderNormalizeToggle();
        renderAllBosses();
        renderFinalSection();
        renderCharts();
        // 如果强敌登场次数区域是显示的，需要重新渲染（因为切换日程时需要更新）
        if (byId("appearanceSection").style.display !== "none") {
            renderAppearanceSection();
        }
    };

    // ==================== 新增功能：强敌登场次数 ====================
    let appearanceVisible = false;

    // 从所有entries中收集怪物登场记录
    function collectMonsterAppearances() {
        // 结构: Map<monsterName, Array<{ entryIndex, type: 'normal'|'final', hp, ratio, multiplier, count }>>
        // 需要区分试炼和绝境，同时要考虑到同一怪物可能在不同期以不同血量出现。
        // 这里我们按怪物名分别统计试炼和绝境。由于卡片要求显示“首次登场血量 → 最后一次登场血量”，
        // 需按时间顺序排序。且显示“登场 x 次”。
        // 注意：怪物可能出现在不同zone中，但同一期同一怪物可能出现多次？按每期该怪物所有出现次数合并血量？但通常一期一只。
        // 简单处理：每期每只怪物（按名字）如果出现在试炼（normal_zone）或绝境（final_zone），记录其总血量（可能是多只？但一般一只）。
        // 血量计算: 使用 getAdjustedHp 并乘以 multiplier 和 hp_ratio_sum，得到最终血量。
        // 还需要记录该怪物该期属于试炼还是绝境，以便区分显示。我们分开处理更清晰：分别构建试炼和绝境的Map。
        const normalMap = new Map(); // name -> [{ dateIndex, hp, count }]
        const finalMap = new Map();

        // 按时间顺序（索引从小到大）遍历，确保首次/最后正确
        for (let idx = 0; idx < deadlyEntries.length; idx++) {
            const entry = deadlyEntries[idx];
            const dateLabel = indexData.entries[idx]?.replace('.json','') || `第${idx}期`;

            // 处理试炼
            const normalZone = entry.normal_zone || entry.zone || {};
            for (const zk of Object.keys(normalZone)) {
                const zd = normalZone[zk];
                // 获取该区域所有怪物（可能多个波次）
                let monsters = [];
                if (zd.monsters?.length > 0) {
                    monsters = zd.monsters;
                } else if (zd.layer_room) {
                    for (const rk of Object.keys(zd.layer_room)) {
                        const room = zd.layer_room[rk];
                        if (room?.monsters) room.monsters.forEach(w => w.forEach(m => monsters.push(m)));
                    }
                } else if (zd.monster_list) {
                    monsters = Object.values(zd.monster_list).map(m => ({
                        name: m.name,
                        hp: m.stats?.hp || 0,
                        defense: m.stats?.defence || 0,
                        stun: m.stats?.stun || 0,
                        hp_ratio_sum: 1,
                        weakness: [],
                        resistance: []
                    }));
                }
                monsters.forEach(m => {
                    if (!m.name) return;
                    const multiplier = 8.74;
                    const rawHp = getAdjustedHp(m);
                    const totalHp = Math.round(rawHp * (m.hp_ratio_sum ?? 1) * multiplier);
                    if (!normalMap.has(m.name)) normalMap.set(m.name, []);
                    const arr = normalMap.get(m.name);
                    // 检查该期是否已经记录过同名（同一期可能有多只？简单合并为一条，但血量累加？按需求应该是每只怪物分别显示，但通常一期只有一只。我们累加血量并增加次数）
                    const existing = arr.find(r => r.entryIndex === idx);
                    if (existing) {
                        existing.hp += totalHp;
                        existing.count += 1;
                    } else {
                        arr.push({ entryIndex: idx, dateLabel, hp: totalHp, count: 1 });
                    }
                });
            }

            // 处理绝境
            const finalZone = entry.final_zone;
            if (finalZone) {
                for (const fk of Object.keys(finalZone)) {
                    const zd = finalZone[fk];
                    let monsters = [];
                    if (zd.monsters?.length > 0) {
                        monsters = zd.monsters;
                    } else if (zd.layer_room) {
                        for (const rk of Object.keys(zd.layer_room)) {
                            const room = zd.layer_room[rk];
                            if (room?.monsters) room.monsters.forEach(w => w.forEach(m => monsters.push(m)));
                        }
                    } else if (zd.monster_list) {
                        monsters = Object.values(zd.monster_list).map(m => ({
                            name: m.name,
                            hp: m.stats?.hp || 0,
                            defense: m.stats?.defence || 0,
                            stun: m.stats?.stun || 0,
                            hp_ratio_sum: 1,
                            weakness: [],
                            resistance: []
                        }));
                    }
                    monsters.forEach(m => {
                        if (!m.name) return;
                        const multiplier = 15.8;
                        const rawHp = getAdjustedHp(m);
                        const totalHp = Math.round(rawHp * (m.hp_ratio_sum ?? 1) * multiplier);
                        if (!finalMap.has(m.name)) finalMap.set(m.name, []);
                        const arr = finalMap.get(m.name);
                        const existing = arr.find(r => r.entryIndex === idx);
                        if (existing) {
                            existing.hp += totalHp;
                            existing.count += 1;
                        } else {
                            arr.push({ entryIndex: idx, dateLabel, hp: totalHp, count: 1 });
                        }
                    });
                }
            }
        }

        // 对每个怪物的记录按时间排序
        const sortRecords = (records) => records.sort((a, b) => a.entryIndex - b.entryIndex);
        normalMap.forEach(sortRecords);
        finalMap.forEach(sortRecords);

        return { normalMap, finalMap };
    }

    // 获取怪物信息（用于卡片显示）
    function getMonsterInfo(name) {
        return monstersData.find(m => m.name === name) || { type: "S", weakness: [], resistance: [], stun: 0 };
    }

    // 渲染单张强敌卡片（修改版，血量显示范围，防御位置显示次数）
    function renderAppearanceCard(monsterName, records, mode) {
        // mode: 'normal' 或 'final'
        const info = getMonsterInfo(monsterName);
        const type = info.type || "S";
        const imagePath = `${IMAGE_ROOT}/${type}/${monsterName}.webp`;
        // 计算首次和最后血量（按records时间顺序）
        const firstHp = records[0]?.hp ?? 0;
        const lastHp = records[records.length - 1]?.hp ?? 0;
        const totalCount = records.reduce((sum, r) => sum + r.count, 0); // 总登场次数

        // 构建卡片
        const img = image(imagePath, "monicon hasimg", monsterName);
        img.style.height = "140px";
        img.style.width = "auto";
        const nameLayer = create("div", { className: "monnameload hasimgname", children: [create("p", { text: monsterName })] });
        img.addEventListener("load", () => { nameLayer.style.display = "none"; });
        img.addEventListener("error", () => { img.style.opacity = "0"; img.classList.remove("hasimg"); nameLayer.classList.remove("hasimgname"); });

        // 弱点/抗性条（绝境不显示）
        let weaknessBars = null;
        if (mode === 'normal') {
            // 对于试炼，使用基础数据库的弱点和抗性，但不需要显示异常值？为简化，不显示异常值或取平均值。
            // 这里构建一个伪怪物对象，使用 info 中的弱点和抗性
            const pseudoMonster = {
                name: monsterName,
                weakness: info.weakness || [],
                resistance: info.resistance || [],
            };
            weaknessBars = renderWeaknessBars(pseudoMonster, 0); // 不显示异常值
        }

        // 血量显示：首次登场血量 → 最后一次登场血量
        const hpText = `${firstHp} → ${lastHp}`;

        return create("div", { className: "appearance-card" }, [
            create("div", { className: "monleft", children: [img, nameLayer] }),
            weaknessBars,
            create("div", { className: "stat-line" }, [
                create("div", { style: { marginTop: "4px" }, children: [
                    create("span", { text: "HP: " }),
                    create("span", { className: "hp-range", text: hpText }),
                ]}),
                create("div", { style: { marginTop: "2px" }, children: [
                    create("span", { text: "登场 " }),
                    create("span", { className: "appearance-count", text: `${totalCount} 次` }),
                ]}),
            ])
        ]);
    }

    // 渲染“强敌登场次数”区域
    function renderAppearanceSection() {
        const grid = byId("appearanceGrid");
        grid.innerHTML = "";
        const { normalMap, finalMap } = collectMonsterAppearances();

        // 先渲染试炼的怪物
        const normalMonsters = Array.from(normalMap.keys()).sort();
        const finalMonsters = Array.from(finalMap.keys()).sort();

        // 对于绝境特殊：不显示弱点/抗性，我们用mode='final'控制

        // 合并所有怪物名，但可能同时出现在试炼和绝境，我们分开显示两张卡片？需求是“每行放6个和正常危局相同的怪物卡”，但可能同一个怪物出现在试炼和绝境，我们按试炼优先，但绝境单独显示？最好分开标识。
        // 为了清晰，我们先显示试炼的，再显示绝境的，但如果同一怪物两者都有，则显示两张卡片（样式不同），或者分开标题？这里我们简单合并显示，用标题区分。
        // 但用户可能期望看到所有怪物，不区分模式？我们分开渲染，并在卡片上加个小标签？
        // 更合理：所有怪物（去重）展示，但血量需要区分模式，我们分别计算试炼和绝境，如果同时存在，我们显示试炼的血量（或绝境？），但需求说“绝境比较特殊：不显示怪物弱点/抗性”，暗示绝境卡片和试炼不同。因此我们分别渲染试炼和绝境两组。
        // 这里我们采用：先渲染试炼组，再渲染绝境组，每组前加一个子标题。
        // 但需求只要求“每行放6个和正常危局相同的怪物卡”，未明确分组。为了清晰，我们加两个子标题。
        // 如果只有一组有数据，则只显示一组。

        const normalGrid = document.createElement('div');
        normalGrid.className = 'appearance-grid';
        normalMonsters.forEach(name => {
            const records = normalMap.get(name);
            normalGrid.appendChild(renderAppearanceCard(name, records, 'normal'));
        });

        const finalGrid = document.createElement('div');
        finalGrid.className = 'appearance-grid';
        finalMonsters.forEach(name => {
            const records = finalMap.get(name);
            finalGrid.appendChild(renderAppearanceCard(name, records, 'final'));
        });

        // 清空并填充
        grid.innerHTML = '';
        if (normalMonsters.length > 0) {
            const normalTitle = create('div', { className: 'section-subtitle', text: '试炼强敌', style: { marginTop: '16px', fontWeight: 'bold' } });
            grid.appendChild(normalTitle);
            grid.appendChild(normalGrid);
        }
        if (finalMonsters.length > 0) {
            const finalTitle = create('div', { className: 'section-subtitle', text: '绝境强敌', style: { marginTop: '16px', fontWeight: 'bold' } });
            grid.appendChild(finalTitle);
            grid.appendChild(finalGrid);
        }
        if (normalMonsters.length === 0 && finalMonsters.length === 0) {
            grid.appendChild(create('div', { className: 'empty-hint', text: '暂无强敌登场记录' }));
        }
    }

    // 切换显示
    function toggleAppearanceSection() {
        const section = byId("appearanceSection");
        appearanceVisible = !appearanceVisible;
        if (appearanceVisible) {
            section.style.display = "";
            renderAppearanceSection();
        } else {
            section.style.display = "none";
        }
        // 调整按钮文字
        const btn = byId("appearanceToggleBtn");
        btn.textContent = appearanceVisible ? "收起强敌登场次数" : "强敌登场次数";
    }

    // ==================== 初始化与事件绑定 ====================
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
                if (finalChartInstance && !finalChartInstance.isDisposed()) finalChartInstance.resize();
                requestAnimationFrame(() => {
                    html2canvas(content, { scale: 2, backgroundColor: "#ffffff", useCORS: true }).then(canvas => {
                        const a = document.createElement("a");
                        a.download = `危局强袭战_${currentEntry().deadly_name || ''}.png`;
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
        // 新增按钮事件
        byId("appearanceToggleBtn").addEventListener("click", toggleAppearanceSection);

        document.body.addEventListener("mouseenter", (event) => {
            const card = event.target.closest(".monster_card, .appearance-card");
            if (!card) return;
            card.querySelectorAll(".hasimgname").forEach(node => node.style.display = "");
            card.querySelectorAll(".hasimg").forEach(node => node.style.opacity = "0.2");
        }, true);
        document.body.addEventListener("mouseleave", (event) => {
            const card = event.target.closest(".monster_card, .appearance-card");
            if (!card) return;
            card.querySelectorAll(".hasimgname").forEach(node => node.style.display = "none");
            card.querySelectorAll(".hasimg").forEach(node => node.style.opacity = "1");
        }, true);
    };

    const init = async () => {
        // 实际应使用 fetch 加载数据，这里用模拟数据保证演示
        initMockData();
        // 如果真实环境，替换为：
        // indexData = await fetchJson("index.json");
        // ... 等
        bindEvents();
        state.scheduleIndex = 0;
        render();
        // 默认隐藏强敌登场次数区域
        byId("appearanceSection").style.display = "none";
    };

    init().catch(console.error);
</script>
</body>
</html>