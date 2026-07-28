import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNanokaVersionState, updateNanokaBaseUrlConfig } from "../lib/nanoka-version.mjs";
import {
    cleanName,
    clone,
    collectMonsterStats,
    compactObject,
    createNanokaStatResolver,
    downloadMissingMonsterImages,
    fetchOptionalJson,
    formatEffect,
    groupedMonsterIds,
    hpCoefficientForStage,
    loadNanokaTables,
    makeMonster,
    makeMonsterCatalog,
    normalizeElements,
    preserveEffectIds,
    readJson,
    sameEntry,
    stripTrailingSlash,
    toNumber,
    writeJsonFile,
} from "../lib/abyss-update-common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "arbitration-update-config.json");
const localIdOffset = 4000;
const specialTimeRanges = new Map([
    [4007, "2026/06/01 - 2026/07/15"],
    [4008, "2026/07/15 - 2026/08/26"],
]);

function parseArgs(argv) {
    const options = {
        dryRun: false,
        baseUrl: "",
        dataDir: "",
        forceIds: [],
        downloadMissingMonsterImages: null,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === "--dry-run") {
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
            return toLocalArbitrationId(Number(item.trim()));
        })
        .filter(Number.isInteger);
}

function loadConfig(cliOptions) {
    const fileConfig = fs.existsSync(configPath) ? readJson(configPath) : {};

    return {
        nanokaBaseUrl: stripTrailingSlash(cliOptions.baseUrl || fileConfig.nanokaBaseUrl),
        nanokaImageBaseUrl: stripTrailingSlash(fileConfig.nanokaImageBaseUrl || "https://static.nanoka.cc/assets/hsr"),
        dataDir: path.resolve(__dirname, cliOptions.dataDir || fileConfig.dataDir || "../data/arbitration"),
        imagesDir: path.resolve(__dirname, fileConfig.imagesDir || "../images"),
        versionProbeLimit: Number(fileConfig.versionProbeLimit ?? 8),
        defaultDurationDays: Number(fileConfig.defaultDurationDays ?? 40),
        downloadMissingMonsterImages:
            cliOptions.downloadMissingMonsterImages ?? fileConfig.downloadMissingMonsterImages ?? true,
    };
}

function toLocalArbitrationId(value) {
    if (!Number.isInteger(value)) return value;
    return value >= localIdOffset ? value : value + localIdOffset;
}

function toPeakId(arbitrationId) {
    return arbitrationId - localIdOffset;
}

async function fetchOptionalPeak(baseUrl, arbitrationId) {
    return fetchOptionalJson(`${baseUrl}/zh/peak/${toPeakId(arbitrationId)}.json`);
}

function isValidPeakData(rawPeak) {
    return rawPeak && Number.isInteger(Number(rawPeak.id)) && Array.isArray(rawPeak.pre_level) && rawPeak.boss_level;
}

function entryFileName(entry) {
    return `arbitration_${entry.arbitration_id}.json`;
}

function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
}

function nextArbitrationTimeRange(previousTime, durationDays) {
    const match = String(previousTime ?? "").match(/(\d{4})\/(\d{2})\/(\d{2})\s*-\s*(\d{4})\/(\d{2})\/(\d{2})/);
    if (!match) return previousTime ?? "";

    const start = new Date(Date.UTC(Number(match[4]), Number(match[5]) - 1, Number(match[6])));
    const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);

    return `${formatDate(start)} - ${formatDate(end)}`;
}

function fallbackArbitrationTimeForId(arbitrationId, entries, durationDays) {
    if (specialTimeRanges.has(arbitrationId)) return specialTimeRanges.get(arbitrationId);

    const existing = entries.find(function (entry) {
        return toNumber(entry.arbitration_id) === arbitrationId && entry.time;
    });
    if (existing) return existing.time;

    const previous = entries
        .filter(function (entry) {
            return toNumber(entry.arbitration_id) < arbitrationId && entry.time;
        })
        .sort(function (left, right) {
            return toNumber(right.arbitration_id) - toNumber(left.arbitration_id);
        })[0];

    return nextArbitrationTimeRange(previous?.time, durationDays);
}

function readLocalProject(dataDir) {
    const index = readJson(path.join(dataDir, "index.json"));
    const monsterCatalog = readJson(path.join(dataDir, index.monster_catalog ?? "monster_catalog.json"));
    const entries = index.entries.map(function (fileName) {
        return {
            fileName,
            entry: readJson(path.join(dataDir, fileName)),
        };
    });

    return { index, monsterCatalog, entries };
}

function maxArbitrationId(entries) {
    return Math.max(...entries.map(function (item) {
        return toNumber(item.entry.arbitration_id);
    }));
}

function sortedInfiniteWaves(infiniteList = {}) {
    return Object.values(infiniteList).sort(function (left, right) {
        return toNumber(left.infinite_wave_id) - toNumber(right.infinite_wave_id);
    });
}

function makePeakStage(levelConfig, monsterStats, statResolver) {
    const rawStage = levelConfig.event_id_list[0];
    const waves = sortedInfiniteWaves(levelConfig.infinite_list);
    const firstWave = waves[0];
    const firstMonsterId = firstWave?.monster_group_id_list?.[0];
    const coefficientStage = { ...rawStage, elite_group: firstWave?.elite_group };

    return compactObject({
        stage_id: rawStage.stage_id,
        hp_coefficient: hpCoefficientForStage(coefficientStage, statResolver, firstMonsterId),
        level: rawStage.level,
        monsters: waves.map(function (wave) {
            const waveStage = { ...rawStage, elite_group: wave.elite_group };

            return groupedMonsterIds(wave.monster_group_id_list).map(function (monster) {
                return makeMonster(monster.id, waveStage, monsterStats, statResolver, {
                    number: monster.number,
                });
            });
        }),
    });
}

function defaultTargetAbc(existingEntry) {
    return (
        existingEntry?.target_abc ?? [
            "不超过<color style='color:#f29e38;'> 4 </color>轮战斗胜利",
            "不超过<color style='color:#f29e38;'> 2 </color>轮战斗胜利",
            "没有角色无法战斗",
        ]
    );
}

function defaultTargetFinal(existingEntry) {
    return (
        existingEntry?.target_final ?? [
            "不超过<color style='color:#f29e38;'> 6 </color>轮战斗胜利",
            "不超过<color style='color:#f29e38;'> 4 </color>轮战斗胜利",
            "不超过<color style='color:#f29e38;'> 2 </color>轮战斗胜利",
        ]
    );
}

function makeArbitrationEntry(arbitrationId, rawPeak, existingEntry, monsterStats, statResolver, fallbackTime) {
    const [trialA, trialB, trialC] = rawPeak.pre_level;

    return {
        arbitration_id: arbitrationId,
        arbitration_name: cleanName(rawPeak.name),
        time: fallbackTime,
        debuff_a: preserveEffectIds((trialA.tag_list ?? []).map(formatEffect), existingEntry?.debuff_a),
        element_a: normalizeElements(trialA.damage_type ?? []),
        monster_a: makePeakStage(trialA, monsterStats, statResolver),
        debuff_b: preserveEffectIds((trialB.tag_list ?? []).map(formatEffect), existingEntry?.debuff_b),
        element_b: normalizeElements(trialB.damage_type ?? []),
        monster_b: makePeakStage(trialB, monsterStats, statResolver),
        debuff_c: preserveEffectIds((trialC.tag_list ?? []).map(formatEffect), existingEntry?.debuff_c),
        element_c: normalizeElements(trialC.damage_type ?? []),
        monster_c: makePeakStage(trialC, monsterStats, statResolver),
        buff_final: preserveEffectIds(
            (rawPeak.boss_config?.buff_list ?? []).map(formatEffect),
            existingEntry?.buff_final,
        ),
        debuff_final_easy: preserveEffectIds(
            (rawPeak.boss_level?.tag_list ?? []).map(formatEffect),
            existingEntry?.debuff_final_easy,
        ),
        debuff_final_hard: preserveEffectIds(
            (rawPeak.boss_config?.tag_list ?? []).map(formatEffect),
            existingEntry?.debuff_final_hard,
        ),
        element_final: normalizeElements(rawPeak.boss_level?.damage_type ?? []),
        monster_final_easy: makePeakStage(rawPeak.boss_level, monsterStats, statResolver),
        monster_final_hard: makePeakStage(rawPeak.boss_config, monsterStats, statResolver),
        target_abc: defaultTargetAbc(existingEntry),
        target_final: defaultTargetFinal(existingEntry),
    };
}

function mergeEntries(localEntries, generatedEntries) {
    const byId = new Map();

    localEntries.forEach(function (item) {
        byId.set(toNumber(item.entry.arbitration_id), clone(item.entry));
    });
    generatedEntries.forEach(function (entry) {
        byId.set(toNumber(entry.arbitration_id), clone(entry));
    });

    return Array.from(byId.values()).sort(function (left, right) {
        return toNumber(right.arbitration_id) - toNumber(left.arbitration_id);
    });
}

function makeIndex(entries, existingIndex) {
    return {
        monster_catalog: existingIndex.monster_catalog ?? "monster_catalog.json",
        reward_lines: existingIndex.reward_lines ?? "reward_lines.json",
        entries: entries.map(entryFileName),
    };
}

function localEntry(localEntries, arbitrationId) {
    return localEntries.find(function (item) {
        return toNumber(item.entry.arbitration_id) === arbitrationId;
    })?.entry ?? null;
}

function writeProjectData(dataDir, index, monsterCatalog, generatedEntries, dryRun) {
    if (dryRun) {
        generatedEntries.forEach(function (entry) {
            console.log(`[dry-run] ${entryFileName(entry)}`);
        });
        return;
    }

    writeJsonFile(path.join(dataDir, "index.json"), index);
    writeJsonFile(path.join(dataDir, index.monster_catalog), monsterCatalog);
    generatedEntries.forEach(function (entry) {
        writeJsonFile(path.join(dataDir, entryFileName(entry)), entry);
    });
}

async function loadForcedPeaks(baseUrl, forceIds) {
    const targets = [];

    for (const arbitrationId of forceIds) {
        const rawPeak = await fetchOptionalPeak(baseUrl, arbitrationId);
        if (!isValidPeakData(rawPeak)) throw new Error(`指定异相仲裁 ${arbitrationId} 不存在。`);
        targets.push({ arbitrationId, rawPeak });
    }

    return targets;
}

async function main() {
    const cliOptions = parseArgs(process.argv.slice(2));
    const config = loadConfig(cliOptions);
    if (!config.nanokaBaseUrl) throw new Error("缺少 nanokaBaseUrl。");

    const localProject = readLocalProject(config.dataDir);
    const localEntries = localProject.entries;
    const localEntryValues = localEntries.map(function (item) {
        return item.entry;
    });
    const latestArbitrationId = maxArbitrationId(localEntries);
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
              siteUrl: `https://hsr.nanoka.cc/peak/${toPeakId(latestArbitrationId)}`,
              hasData: async function (baseUrl) {
                  const [rawCurrent, rawNext] = await Promise.all([
                      fetchOptionalPeak(baseUrl, latestArbitrationId),
                      fetchOptionalPeak(baseUrl, latestArbitrationId + 1),
                  ]);

                  return isValidPeakData(rawCurrent) || isValidPeakData(rawNext);
              },
          });

    console.log(`配置版本：${versionState.configuredVersion}`);
    console.log(`远端版本：${versionState.latestVersion}`);

    if (!cliOptions.forceIds.length && !versionState.changed) {
        console.log("Nanoka 版本未变化，继续检查本地怪物目录与图片。");
    }

    const tables = await loadNanokaTables(versionState.latestBaseUrl);
    const statResolver = createNanokaStatResolver(tables);
    const monsterStats = collectMonsterStats(localEntryValues);
    let targets = [];
    if (cliOptions.forceIds.length) {
        targets = await loadForcedPeaks(versionState.latestBaseUrl, cliOptions.forceIds);
    } else if (versionState.changed) {
        const targetId = versionState.changeType === "major" ? latestArbitrationId + 1 : latestArbitrationId;
        targets = [
            {
                arbitrationId: targetId,
                rawPeak: await fetchOptionalPeak(versionState.latestBaseUrl, targetId),
            },
        ];
    }

    const generatedEntries = [];

    targets.forEach(function (target) {
        if (!isValidPeakData(target.rawPeak)) {
            throw new Error(`远端没有异相仲裁 ${target.arbitrationId} 数据。`);
        }

        const existing = localEntry(localEntries, target.arbitrationId);
        const fallbackTime = fallbackArbitrationTimeForId(
            target.arbitrationId,
            localEntryValues.concat(generatedEntries),
            config.defaultDurationDays,
        );
        const generated = makeArbitrationEntry(target.arbitrationId, target.rawPeak, existing, monsterStats, statResolver, fallbackTime);

        if (!sameEntry(generated, existing)) {
            generatedEntries.push(generated);
        }
    });

    const allEntries = mergeEntries(localEntries, generatedEntries);
    const index = makeIndex(allEntries, localProject.index);
    const monsterCatalog = makeMonsterCatalog(allEntries, localProject.monsterCatalog, tables.monsterInfos, config.imagesDir);

    if (config.downloadMissingMonsterImages) {
        const imageResult = await downloadMissingMonsterImages(
            allEntries,
            tables.monsterInfos,
            config.imagesDir,
            config.nanokaImageBaseUrl,
            cliOptions.dryRun,
        );
        console.log(
            `怪物图片：已存在 ${imageResult.existing}，新增 ${imageResult.downloaded}，下载失败 ${imageResult.failed}。`,
        );
        if (imageResult.failedIds.length) {
            console.log(`下载失败的怪物 ID：${imageResult.failedIds.join(", ")}`);
        }
    }

    writeProjectData(config.dataDir, index, monsterCatalog, generatedEntries, cliOptions.dryRun);
    updateNanokaBaseUrlConfig(configPath, versionState.latestBaseUrl, cliOptions.dryRun);

    if (!generatedEntries.length) console.log("异相仲裁数据无变化，怪物目录与图片检查完成。");

    generatedEntries.forEach(function (entry) {
        console.log(`已处理：${entry.arbitration_id} ${entry.arbitration_name}`);
    });
}

await main().catch(function (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
});
