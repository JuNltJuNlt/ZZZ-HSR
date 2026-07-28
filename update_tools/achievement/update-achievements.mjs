import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    cleanName,
    firstValue,
    idFromEntry,
    readJson,
    resolveProjectPath,
    toNumber,
    uniqueBy,
    writeJsonFile,
} from "../lib/static-update-common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "achievement-update-config.json");

function printHelp() {
    console.log(`用法：
  node update_tools/achievement/update-achievements.mjs
  node update_tools/achievement/update-achievements.mjs --dry-run
  node update_tools/achievement/update-achievements.mjs --source-file official-achievements.json
  node update_tools/achievement/update-achievements.mjs --base https://act-api-takumi.mihoyo.com/event/rpgcultivate/achievement/list

说明：
  官方接口需要米游社登录态。更新器只从 MIHOYO_COOKIE 环境变量读取 Cookie，不会写入项目文件。
  --source-file 可读取事先保存的官方接口 JSON，适合不希望给脚本传入 Cookie 的情况。`);
}

function parseArgs(argv) {
    const options = { dryRun: false, apiUrl: "", sourceFile: "", help: false };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--help" || arg === "-h") {
            options.help = true;
        } else if (arg === "--dry-run") {
            options.dryRun = true;
        } else if (arg === "--base") {
            options.apiUrl = argv[index + 1] ?? "";
            index += 1;
        } else if (arg.startsWith("--base=")) {
            options.apiUrl = arg.slice("--base=".length);
        } else if (arg === "--source-file") {
            options.sourceFile = argv[index + 1] ?? "";
            index += 1;
        } else if (arg.startsWith("--source-file=")) {
            options.sourceFile = arg.slice("--source-file=".length);
        } else {
            throw new Error(`未知参数：${arg}`);
        }
    }

    return options;
}

function rewardRarity(reward) {
    if (reward >= 20) return "High";
    if (reward >= 10) return "Mid";
    return "Low";
}

function rewardFromRarity(rarity) {
    const value = String(rarity ?? "").toLowerCase();
    if (value === "high" || value === "3") return 20;
    if (value === "mid" || value === "2") return 10;
    return 5;
}

function normalizeDescription(value, params = []) {
    return String(value ?? "")
        .replace(/#(\d+)\[i\](%?)/g, function (_, rawIndex, percentMark) {
            const param = params[Number(rawIndex) - 1] ?? "";
            return percentMark ? Number(param) * 100 : param;
        })
        .replace(/\\n/g, "\n");
}

function isPlaceholder(achievement) {
    return achievement.name === "..." && achievement.description === "...";
}

function existingSeriesMap(existing) {
    return new Map((existing.series ?? []).map((item) => [String(item.value), item]));
}

function officialReward(entry, rarity) {
    let value = firstValue(entry, ["reward", "Reward", "reward_num", "reward_count", "stellar_jade", "StellarJade"], undefined);
    if (Array.isArray(value)) value = value[0];
    if (value && typeof value === "object") {
        value = firstValue(value, ["num", "count", "item_num", "item_count", "value"], undefined);
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : rewardFromRarity(rarity);
}

function normalizeRarity(value, reward) {
    const rarity = String(value ?? "").toLowerCase();
    if (rarity === "high" || rarity === "3") return "High";
    if (rarity === "mid" || rarity === "2") return "Mid";
    if (rarity === "low" || rarity === "1") return "Low";
    return rewardRarity(reward);
}

function seriesFromAchievement(entry, id, seriesById) {
    const explicitSeries = String(firstValue(entry, ["series", "Series", "series_id", "SeriesID", "group", "Group"], ""));
    if (explicitSeries) return explicitSeries;

    const icon = String(firstValue(entry, ["icon", "Icon"], ""));
    if (icon) {
        for (const [value, seriesInfo] of seriesById.entries()) {
            if (seriesInfo.icon === icon) return value;
        }
    }

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return "";
    const inferredSeries = String(Math.floor(numericId / 10000) - 400);
    return seriesById.has(inferredSeries) ? inferredSeries : "";
}

function transformAchievement(entry, fallbackIndex, seriesById) {
    const id = idFromEntry(entry, fallbackIndex);
    const rawRarity = firstValue(entry, ["rarity", "Rarity", "rank", "Rank"], "");
    const reward = officialReward(entry, rawRarity);
    const series = seriesFromAchievement(entry, id, seriesById);
    const seriesInfo = seriesById.get(series);
    const rawSeriesLabel = String(
        firstValue(entry, ["series_label", "seriesLabel", "SeriesLabel", "series_name", "SeriesName"], ""),
    ).trim();
    const exclusiveGroup = String(firstValue(entry, ["exclusive_group", "exclusiveGroup"], "")).trim();

    const achievement = {
        id,
        name: cleanName(firstValue(entry, ["name", "Name", "achievement_name", "title", "Title"], "...")),
        description: normalizeDescription(
            firstValue(entry, ["description", "Description", "achievement_desc", "desc", "Desc"], "..."),
            firstValue(entry, ["param_list", "ParamList", "params", "Params"], []),
        ),
        series,
        series_label: rawSeriesLabel || seriesInfo?.label || series,
        reward,
        rarity: normalizeRarity(rawRarity, reward),
    };

    if (exclusiveGroup) achievement.exclusive_group = exclusiveGroup;
    return achievement;
}

function flattenOfficialAchievements(entries) {
    const flattened = [];

    function visit(entry, inherited = {}) {
        if (!entry || typeof entry !== "object") return;

        const merged = { ...inherited, ...entry };
        const children = Array.isArray(entry.sub_achievements) ? entry.sub_achievements : [];
        const inheritedGroup = String(firstValue(inherited, ["exclusive_group", "exclusiveGroup"], "")).trim();
        const exclusiveGroup = inheritedGroup || (children.length ? String(idFromEntry(merged, "")).trim() : "");
        delete merged.sub_achievements;
        if (exclusiveGroup) merged.exclusive_group = exclusiveGroup;
        flattened.push(merged);

        const childDefaults = {
            series_id: firstValue(merged, ["series_id", "SeriesID", "series", "Series"], ""),
            series_name: firstValue(merged, ["series_name", "SeriesName", "series_label", "SeriesLabel"], ""),
            icon: firstValue(merged, ["icon", "Icon"], ""),
            exclusive_group: exclusiveGroup,
        };
        children.forEach(function (child) {
            visit(child, childDefaults);
        });
    }

    entries.forEach(function (entry) {
        visit(entry);
    });
    return flattened;
}

function seriesMapForTransform(remoteSeries, existing) {
    const result = existingSeriesMap(existing);
    remoteSeries.forEach(function (item) {
        const value = String(firstValue(item, ["series_id", "value", "id", "Id", "ID"], ""));
        if (!value) return;
        result.set(value, {
            value,
            label: cleanName(firstValue(item, ["name", "label", "Name"], result.get(value)?.label ?? value)),
            priority: toNumber(firstValue(item, ["priority", "order", "Priority", "Order"], result.get(value)?.priority ?? 0), 0),
            icon: String(firstValue(item, ["icon", "Icon"], result.get(value)?.icon ?? "")),
        });
    });
    return result;
}

function seriesFromOfficial(remoteSeries, achievements, existing) {
    const metadata = seriesMapForTransform(remoteSeries, existing);
    const achievementGroupsBySeries = new Map();
    achievements.forEach(function (achievement) {
        if (!achievementGroupsBySeries.has(achievement.series)) {
            achievementGroupsBySeries.set(achievement.series, new Set());
        }
        achievementGroupsBySeries.get(achievement.series).add(achievement.exclusive_group || achievement.id);
    });

    return [...achievementGroupsBySeries.entries()]
        .map(function ([value, achievementGroups]) {
            const sample = achievements.find((achievement) => achievement.series === value);
            return {
                value,
                label: metadata.get(value)?.label ?? sample?.series_label ?? value,
                priority: metadata.get(value)?.priority ?? 0,
                count: achievementGroups.size,
            };
        })
        .filter((item) => item.value && item.label)
        .sort(function (left, right) {
            return right.priority - left.priority || Number(left.value) - Number(right.value);
        });
}

function rewardFilters() {
    return [
        { value: "20", reward: 20, label: "20星琼" },
        { value: "10", reward: 10, label: "10星琼" },
        { value: "5", reward: 5, label: "5星琼" },
    ];
}

function officialRequestUrl(apiUrl, pageNumber, pageSize) {
    const url = new URL(apiUrl);
    url.searchParams.set("game", "hkrpg");
    url.searchParams.set("page_num", String(pageNumber));
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("show_hide", "true");
    url.searchParams.set("need_all", "false");
    url.searchParams.set("t", String(Date.now()));
    return url;
}

async function fetchOfficialPage(apiUrl, pageUrl, cookie, pageNumber, pageSize) {
    const response = await fetch(officialRequestUrl(apiUrl, pageNumber, pageSize), {
        headers: {
            Accept: "application/json, text/plain, */*",
            Cookie: cookie,
            Origin: "https://act.mihoyo.com",
            Referer: pageUrl,
            "x-rpc-lang": "zh-cn",
        },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${apiUrl}`);

    const payload = await response.json();
    if (toNumber(payload?.retcode, -1) !== 0) {
        throw new Error(`官方成就接口返回 ${payload?.retcode ?? "未知错误"}：${payload?.message ?? "没有错误说明"}`);
    }
    return payload.data ?? {};
}

async function fetchAllOfficialAchievements(config, cookie) {
    const pageSize = Math.max(1, toNumber(config.pageSize, 20));
    const maxPages = Math.max(1, toNumber(config.maxPages, 200));
    const achievementsById = new Map();
    const seriesById = new Map();

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
        const data = await fetchOfficialPage(config.officialApiUrl, config.officialPageUrl, cookie, pageNumber, pageSize);
        const pageAchievements = Array.isArray(data.achievement_list) ? data.achievement_list : [];
        const pageSeries = Array.isArray(data.achievement_series_list) ? data.achievement_series_list : [];
        let newIds = 0;

        pageSeries.forEach(function (item) {
            const id = String(firstValue(item, ["series_id", "id", "Id", "ID"], ""));
            if (id) seriesById.set(id, item);
        });
        pageAchievements.forEach(function (item, index) {
            const id = String(idFromEntry(item, `${pageNumber}:${index}`));
            if (!achievementsById.has(id)) newIds += 1;
            achievementsById.set(id, item);
        });

        console.log(`米游社成就接口：第 ${pageNumber} 页，${pageAchievements.length} 条`);
        if (!pageAchievements.length || !newIds) break;
        if (pageNumber === maxPages) throw new Error(`官方成就接口超过 ${maxPages} 页，已中止以避免无限请求。`);
    }

    return {
        achievement_list: [...achievementsById.values()],
        achievement_series_list: [...seriesById.values()],
    };
}

function loadOfficialSourceFile(filePath) {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const pages = Array.isArray(payload?.pages) ? payload.pages : [payload?.data ?? payload];
    return {
        achievement_list: pages.flatMap((page) => (Array.isArray(page?.achievement_list) ? page.achievement_list : [])),
        achievement_series_list: pages.flatMap((page) =>
            Array.isArray(page?.achievement_series_list) ? page.achievement_series_list : [],
        ),
    };
}

async function loadOfficialData(config, options) {
    if (options.sourceFile) {
        const sourcePath = path.resolve(process.cwd(), options.sourceFile);
        console.log(`成就数据源：米游社官方接口导出文件 ${sourcePath}`);
        return loadOfficialSourceFile(sourcePath);
    }

    const cookieEnv = config.cookieEnv || "MIHOYO_COOKIE";
    const cookie = String(process.env[cookieEnv] ?? "").trim();
    if (!cookie) {
        console.warn(`成就更新已跳过：米游社官方接口要求登录，请临时设置环境变量 ${cookieEnv} 后重试。`);
        console.warn("现有 achievements.json 保持不变；登录凭证不会写入项目文件。");
        return null;
    }

    console.log(`成就数据源：${config.officialApiUrl}`);
    try {
        return await fetchAllOfficialAchievements(config, cookie);
    } catch (error) {
        console.warn(`成就更新已跳过：${error.message}`);
        console.warn("现有 achievements.json 保持不变。");
        return null;
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const config = readJson(configPath, {});
    config.officialApiUrl = options.apiUrl || config.officialApiUrl;
    if (!config.officialApiUrl) throw new Error("achievement-update-config.json 缺少 officialApiUrl");
    if (!config.officialPageUrl) throw new Error("achievement-update-config.json 缺少 officialPageUrl");

    const dataFile = resolveProjectPath(configPath, config.dataFile);
    const existing = readJson(dataFile, { series: [], rewards: rewardFilters(), achievements: [] });
    const official = await loadOfficialData(config, options);
    if (!official) return;

    const remoteSeries = uniqueBy(official.achievement_series_list ?? [], function (item) {
        return String(firstValue(item, ["series_id", "value", "id", "Id", "ID"], ""));
    });
    const seriesById = seriesMapForTransform(remoteSeries, existing);
    const rawAchievements = flattenOfficialAchievements(official.achievement_list ?? []);
    const remoteAchievements = uniqueBy(
        rawAchievements
            .map(function (entry, index) {
                return transformAchievement(entry, index, seriesById);
            })
            .filter(function (achievement) {
                return achievement.id && achievement.series && !isPlaceholder(achievement);
            }),
        function (achievement) {
            return achievement.id;
        },
    );
    if (!remoteAchievements.length) {
        throw new Error("米游社官方接口没有返回可用的成就数据，已停止写入。\n");
    }

    const achievements = remoteAchievements;
    const data = {
        series: seriesFromOfficial(remoteSeries, achievements, existing),
        rewards: rewardFilters(),
        achievements,
    };

    console.log(`官方成就数量：${remoteAchievements.length}`);
    if (!options.dryRun) writeJsonFile(dataFile, data);
}

main().catch(function (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
});
