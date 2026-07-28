import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNanokaVersionState, updateNanokaBaseUrlConfig } from "../lib/nanoka-version.mjs";
import { preserveEffectIds } from "../lib/abyss-update-common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "fiction-update-config.json");

const elementNameMap = {
    Physical: "Phys",
    Thunder: "Elec",
};

function printHelp() {
    console.log(`用法：
  node update_tools/fiction/update-latest-fiction.mjs
  node update_tools/fiction/update-latest-fiction.mjs --dry-run
  node update_tools/fiction/update-latest-fiction.mjs --base https://static.nanoka.cc/hsr/4.3.54
  node update_tools/fiction/update-latest-fiction.mjs --force 2025

参数：
  --dry-run          只检测和生成内存数据，不写入文件
  --base <url>       临时指定 Nanoka 静态数据地址
  --data-dir <path>  临时指定 data/fiction 目录
  --probe-limit <n>  从当前最大期数往后最多探测多少期
  --force <ids>      重建指定期数，多个 ID 用逗号分隔
  --no-images        不下载缺失怪物图片
  --help             显示帮助`);
}

function parseArgs(argv) {
    const options = {
        dryRun: false,
        baseUrl: "",
        dataDir: "",
        probeLimit: null,
        forceIds: [],
        downloadMissingMonsterImages: null,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === "--help" || arg === "-h") {
            options.help = true;
        } else if (arg === "--dry-run") {
            options.dryRun = true;
        } else if (arg === "--no-images") {
            options.downloadMissingMonsterImages = false;
        } else if (arg === "--base") {
            options.baseUrl = argv[index + 1] ?? "";
            index += 1;
        } else if (arg.startsWith("--base=")) {
            options.baseUrl = arg.slice("--base=".length);
        } else if (arg === "--data-dir") {
            options.dataDir = argv[index + 1] ?? "";
            index += 1;
        } else if (arg.startsWith("--data-dir=")) {
            options.dataDir = arg.slice("--data-dir=".length);
        } else if (arg === "--probe-limit") {
            options.probeLimit = Number(argv[index + 1]);
            index += 1;
        } else if (arg.startsWith("--probe-limit=")) {
            options.probeLimit = Number(arg.slice("--probe-limit=".length));
        } else if (arg === "--force") {
            options.forceIds.push(...parseIdList(argv[index + 1] ?? ""));
            index += 1;
        } else if (arg.startsWith("--force=")) {
            options.forceIds.push(...parseIdList(arg.slice("--force=".length)));
        } else {
            throw new Error(`未知参数：${arg}`);
        }
    }

    return options;
}

function parseIdList(value) {
    return String(value)
        .split(",")
        .map(function (item) {
            return Number(item.trim());
        })
        .filter(function (item) {
            return Number.isInteger(item);
        });
}

function readText(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
    return JSON.parse(readText(filePath));
}

function writeJsonFile(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`, "utf8");
}

function loadConfig(cliOptions) {
    const fileConfig = fs.existsSync(configPath) ? readJson(configPath) : {};
    const dataDir = cliOptions.dataDir || fileConfig.dataDir || "../data/fiction";
    const imagesDir = fileConfig.imagesDir || "../images";
    const probeLimit = Number(cliOptions.probeLimit ?? fileConfig.probeLimit ?? 6);
    const versionProbeLimit = Number(fileConfig.versionProbeLimit ?? 8);
    const defaultDurationDays = Number(fileConfig.defaultDurationDays ?? 42);
    const downloadMissingMonsterImages =
        cliOptions.downloadMissingMonsterImages ?? fileConfig.downloadMissingMonsterImages ?? true;

    return {
        nanokaBaseUrl: stripTrailingSlash(cliOptions.baseUrl || fileConfig.nanokaBaseUrl),
        nanokaImageBaseUrl: stripTrailingSlash(fileConfig.nanokaImageBaseUrl || "https://static.nanoka.cc/assets/hsr"),
        dataDir: path.resolve(__dirname, dataDir),
        imagesDir: path.resolve(__dirname, imagesDir),
        probeLimit,
        versionProbeLimit,
        defaultDurationDays,
        downloadMissingMonsterImages,
    };
}

function stripTrailingSlash(value) {
    return String(value ?? "").replace(/\/+$/, "");
}

function parseNanokaVersionUrl(baseUrl) {
    const match = stripTrailingSlash(baseUrl).match(/^(.*\/)(\d+)\.(\d+)\.5([1-5])$/);
    if (!match) return null;

    return {
        prefix: match[1],
        major: Number(match[2]),
        minor: Number(match[3]),
        patch: Number(match[4]),
    };
}

function formatNanokaVersionUrl(version) {
    return `${version.prefix}${version.major}.${version.minor}.5${version.patch}`;
}

function nextNanokaVersion(version) {
    if (version.patch < 5) {
        return { ...version, patch: version.patch + 1 };
    }

    return {
        ...version,
        minor: version.minor + 1,
        patch: 1,
    };
}

function nanokaBaseCandidates(baseUrl, limit) {
    const parsed = parseNanokaVersionUrl(baseUrl);
    if (!parsed) return [baseUrl];

    const candidates = [];
    let current = parsed;

    for (let index = 0; index < limit; index += 1) {
        candidates.push(formatNanokaVersionUrl(current));
        current = nextNanokaVersion(current);
    }

    return candidates;
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compactObject(value) {
    return Object.fromEntries(
        Object.entries(value).filter(function ([, item]) {
            return item !== undefined && item !== null && item !== "";
        }),
    );
}

function toNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function toRatio(value) {
    return toNumber(value, 1);
}

function round(value) {
    return Math.round(value);
}

function normalizeElement(elementName) {
    return elementNameMap[elementName] ?? elementName;
}

function normalizeElements(elements = []) {
    return elements.map(normalizeElement);
}

function baseMonsterId(monsterId) {
    return Number(String(monsterId ?? "").replace(/\D/g, "").slice(0, 7));
}

function trimNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function formatFictionParam(value, isPercent) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value ?? "");

    const displayed = isPercent ? numeric * 100 : numeric;
    return `${trimNumber(displayed)}${isPercent ? "%" : ""}`;
}

function formatFictionDescription(description, params = []) {
    return String(description ?? "")
        .replace(/#(\d+)\[i\](%?)/g, function (_, index, percentSign) {
            return formatFictionParam(params[Number(index) - 1], percentSign === "%");
        })
        .replace(/<color=[^>]*>/g, "<color style='color:#f29e38;'>")
        .replace(/<\/?unbreak>/g, "")
        .replace(/\\n/g, "<br>")
        .replace(/\r?\n/g, "<br>");
}

function cleanStoryName(value) {
    return String(value ?? "")
        .replace(/<[^>]*>/g, "")
        .trim();
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function formatDate(value) {
    const text = String(value ?? "").trim();
    const textMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (textMatch) {
        return `${textMatch[1]}/${pad2(textMatch[2])}/${pad2(textMatch[3])}`;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
        const milliseconds = numeric > 10000000000 ? numeric : numeric * 1000;
        const date = new Date(milliseconds);
        return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
    }

    return text;
}

function formatTimeRange(rawStory) {
    const begin = formatDate(rawStory.begin_time);
    const end = formatDate(rawStory.end_time);
    return begin && end ? `${begin} - ${end}` : "";
}

function parseDateText(value) {
    const match = String(value ?? "").match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) return null;

    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateObject(date) {
    return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function addDays(date, days) {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
}

function nextTimeRange(previousTime, durationDays) {
    const parts = String(previousTime ?? "").split("-");
    const previousEnd = parseDateText(parts[1] ?? parts[0]);
    if (!previousEnd) return "";

    const begin = previousEnd;
    const end = addDays(begin, durationDays);
    return `${formatDateObject(begin)} - ${formatDateObject(end)}`;
}

function fallbackTimeForStory(storyId, knownEntries, durationDays) {
    const existing = knownEntries.find(function (entry) {
        return toNumber(entry.story_id) === storyId;
    });
    if (existing?.time) return existing.time;

    const previous = knownEntries
        .filter(function (entry) {
            return toNumber(entry.story_id) < storyId && entry.time;
        })
        .sort(function (left, right) {
            return toNumber(right.story_id) - toNumber(left.story_id);
        })[0];

    return nextTimeRange(previous?.time, durationDays);
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${url}`);
    }
    return response.json();
}

async function fetchOptionalJson(url) {
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${url}`);
    }
    return response.json();
}

async function fetchOptionalStory(baseUrl, storyId) {
    return fetchOptionalJson(`${baseUrl}/zh/story/${storyId}.json`);
}

async function fetchBytes(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

async function loadNanokaTables(baseUrl) {
    const urls = [
        `${baseUrl}/monstervalue.json`,
        `${baseUrl}/EliteGroup.json`,
        `${baseUrl}/HardLevelGroup.json`,
        `${baseUrl}/monster.json`,
    ];
    const [monsterValues, eliteGroups, hardLevelGroups, monsterInfos] = await Promise.all(
        urls.map(function (url) {
            return fetchJson(url);
        }),
    );

    return { monsterValues, eliteGroups, hardLevelGroups, monsterInfos };
}

function mapBy(items, keyName) {
    return new Map(
        items.map(function (item) {
            return [toNumber(item[keyName]), item];
        }),
    );
}

function hardLevelKey(groupId, level) {
    return `${toNumber(groupId)}:${toNumber(level)}`;
}

function childForMonster(monsterValue, monsterId) {
    const children = monsterValue?.child ?? [];

    return (
        children.find(function (child) {
            return toNumber(child.Id) === toNumber(monsterId);
        }) ??
        children.find(function (child) {
            return baseMonsterId(child.Id) === baseMonsterId(monsterId);
        }) ??
        children[0] ??
        null
    );
}

function phaseHpRatioSum(monsterValue) {
    const phaseList = monsterValue?.PhaseList ?? monsterValue?.phase_list ?? [];
    if (!Array.isArray(phaseList) || !phaseList.length) return 1;

    return phaseList.reduce(function (sum, phase) {
        return sum + toNumber(phase.PhaseMaxHPRatio ?? phase.phase_max_hp_ratio, 1);
    }, 0);
}

function waveHpCoefficient(waveRaw) {
    return 1 + toNumber(waveRaw?.param_list?.[1], 0);
}

function createNanokaStatResolver(tables) {
    const eliteGroupById = mapBy(tables.eliteGroups, "EliteGroup");
    const hardLevelByGroupAndLevel = new Map(
        tables.hardLevelGroups.map(function (item) {
            return [hardLevelKey(item.HardLevelGroup, item.Level), item];
        }),
    );

    return function resolveNanokaStats(rawStage, waveRaw, monsterId) {
        const monsterValue = tables.monsterValues[String(baseMonsterId(monsterId))];
        const child = childForMonster(monsterValue, monsterId);
        if (!monsterValue || !child) return null;

        const eliteGroup =
            eliteGroupById.get(toNumber(waveRaw?.elite_group, NaN)) ??
            eliteGroupById.get(toNumber(child.EliteGroup, NaN)) ??
            {};
        const hardLevel =
            hardLevelByGroupAndLevel.get(hardLevelKey(rawStage.hard_level_group ?? child.HardLevelGroup, rawStage.level)) ??
            {};
        const coefficient = waveHpCoefficient(waveRaw);
        const baseHp = round(
            toRatio(monsterValue.HPBase) *
                toRatio(child.HPModifyRatio) *
                toRatio(eliteGroup.HPRatio) *
                toRatio(hardLevel.HPRatio),
        );
        const speed =
            round(
                toRatio(monsterValue.SpeedBase) *
                    toRatio(child.SpeedModifyRatio) *
                    toRatio(eliteGroup.SpeedRatio) *
                    toRatio(hardLevel.SpeedRatio),
            ) + toNumber(child.SpeedModifyValue);
        const stanceRaw = round(
            toRatio(monsterValue.StanceBase) *
                toRatio(child.StanceModifyRatio) *
                toRatio(eliteGroup.StanceRatio) *
                toRatio(hardLevel.StanceRatio) +
                toNumber(child.StanceModifyValue ?? child.stance_modify_value),
        );
        const hpRatioSum = phaseHpRatioSum(monsterValue);

        return {
            hp: round(baseHp * coefficient),
            speed,
            stance: stanceRaw ? round(stanceRaw / 30) : 0,
            hp_ratio_sum: hpRatioSum,
        };
    };
}

function stageMonsterWaves(stage) {
    if (Array.isArray(stage.monsters)) return stage.monsters;
    if (Array.isArray(stage.waves)) {
        return stage.waves.map(function (wave) {
            return wave.monsters ?? [];
        });
    }

    return [];
}

function collectMonsterStats(entries) {
    const byId = new Map();
    const byIdAndLevel = new Map();

    function add(monster, level) {
        if (!monster || monster.id === undefined) return;

        if (!byId.has(monster.id)) byId.set(monster.id, clone(monster));
        if (level !== undefined) {
            const key = `${monster.id}:${level}`;
            if (!byIdAndLevel.has(key)) byIdAndLevel.set(key, clone(monster));
        }
    }

    entries.forEach(function (entry) {
        entry.floors.forEach(function (floor) {
            ["upper", "lower", "star"].forEach(function (side) {
                (floor[side] ?? []).forEach(function (stage) {
                    stageMonsterWaves(stage).forEach(function (wave) {
                        wave.forEach(function (monster) {
                            add(monster, floor.level);
                        });
                    });
                });
            });
        });
    });

    return { byId, byIdAndLevel };
}

function objectMonsterIds(monsterObject = {}) {
    return Object.keys(monsterObject)
        .sort(function (left, right) {
            return Number(left.replace(/\D/g, "")) - Number(right.replace(/\D/g, ""));
        })
        .map(function (key) {
            return monsterObject[key];
        });
}

function monsterCounts(rawStage, waveRaw, waveIndex) {
    const sourceIds = Array.isArray(waveRaw?.monster_group_id_list)
        ? waveRaw.monster_group_id_list
        : objectMonsterIds(rawStage.monster_list?.[waveIndex]);
    const counts = new Map();
    const order = [];

    sourceIds.forEach(function (rawId) {
        const id = toNumber(rawId, NaN);
        if (!Number.isFinite(id) || id === 8003060) return;

        if (!counts.has(id)) {
            counts.set(id, 0);
            order.push(id);
        }
        counts.set(id, counts.get(id) + 1);
    });

    return order.map(function (id) {
        return { id, number: counts.get(id) };
    });
}

function waveRawForStage(rawStage, waveMap, waveIndex) {
    const directKey = `${rawStage.stage_id}${waveIndex + 1}`;
    if (waveMap?.[directKey]) return waveMap[directKey];

    return Object.values(waveMap ?? {})
        .filter(function (item) {
            return String(item?.infinite_wave_id ?? "").startsWith(String(rawStage.stage_id));
        })
        .sort(function (left, right) {
            return toNumber(left.infinite_wave_id) - toNumber(right.infinite_wave_id);
        })[waveIndex];
}

function makeMonster(rawMonster, rawStage, waveRaw, level, monsterStats, statResolver) {
    const calculated = statResolver(rawStage, waveRaw, rawMonster.id);
    if (calculated) {
        return compactObject({
            id: rawMonster.id,
            number: rawMonster.number,
            hp: calculated.hp,
            speed: calculated.speed,
            stance: calculated.stance,
            hp_ratio_sum: calculated.hp_ratio_sum === 1 ? undefined : calculated.hp_ratio_sum,
        });
    }

    const byLevel = monsterStats.byIdAndLevel.get(`${rawMonster.id}:${level}`);
    const byId = monsterStats.byId.get(rawMonster.id);
    const source = byLevel ?? byId;

    const monster = source ? { ...clone(source), id: rawMonster.id, number: rawMonster.number } : rawMonster;
    if (monster.stance === undefined) monster.stance = 0;

    return monster;
}

function makeWave(rawStage, waveRaw, waveIndex, level, monsterStats, statResolver) {
    return monsterCounts(rawStage, waveRaw, waveIndex).map(function (rawMonster) {
        return makeMonster(rawMonster, rawStage, waveRaw, level, monsterStats, statResolver);
    });
}

function stageHpCoefficient(rawStage, waveMap) {
    const coefficientWave = waveRawForStage(rawStage, waveMap, 2);
    const coefficient = waveHpCoefficient(coefficientWave);
    return Number.isFinite(coefficient) ? coefficient : undefined;
}

function makeStage(rawStage, waveMap, floorNumber, monsterStats, statResolver) {
    const level = rawStage.level;
    const stage = {
        stage_id: rawStage.stage_id,
    };
    const coefficient = floorNumber === 4 ? stageHpCoefficient(rawStage, waveMap) : undefined;

    if (coefficient !== undefined) stage.hp_coefficient = coefficient;
    stage.monsters = (rawStage.monster_list ?? []).map(function (_, waveIndex) {
        const waveRaw = waveRawForStage(rawStage, waveMap, waveIndex);
        return makeWave(rawStage, waveRaw, waveIndex, level, monsterStats, statResolver);
    });

    return stage;
}

function makeStages(rawStages = [], waveMap = {}, floorNumber, monsterStats, statResolver) {
    return rawStages.map(function (rawStage) {
        return makeStage(rawStage, waveMap, floorNumber, monsterStats, statResolver);
    });
}

function makeFloor(rawLevel, floorNumber, monsterStats, statResolver) {
    const level = rawLevel.event_id_list1?.[0]?.level ?? rawLevel.event_id_list2?.[0]?.level;

    return {
        floor: floorNumber,
        element_upper: normalizeElements(rawLevel.damage_type1),
        element_lower: normalizeElements(rawLevel.damage_type2),
        level,
        upper: makeStages(rawLevel.event_id_list1, rawLevel.infinite_list1, floorNumber, monsterStats, statResolver),
        lower: makeStages(rawLevel.event_id_list2, rawLevel.infinite_list2, floorNumber, monsterStats, statResolver),
        star: [],
    };
}

function applyStarFloors(entry, starLevels, monsterStats, statResolver) {
    starLevels.forEach(function (rawStarLevel) {
        const floorNumber = toNumber(rawStarLevel.pre_id) % 10;
        const floor = entry.floors.find(function (item) {
            return item.floor === floorNumber;
        });
        if (!floor) return;

        floor.element_star = normalizeElements(rawStarLevel.damage_type);
        floor.star = makeStages(rawStarLevel.event_id_list, rawStarLevel.infinite_list, floor.floor, monsterStats, statResolver);
    });
}

function splitStoryLevels(rawStory) {
    const regularLevels = [];
    const starLevels = [];

    (rawStory.level ?? []).forEach(function (rawLevel) {
        if (rawLevel.pre_id === undefined) {
            regularLevels.push(rawLevel);
        } else {
            starLevels.push(rawLevel);
        }
    });

    return {
        regularLevels: regularLevels.sort(function (left, right) {
            return toNumber(left.id) - toNumber(right.id);
        }),
        starLevels,
    };
}

function makeBuffList(items = []) {
    return items
        .filter(function (item) {
            return item?.name || item?.desc;
        })
        .map(function (item) {
            const id = Number(item.id);

            return compactObject({
                id: Number.isInteger(id) && id > 0 ? id : undefined,
                name: item.name ?? "",
                description: formatFictionDescription(item.desc, item.param),
            });
        });
}

function makeFictionEntry(storyId, rawStory, monsterStats, statResolver, fallbackTime, existingEntry = null) {
    const { regularLevels, starLevels } = splitStoryLevels(rawStory);
    if (!regularLevels.length) {
        throw new Error(`story/${storyId}.json 没有普通楼层数据`);
    }

    const entry = {
        story_id: storyId,
        story_name: cleanStoryName(rawStory.name),
        blessing: preserveEffectIds(makeBuffList(rawStory.sub_option), existingEntry?.blessing),
        buffs: preserveEffectIds(makeBuffList(rawStory.option), existingEntry?.buffs),
        floors: regularLevels.map(function (rawLevel, index) {
            return makeFloor(rawLevel, index + 1, monsterStats, statResolver);
        }),
        time: formatTimeRange(rawStory) || fallbackTime,
    };

    applyStarFloors(entry, starLevels, monsterStats, statResolver);
    return entry;
}

function isValidStoryData(value) {
    return (
        value &&
        !Array.isArray(value) &&
        Array.isArray(value.level) &&
        value.level.some(function (rawLevel) {
            return Array.isArray(rawLevel.event_id_list1);
        })
    );
}

function readLocalProject(dataDir) {
    const indexPath = path.join(dataDir, "index.json");
    const index = readJson(indexPath);
    const catalogPath = path.join(dataDir, index.monster_catalog ?? "monster_catalog.json");
    const monsterCatalog = readJson(catalogPath);
    const entryFileNames = new Set(index.entries ?? []);

    fs.readdirSync(dataDir).forEach(function (fileName) {
        if (/^fiction_\d+\.json$/.test(fileName)) entryFileNames.add(fileName);
    });

    const entries = Array.from(entryFileNames)
        .sort()
        .map(function (fileName) {
            const entry = readJson(path.join(dataDir, fileName));
            return { fileName, entry };
        });

    return { index, monsterCatalog, entries };
}

function maxStoryId(entries) {
    return Math.max(
        ...entries.map(function (item) {
            return toNumber(item.entry.story_id, 0);
        }),
    );
}

async function detectNewStories(baseUrl, latestStoryId, probeLimit) {
    const detected = [];

    for (let offset = 1; offset <= probeLimit; offset += 1) {
        const storyId = latestStoryId + offset;
        console.log(`检测 ${storyId} ...`);
        const rawStory = await fetchOptionalStory(baseUrl, storyId);

        if (!isValidStoryData(rawStory)) {
            console.log(`未发现 ${storyId}，停止探测。`);
            break;
        }

        detected.push({ storyId, rawStory });
        console.log(`发现 ${storyId}。`);
    }

    return detected;
}

async function loadForcedStories(baseUrl, forceIds) {
    const detected = [];

    for (const storyId of forceIds) {
        console.log(`读取指定期数 ${storyId} ...`);
        const rawStory = await fetchOptionalStory(baseUrl, storyId);
        if (!isValidStoryData(rawStory)) {
            throw new Error(`指定期数 ${storyId} 不存在或数据格式不正确`);
        }
        detected.push({ storyId, rawStory });
    }

    return detected;
}

async function loadNextStory(baseUrl, nextStoryId) {
    const rawStory = await fetchOptionalStory(baseUrl, nextStoryId);
    if (!isValidStoryData(rawStory)) {
        throw new Error(`大版本变化，但远端没有虚构叙事 ${nextStoryId} 数据。`);
    }

    return [{ storyId: nextStoryId, rawStory }];
}

async function resolveStorySources(baseUrl, latestStoryId, versionProbeLimit) {
    const candidates = nanokaBaseCandidates(baseUrl, versionProbeLimit);
    let newestBaseUrl = candidates[0];
    let currentBaseUrl = "";
    let currentRawStory = null;

    for (const candidate of candidates) {
        console.log(`检查数据版本 ${candidate} ...`);
        const [rawCurrent, rawNext] = await Promise.all([
            fetchOptionalStory(candidate, latestStoryId),
            fetchOptionalStory(candidate, latestStoryId + 1),
        ]);
        const hasCurrent = isValidStoryData(rawCurrent);
        const hasNext = isValidStoryData(rawNext);

        if (!hasCurrent && !hasNext) continue;

        newestBaseUrl = candidate;
        if (hasCurrent) {
            currentBaseUrl = candidate;
            currentRawStory = rawCurrent;
        }
    }

    return {
        newestBaseUrl,
        currentBaseUrl: currentBaseUrl || newestBaseUrl,
        currentRawStory,
    };
}

function entryFileName(entry) {
    return `fiction_${entry.story_id}.json`;
}

function collectUsedMonsterIds(entries) {
    const ids = new Set();

    entries.forEach(function (entry) {
        entry.floors.forEach(function (floor) {
            ["upper", "lower", "star"].forEach(function (side) {
                (floor[side] ?? []).forEach(function (stage) {
                    stageMonsterWaves(stage).forEach(function (wave) {
                        wave.forEach(function (monster) {
                            ids.add(String(monster.id));
                        });
                    });
                });
            });
        });
    });

    return ids;
}

function monsterInfoForId(monsterInfos, id) {
    return monsterInfos[String(id)] ?? monsterInfos[String(baseMonsterId(id))] ?? null;
}

function monsterFigureFileName(info, id) {
    const iconPath = info?.icon ? path.posix.basename(info.icon) : `Monster_${baseMonsterId(id)}.png`;
    return iconPath.replace(/\.[^.]+$/, ".webp");
}

function localMonsterFigurePath(info, id) {
    return `monster/${monsterFigureFileName(info, id)}`;
}

function nanokaMonsterFigureUrl(imageBaseUrl, info, id) {
    return `${imageBaseUrl}/monsterfigure/${monsterFigureFileName(info, id)}`;
}

function shouldReplaceImagePath(imagePath, imagesDir, info) {
    if (!imagePath) return true;
    if (!String(imagePath).startsWith("monster/")) return true;
    if (!info?.icon) return false;

    return !fs.existsSync(path.join(imagesDir, imagePath));
}

function isBadMonsterName(value) {
    return value === undefined || value === null || value === "" || value === "...";
}

function makeMonsterCatalog(entries, existingCatalog, monsterInfos, imagesDir) {
    const usedIds = collectUsedMonsterIds(entries);
    const catalog = {};

    Array.from(usedIds)
        .sort(function (left, right) {
            return toNumber(left) - toNumber(right);
        })
        .forEach(function (id) {
            const existing = clone(existingCatalog[id] ?? {});
            const info = monsterInfoForId(monsterInfos, id);

            if (shouldReplaceImagePath(existing["1"], imagesDir, info)) existing["1"] = localMonsterFigurePath(info, id);
            if (!Array.isArray(existing["2"]) || !existing["2"].length) existing["2"] = normalizeElements(info?.weak ?? []);
            if (!existing["3"]) existing["3"] = 1;
            if (isBadMonsterName(existing["4"])) existing["4"] = info?.zh ?? String(id);

            catalog[id] = existing;
        });

    return catalog;
}

function makeIndex(entries, existingIndex) {
    return {
        monster_catalog: existingIndex.monster_catalog ?? "monster_catalog.json",
        chart_start_name: existingIndex.chart_start_name ?? "深文巧诋",
        entries: entries
            .slice()
            .sort(function (left, right) {
                return toNumber(right.story_id) - toNumber(left.story_id);
            })
            .map(entryFileName),
    };
}

function mergeEntries(localEntries, generatedEntries) {
    const byId = new Map();

    localEntries.forEach(function (item) {
        byId.set(toNumber(item.entry.story_id), clone(item.entry));
    });
    generatedEntries.forEach(function (entry) {
        byId.set(toNumber(entry.story_id), clone(entry));
    });

    return Array.from(byId.values()).sort(function (left, right) {
        return toNumber(right.story_id) - toNumber(left.story_id);
    });
}

function sortComparable(value) {
    if (Array.isArray(value)) {
        return value.map(sortComparable);
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map(function (key) {
                    return [key, sortComparable(value[key])];
                }),
        );
    }

    return value;
}

function sameEntry(left, right) {
    return JSON.stringify(sortComparable(left)) === JSON.stringify(sortComparable(right));
}

function localStoryEntry(localEntries, storyId) {
    const item = localEntries.find(function (entryItem) {
        return toNumber(entryItem.entry.story_id) === storyId;
    });

    return item?.entry ?? null;
}

function validateProject(index, entries, monsterCatalog) {
    const errors = [];
    const entryByFileName = new Map(
        entries.map(function (entry) {
            return [entryFileName(entry), entry];
        }),
    );

    index.entries.forEach(function (fileName) {
        if (!entryByFileName.has(fileName)) errors.push(`index.json 引用了不存在的数据：${fileName}`);
    });

    entries.forEach(function (entry) {
        if (!entry.story_id) errors.push("存在缺少 story_id 的虚构条目");
        if (!entry.story_name) errors.push(`fiction_${entry.story_id}.json 缺少 story_name`);
        if (!Array.isArray(entry.floors) || !entry.floors.length) errors.push(`fiction_${entry.story_id}.json 缺少 floors`);
        entry.floors.forEach(function (floor) {
            ["upper", "lower", "star"].forEach(function (side) {
                (floor[side] ?? []).forEach(function (stage) {
                    if (!stageMonsterWaves(stage).length) {
                        errors.push(`fiction_${entry.story_id}.json 第 ${floor.floor} 层 ${side} 缺少 monsters`);
                    }
                    if (floor.floor !== 4 && stage.hp_coefficient !== undefined) {
                        errors.push(`fiction_${entry.story_id}.json 第 ${floor.floor} 层 ${side} 不应写入 hp_coefficient`);
                    }
                });
            });
        });
    });

    collectUsedMonsterIds(entries).forEach(function (id) {
        const item = monsterCatalog[id];
        if (!item) errors.push(`monster_catalog.json 缺少怪物：${id}`);
        if (item && !String(item["1"] ?? "").startsWith("monster/")) errors.push(`怪物 ${id} 的图片路径不是普通立绘`);
        if (item && isBadMonsterName(item["4"])) errors.push(`怪物 ${id} 的名称无效：${item["4"]}`);
    });

    if (errors.length) {
        throw new Error(`更新结果自检失败：\n${errors.join("\n")}`);
    }
}

async function downloadMissingMonsterImages(entries, monsterInfos, imagesDir, imageBaseUrl, dryRun) {
    const ids = collectUsedMonsterIds(entries);
    const queuedPaths = new Set();
    let downloaded = 0;
    let missingSource = 0;
    let failed = 0;

    for (const id of Array.from(ids).sort(function (left, right) {
        return toNumber(left) - toNumber(right);
    })) {
        const info = monsterInfoForId(monsterInfos, id);
        if (!info?.icon) {
            missingSource += 1;
            continue;
        }

        const localRelativePath = localMonsterFigurePath(info, id);
        if (queuedPaths.has(localRelativePath)) continue;
        queuedPaths.add(localRelativePath);

        const localPath = path.join(imagesDir, localRelativePath);
        if (fs.existsSync(localPath)) continue;

        if (dryRun) {
            downloaded += 1;
            console.log(`[dry-run] 将下载怪物图片：${localRelativePath}`);
            continue;
        }

        const url = nanokaMonsterFigureUrl(imageBaseUrl, info, id);
        try {
            const bytes = await fetchBytes(url);
            fs.mkdirSync(path.dirname(localPath), { recursive: true });
            fs.writeFileSync(localPath, bytes);
            downloaded += 1;
            console.log(`已下载怪物图片：${localRelativePath}`);
        } catch (error) {
            failed += 1;
            console.warn(`怪物图片下载失败，已跳过：${localRelativePath} (${error.message})`);
        }
    }

    return { downloaded, missingSource, failed };
}

function writeProjectData(dataDir, index, monsterCatalog, generatedEntries, dryRun) {
    if (dryRun) {
        generatedEntries.forEach(function (entry) {
            console.log(`[dry-run] 将写入 ${entryFileName(entry)}`);
        });
        console.log("[dry-run] 将更新 index.json 和 monster_catalog.json");
        return;
    }

    generatedEntries.forEach(function (entry) {
        writeJsonFile(path.join(dataDir, entryFileName(entry)), entry);
    });
    writeJsonFile(path.join(dataDir, "index.json"), index);
    writeJsonFile(path.join(dataDir, index.monster_catalog), monsterCatalog);
}

async function main() {
    const cliOptions = parseArgs(process.argv.slice(2));
    if (cliOptions.help) {
        printHelp();
        return;
    }

    const config = loadConfig(cliOptions);
    if (!config.nanokaBaseUrl) {
        throw new Error("缺少 nanokaBaseUrl，请在 fiction-update-config.json 或 --base 中配置。");
    }

    console.log(`数据目录：${config.dataDir}`);
    console.log(`Nanoka：${config.nanokaBaseUrl}`);

    const localProject = readLocalProject(config.dataDir);
    const localEntries = localProject.entries;
    const localEntryValues = localEntries.map(function (item) {
        return item.entry;
    });
    const latestStoryId = maxStoryId(localEntries);

    console.log(`当前最大期数：${latestStoryId}`);

    const versionState = cliOptions.forceIds.length
        ? {
              latestBaseUrl: config.nanokaBaseUrl,
              changed: true,
              changeType: "force",
              configuredVersion: config.nanokaBaseUrl,
              latestVersion: config.nanokaBaseUrl,
          }
        : await resolveNanokaVersionState({
              baseUrl: config.nanokaBaseUrl,
              limit: config.versionProbeLimit,
              siteUrl: `https://hsr.nanoka.cc/story/${latestStoryId}`,
              hasData: async function (baseUrl) {
                  const [rawCurrent, rawNext] = await Promise.all([
                      fetchOptionalStory(baseUrl, latestStoryId),
                      fetchOptionalStory(baseUrl, latestStoryId + 1),
                  ]);

                  return isValidStoryData(rawCurrent) || isValidStoryData(rawNext);
              },
          });

    console.log(`配置版本：${versionState.configuredVersion}`);
    console.log(`远端版本：${versionState.latestVersion}`);

    if (!cliOptions.forceIds.length && !versionState.changed) {
        console.log("Nanoka 版本未变化，跳过虚构叙事更新。");
        return;
    }

    console.log(`版本变化类型：${versionState.changeType}`);

    const sources = cliOptions.forceIds.length
        ? {
              newestBaseUrl: config.nanokaBaseUrl,
              currentBaseUrl: config.nanokaBaseUrl,
              currentRawStory: null,
          }
        : {
              newestBaseUrl: versionState.latestBaseUrl,
              currentBaseUrl: versionState.latestBaseUrl,
              currentRawStory:
                  versionState.changeType === "small"
                      ? await fetchOptionalStory(versionState.latestBaseUrl, latestStoryId)
                      : null,
          };
    console.log(`使用数据版本：${sources.newestBaseUrl}`);

    const tables = await loadNanokaTables(sources.newestBaseUrl);
    const currentTables =
        sources.currentBaseUrl === sources.newestBaseUrl ? tables : await loadNanokaTables(sources.currentBaseUrl);
    const statResolver = createNanokaStatResolver(tables);
    const currentStatResolver = createNanokaStatResolver(currentTables);
    const monsterStats = collectMonsterStats(localEntryValues);
    const targets = cliOptions.forceIds.length
        ? await loadForcedStories(sources.newestBaseUrl, cliOptions.forceIds)
        : versionState.changeType === "major"
          ? await loadNextStory(sources.newestBaseUrl, latestStoryId + 1)
          : [];

    const generatedEntries = [];

    if (!cliOptions.forceIds.length && versionState.changeType === "small" && !isValidStoryData(sources.currentRawStory)) {
        throw new Error(`小版本变化，但远端没有当前虚构叙事 ${latestStoryId} 数据。`);
    }

    if (!cliOptions.forceIds.length && isValidStoryData(sources.currentRawStory)) {
        const fallbackTime = fallbackTimeForStory(latestStoryId, localEntryValues, config.defaultDurationDays);
        const localLatest = localStoryEntry(localEntries, latestStoryId);
        const refreshedLatest = makeFictionEntry(
            latestStoryId,
            sources.currentRawStory,
            monsterStats,
            currentStatResolver,
            fallbackTime,
            localLatest,
        );

        if (!sameEntry(refreshedLatest, localLatest)) {
            generatedEntries.push(refreshedLatest);
            console.log(`当前最新期 ${latestStoryId} 与远端数据不同，将先更新这一期。`);
        } else {
            console.log(`当前最新期 ${latestStoryId} 与远端数据一致。`);
        }
    }

    if (!targets.length && !generatedEntries.length) {
        updateNanokaBaseUrlConfig(configPath, versionState.latestBaseUrl, cliOptions.dryRun);
        console.log("暂无新一期虚构叙事。");
        return;
    }

    const sortedTargets = targets.slice().sort(function (left, right) {
        return toNumber(left.storyId) - toNumber(right.storyId);
    });

    sortedTargets.forEach(function (target) {
        const knownEntries = localEntryValues.concat(generatedEntries);
        const fallbackTime = fallbackTimeForStory(target.storyId, knownEntries, config.defaultDurationDays);
        const existingEntry = localStoryEntry(localEntries, target.storyId);
        generatedEntries.push(
            makeFictionEntry(target.storyId, target.rawStory, monsterStats, statResolver, fallbackTime, existingEntry),
        );
    });

    const allEntries = mergeEntries(localEntries, generatedEntries);
    const index = makeIndex(allEntries, localProject.index);
    const monsterCatalog = makeMonsterCatalog(allEntries, localProject.monsterCatalog, tables.monsterInfos, config.imagesDir);

    validateProject(index, allEntries, monsterCatalog);

    if (config.downloadMissingMonsterImages) {
        const result = await downloadMissingMonsterImages(
            allEntries,
            tables.monsterInfos,
            config.imagesDir,
            config.nanokaImageBaseUrl,
            cliOptions.dryRun,
        );
        if (result.downloaded > 0 || result.missingSource > 0 || result.failed > 0) {
            console.log(`怪物图片：新增 ${result.downloaded}，缺少来源 ${result.missingSource}，下载失败 ${result.failed}`);
        }
    }

    writeProjectData(config.dataDir, index, monsterCatalog, generatedEntries, cliOptions.dryRun);
    updateNanokaBaseUrlConfig(configPath, versionState.latestBaseUrl, cliOptions.dryRun);

    generatedEntries.forEach(function (entry) {
        console.log(`已处理：${entry.story_id} ${entry.story_name} ${entry.time}`);
    });
    console.log(cliOptions.dryRun ? "dry-run 完成，未写入文件。" : "更新完成。");
}

await main().catch(function (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
});
