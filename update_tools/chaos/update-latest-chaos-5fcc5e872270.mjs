import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNanokaVersionState, updateNanokaBaseUrlConfig } from "../lib/nanoka-version.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const configPath = path.join(__dirname, "chaos-update-config.json");

const elementNameMap = {
    Physical: "Phys",
    Thunder: "Elec",
};

function printHelp() {
    console.log(`用法：
  node update_tools/chaos/update-latest-chaos.mjs
  node update_tools/chaos/update-latest-chaos.mjs --dry-run
  node update_tools/chaos/update-latest-chaos.mjs --base https://static.nanoka.cc/hsr/4.3.54
  node update_tools/chaos/update-latest-chaos.mjs --force 1033

参数：
  --dry-run          只检测和生成内存数据，不写入文件
  --base <url>       临时指定 Nanoka 静态数据地址
  --data-dir <path>  临时指定 data/chaos 目录
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
    const dataDir = cliOptions.dataDir || fileConfig.dataDir || "../data/chaos";
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

function cleanChaosName(value) {
    return String(value)
        .replace(/<[^>]*>/g, "")
        .replace(/[（(]\s*\d+(?:\.\d+)*\s*[）)]$/g, "")
        .trim();
}

function trimNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function formatMazeParam(value, isPercent) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value ?? "");

    const displayed = isPercent ? numeric * 100 : numeric;
    return `${trimNumber(displayed)}${isPercent ? "%" : ""}`;
}

function formatMazeDescription(description, params = []) {
    return String(description)
        .replace(/#(\d+)\[i\](%?)/g, function (_, index, percentSign) {
            return formatMazeParam(params[Number(index) - 1], percentSign === "%");
        })
        .replace(/<color=[^>]*>/g, "<color style='color:#f29e38;'>")
        .replace(/<\/?unbreak>/g, "")
        .replace(/\\n/g, "<br>")
        .replace(/\r?\n/g, "<br>");
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

function formatTimeRange(rawFloor) {
    const begin = formatDate(rawFloor.begin_time);
    const end = formatDate(rawFloor.end_time);
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

function fallbackTimeForChaos(chaosId, knownEntries, durationDays) {
    const existing = knownEntries.find(function (entry) {
        return toNumber(entry.chaos_id) === chaosId;
    });
    if (existing?.time) return existing.time;

    const previous = knownEntries
        .filter(function (entry) {
            return toNumber(entry.chaos_id) < chaosId && entry.time;
        })
        .sort(function (left, right) {
            return toNumber(right.chaos_id) - toNumber(left.chaos_id);
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

async function fetchOptionalMaze(baseUrl, chaosId) {
    return fetchOptionalJson(`${baseUrl}/zh/maze/${chaosId}.json`);
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

function createNanokaStatResolver(tables) {
    const eliteGroupById = mapBy(tables.eliteGroups, "EliteGroup");
    const hardLevelByGroupAndLevel = new Map(
        tables.hardLevelGroups.map(function (item) {
            return [hardLevelKey(item.HardLevelGroup, item.Level), item];
        }),
    );

    return function resolveNanokaStats(rawStage, monsterId) {
        const monsterValue = tables.monsterValues[String(baseMonsterId(monsterId))];
        const child = childForMonster(monsterValue, monsterId);
        if (!monsterValue || !child) return null;

        const eliteGroup =
            eliteGroupById.get(toNumber(rawStage.elite_group, NaN)) ??
            eliteGroupById.get(toNumber(child.EliteGroup, NaN)) ??
            {};
        const hardLevel =
            hardLevelByGroupAndLevel.get(hardLevelKey(rawStage.hard_level_group ?? child.HardLevelGroup, rawStage.level)) ?? {};

        const hp = round(
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
            hp,
            speed,
            stance: stanceRaw ? round(stanceRaw / 30) : 0,
            hp_ratio_sum: hpRatioSum,
        };
    };
}

function stageMonsterIds(stage) {
    return (stage.monster_list ?? []).map(function (wave) {
        return Object.keys(wave)
            .sort(function (left, right) {
                return Number(left) - Number(right);
            })
            .map(function (key) {
                return wave[key];
            });
    });
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
                    stage.monsters.forEach(function (wave) {
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

function makeMonster(rawId, rawStage, level, monsterStats, statResolver) {
    const calculated = statResolver(rawStage, rawId);
    if (calculated) {
        return compactObject({
            id: rawId,
            hp: calculated.hp,
            speed: calculated.speed,
            stance: calculated.stance,
            hp_ratio_sum: calculated.hp_ratio_sum === 1 ? undefined : calculated.hp_ratio_sum,
        });
    }

    const byLevel = monsterStats.byIdAndLevel.get(`${rawId}:${level}`);
    const byId = monsterStats.byId.get(rawId);
    const source = byLevel ?? byId;
    const monster = source ? { ...clone(source), id: rawId } : { id: rawId };
    if (monster.stance === undefined) monster.stance = 0;

    return monster;
}

function makeStage(rawStage, level, monsterStats, statResolver) {
    return {
        stage_id: rawStage.stage_id,
        monsters: stageMonsterIds(rawStage).map(function (wave) {
            return wave.map(function (monsterId) {
                return makeMonster(monsterId, rawStage, level, monsterStats, statResolver);
            });
        }),
    };
}

function makeStages(rawStages = [], level, monsterStats, statResolver) {
    return rawStages.map(function (rawStage) {
        return makeStage(rawStage, level, monsterStats, statResolver);
    });
}

function makeFloor(rawFloor, floorNumber, monsterStats, statResolver) {
    const level = rawFloor.event_id_list1?.[0]?.level ?? rawFloor.event_id_list2?.[0]?.level;

    return compactObject({
        floor: floorNumber,
        element_upper: normalizeElements(rawFloor.damage_type1),
        element_lower: normalizeElements(rawFloor.damage_type2),
        level,
        upper: makeStages(rawFloor.event_id_list1, level, monsterStats, statResolver),
        lower: makeStages(rawFloor.event_id_list2, level, monsterStats, statResolver),
    });
}

function applyStarFloors(entry, regularFloors, starFloors, monsterStats, statResolver) {
    starFloors.forEach(function (rawStarFloor) {
        const targetIndex = regularFloors.findIndex(function (rawFloor) {
            return rawFloor.id === rawStarFloor.pre_id;
        });
        const floor = entry.floors[targetIndex];
        if (!floor) return;

        const level = rawStarFloor.event_id_list?.[0]?.level ?? floor.level;
        floor.element_star = normalizeElements(rawStarFloor.damage_type);
        floor.star = makeStages(rawStarFloor.event_id_list, level, monsterStats, statResolver);
    });
}

function splitMazeFloors(rawFloors) {
    return {
        regularFloors: rawFloors.filter(function (floor) {
            return floor.pre_id === undefined;
        }),
        starFloors: rawFloors.filter(function (floor) {
            return floor.pre_id !== undefined;
        }),
    };
}

function makeChaosEntry(chaosId, rawFloors, buffId, monsterStats, statResolver, fallbackTime) {
    const { regularFloors, starFloors } = splitMazeFloors(rawFloors);
    if (!regularFloors.length) {
        throw new Error(`maze/${chaosId}.json 没有普通楼层数据`);
    }

    const entry = {
        chaos_id: chaosId,
        chaos_name: cleanChaosName(regularFloors[0].group_name),
        buff: {
            id: buffId,
            name: "记忆紊流",
            description: formatMazeDescription(regularFloors[0].desc, regularFloors[0].param),
        },
        floors: regularFloors.map(function (rawFloor, index) {
            return makeFloor(rawFloor, index + 1, monsterStats, statResolver);
        }),
        time: formatTimeRange(regularFloors[0]) || fallbackTime,
    };

    applyStarFloors(entry, regularFloors, starFloors, monsterStats, statResolver);
    return entry;
}

function mazeDataIssue(value) {
    if (!Array.isArray(value) || !value.length) return "文件不存在或不是楼层数组";

    const regularFloors = value.filter(function (floor) {
        return floor && floor.pre_id === undefined;
    });
    if (!regularFloors.length) return "缺少普通楼层";
    if (!cleanChaosName(regularFloors[0].group_name)) return "group_name 为空，仍是远端占位数据";
    if (!Array.isArray(regularFloors[0].event_id_list1)) return "缺少上半敌人数据";

    return "";
}

function isValidMazeData(value) {
    return mazeDataIssue(value) === "";
}

function readLocalProject(dataDir) {
    const indexPath = path.join(dataDir, "index.json");
    const index = readJson(indexPath);
    const catalogPath = path.join(dataDir, index.monster_catalog ?? "monster_catalog.json");
    const monsterCatalog = readJson(catalogPath);
    const entryFileNames = new Set(index.entries ?? []);

    fs.readdirSync(dataDir).forEach(function (fileName) {
        if (/^chaos_\d+\.json$/.test(fileName)) entryFileNames.add(fileName);
    });

    const entries = Array.from(entryFileNames)
        .sort()
        .map(function (fileName) {
            const entry = readJson(path.join(dataDir, fileName));
            return { fileName, entry };
        });

    return { index, monsterCatalog, entries };
}

function maxChaosId(entries) {
    return Math.max(
        ...entries.map(function (item) {
            return toNumber(item.entry.chaos_id, 0);
        }),
    );
}

function maxBuffId(entries) {
    return Math.max(
        ...entries.map(function (item) {
            return toNumber(item.entry.buff?.id, 0);
        }),
    );
}

async function detectNewMazes(baseUrl, latestChaosId, probeLimit) {
    const detected = [];

    for (let offset = 1; offset <= probeLimit; offset += 1) {
        const chaosId = latestChaosId + offset;
        console.log(`检测 ${chaosId} ...`);
        const rawFloors = await fetchOptionalMaze(baseUrl, chaosId);

        if (!isValidMazeData(rawFloors)) {
            console.log(`未发现 ${chaosId}，停止探测。`);
            break;
        }

        detected.push({ chaosId, rawFloors });
        console.log(`发现 ${chaosId}。`);
    }

    return detected;
}

async function loadForcedMazes(baseUrl, forceIds) {
    const detected = [];

    for (const chaosId of forceIds) {
        console.log(`读取指定期数 ${chaosId} ...`);
        const rawFloors = await fetchOptionalMaze(baseUrl, chaosId);
        if (!isValidMazeData(rawFloors)) {
            throw new Error(`指定期数 ${chaosId} 不可用：${mazeDataIssue(rawFloors)}`);
        }
        detected.push({ chaosId, rawFloors });
    }

    return detected;
}

async function loadNextMaze(baseUrl, nextChaosId) {
    const rawFloors = await fetchOptionalMaze(baseUrl, nextChaosId);
    if (!isValidMazeData(rawFloors)) {
        console.log(`混沌回忆 ${nextChaosId} 尚未发布完整数据，已安全跳过：${mazeDataIssue(rawFloors)}`);
        return [];
    }

    return [{ chaosId: nextChaosId, rawFloors }];
}

async function resolveMazeSources(baseUrl, latestChaosId, versionProbeLimit) {
    const candidates = nanokaBaseCandidates(baseUrl, versionProbeLimit);
    let newestBaseUrl = candidates[0];
    let currentBaseUrl = "";
    let currentRawFloors = null;

    for (const candidate of candidates) {
        console.log(`检查数据版本 ${candidate} ...`);
        const [rawCurrent, rawNext] = await Promise.all([
            fetchOptionalMaze(candidate, latestChaosId),
            fetchOptionalMaze(candidate, latestChaosId + 1),
        ]);
        const hasCurrent = isValidMazeData(rawCurrent);
        const hasNext = isValidMazeData(rawNext);

        if (!hasCurrent && !hasNext) continue;

        newestBaseUrl = candidate;
        if (hasCurrent) {
            currentBaseUrl = candidate;
            currentRawFloors = rawCurrent;
        }
    }

    return {
        newestBaseUrl,
        currentBaseUrl: currentBaseUrl || newestBaseUrl,
        currentRawFloors,
    };
}

function entryFileName(entry) {
    return `chaos_${entry.chaos_id}.json`;
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

function shouldReplaceMissingLocalImage(imagePath, imagesDir, info) {
    if (!imagePath || !info?.icon) return false;
    return !fs.existsSync(path.join(imagesDir, imagePath));
}

function isBadMonsterName(value) {
    return value === undefined || value === null || value === "" || value === "...";
}

function collectUsedMonsterIds(entries) {
    const ids = new Set();

    entries.forEach(function (entry) {
        entry.floors.forEach(function (floor) {
            ["upper", "lower", "star"].forEach(function (side) {
                (floor[side] ?? []).forEach(function (stage) {
                    stage.monsters.forEach(function (wave) {
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

            if (!existing["1"]) existing["1"] = localMonsterFigurePath(info, id);
            if (shouldReplaceMissingLocalImage(existing["1"], imagesDir, info)) existing["1"] = localMonsterFigurePath(info, id);
            if (!Array.isArray(existing["2"]) || !existing["2"].length) existing["2"] = normalizeElements(info?.weak ?? []);
            if (!existing["3"]) existing["3"] = 1;
            if (isBadMonsterName(existing["4"])) existing["4"] = info?.zh ?? String(id);

            catalog[id] = existing;
        });

    return catalog;
}

function makeIndex(entries) {
    return {
        monster_catalog: "monster_catalog.json",
        entries: entries
            .slice()
            .sort(function (left, right) {
                return toNumber(right.chaos_id) - toNumber(left.chaos_id);
            })
            .map(entryFileName),
    };
}

function mergeEntries(localEntries, generatedEntries) {
    const byId = new Map();

    localEntries.forEach(function (item) {
        byId.set(toNumber(item.entry.chaos_id), clone(item.entry));
    });
    generatedEntries.forEach(function (entry) {
        byId.set(toNumber(entry.chaos_id), clone(entry));
    });

    return Array.from(byId.values()).sort(function (left, right) {
        return toNumber(right.chaos_id) - toNumber(left.chaos_id);
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

function localChaosEntry(localEntries, chaosId) {
    const item = localEntries.find(function (entryItem) {
        return toNumber(entryItem.entry.chaos_id) === chaosId;
    });

    return item?.entry ?? null;
}

function buffIdForChaos(chaosId, localEntries, nextBuffId) {
    const existing = localEntries.find(function (item) {
        return toNumber(item.entry.chaos_id) === chaosId;
    });
    if (existing?.entry?.buff?.id) return toNumber(existing.entry.buff.id);

    return nextBuffId.value++;
}

function validateProject(index, entries, monsterCatalog) {
    const errors = [];
    const entryByFileName = new Map(
        entries.map(function (entry) {
            return [entryFileName(entry), entry];
        }),
    );
    const buffIds = new Map();

    index.entries.forEach(function (fileName) {
        if (!entryByFileName.has(fileName)) errors.push(`index.json 引用了不存在的数据：${fileName}`);
    });

    entries.forEach(function (entry) {
        if (!entry.chaos_id) errors.push("存在缺少 chaos_id 的混沌条目");
        if (!entry.chaos_name) errors.push(`chaos_${entry.chaos_id}.json 缺少 chaos_name`);
        if (!entry.buff?.id) errors.push(`chaos_${entry.chaos_id}.json 缺少 buff.id`);
        if (!entry.buff?.description) errors.push(`chaos_${entry.chaos_id}.json 缺少 buff.description`);
        if (!Array.isArray(entry.floors) || !entry.floors.length) errors.push(`chaos_${entry.chaos_id}.json 缺少 floors`);

        const currentBuffId = String(entry.buff?.id ?? "");
        const previous = buffIds.get(currentBuffId);
        if (previous) {
            errors.push(`buff.id 重复：${currentBuffId} 同时出现在 ${previous} 和 ${entry.chaos_id}`);
        }
        buffIds.set(currentBuffId, entry.chaos_id);
    });

    collectUsedMonsterIds(entries).forEach(function (id) {
        const item = monsterCatalog[id];
        if (!item) errors.push(`monster_catalog.json 缺少怪物：${id}`);
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
        throw new Error("缺少 nanokaBaseUrl，请在 chaos-update-config.json 或 --base 中配置。");
    }

    console.log(`数据目录：${config.dataDir}`);
    console.log(`Nanoka：${config.nanokaBaseUrl}`);

    const localProject = readLocalProject(config.dataDir);
    const localEntries = localProject.entries;
    const localEntryValues = localEntries.map(function (item) {
        return item.entry;
    });
    const latestChaosId = maxChaosId(localEntries);
    const nextBuffId = { value: maxBuffId(localEntries) + 1 };

    console.log(`当前最大期数：${latestChaosId}`);
    console.log(`下一个 buff.id：${nextBuffId.value}`);

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
              siteUrl: `https://hsr.nanoka.cc/maze/${latestChaosId}`,
              hasData: async function (baseUrl) {
                  const [rawCurrent, rawNext] = await Promise.all([
                      fetchOptionalMaze(baseUrl, latestChaosId),
                      fetchOptionalMaze(baseUrl, latestChaosId + 1),
                  ]);

                  return isValidMazeData(rawCurrent) || isValidMazeData(rawNext);
              },
          });

    console.log(`配置版本：${versionState.configuredVersion}`);
    console.log(`远端版本：${versionState.latestVersion}`);

    if (!cliOptions.forceIds.length && !versionState.changed) {
        console.log("Nanoka 版本未变化，跳过混沌回忆更新。");
        return;
    }

    console.log(`版本变化类型：${versionState.changeType}`);

    const sources = cliOptions.forceIds.length
        ? {
              newestBaseUrl: config.nanokaBaseUrl,
              currentBaseUrl: config.nanokaBaseUrl,
              currentRawFloors: null,
          }
        : {
              newestBaseUrl: versionState.latestBaseUrl,
              currentBaseUrl: versionState.latestBaseUrl,
              currentRawFloors:
                  versionState.changeType === "small"
                      ? await fetchOptionalMaze(versionState.latestBaseUrl, latestChaosId)
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
        ? await loadForcedMazes(sources.newestBaseUrl, cliOptions.forceIds)
        : versionState.changeType === "major"
          ? await loadNextMaze(sources.newestBaseUrl, latestChaosId + 1)
          : [];

    const generatedEntries = [];

    if (!cliOptions.forceIds.length && versionState.changeType === "small" && !isValidMazeData(sources.currentRawFloors)) {
        updateNanokaBaseUrlConfig(configPath, versionState.latestBaseUrl, cliOptions.dryRun);
        console.log(`当前混沌回忆 ${latestChaosId} 的远端数据不完整，已安全跳过：${mazeDataIssue(sources.currentRawFloors)}`);
        return;
    }

    if (!cliOptions.forceIds.length && isValidMazeData(sources.currentRawFloors)) {
        const buffId = buffIdForChaos(latestChaosId, localEntries, nextBuffId);
        const fallbackTime = fallbackTimeForChaos(latestChaosId, localEntryValues, config.defaultDurationDays);
        const refreshedLatest = makeChaosEntry(
            latestChaosId,
            sources.currentRawFloors,
            buffId,
            monsterStats,
            currentStatResolver,
            fallbackTime,
        );
        const localLatest = localChaosEntry(localEntries, latestChaosId);

        if (!sameEntry(refreshedLatest, localLatest)) {
            generatedEntries.push(refreshedLatest);
            console.log(`当前最新期 ${latestChaosId} 与远端数据不同，将先更新这一期。`);
        } else {
            console.log(`当前最新期 ${latestChaosId} 与远端数据一致。`);
        }
    }

    if (!targets.length && !generatedEntries.length) {
        updateNanokaBaseUrlConfig(configPath, versionState.latestBaseUrl, cliOptions.dryRun);
        console.log("暂无新一期混沌回忆。");
        return;
    }

    const sortedTargets = targets.slice().sort(function (left, right) {
        return toNumber(left.chaosId) - toNumber(right.chaosId);
    });

    sortedTargets.forEach(function (target) {
        const buffId = buffIdForChaos(target.chaosId, localEntries, nextBuffId);
        const knownEntries = localEntryValues.concat(generatedEntries);
        const fallbackTime = fallbackTimeForChaos(target.chaosId, knownEntries, config.defaultDurationDays);
        generatedEntries.push(makeChaosEntry(target.chaosId, target.rawFloors, buffId, monsterStats, statResolver, fallbackTime));
    });
    const allEntries = mergeEntries(localEntries, generatedEntries);
    const index = makeIndex(allEntries);
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
        console.log(`已处理：${entry.chaos_id} ${entry.chaos_name} ${entry.time}`);
    });
    console.log(cliOptions.dryRun ? "dry-run 完成，未写入文件。" : "更新完成。");
}

await main().catch(function (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
});
