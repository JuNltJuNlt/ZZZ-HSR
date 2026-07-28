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
    fallbackTimeForId,
    fetchOptionalJson,
    formatEffect,
    formatEffectList,
    loadNanokaTables,
    makeMonster,
    makeMonsterCatalog,
    normalizeElements,
    preserveEffectIds,
    readJson,
    sameEntry,
    stageMonsterIds,
    stripTrailingSlash,
    toNumber,
    writeJsonFile,
    hpCoefficientForStage,
} from "../lib/abyss-update-common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "shadow-update-config.json");

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
            return Number(item.trim());
        })
        .filter(Number.isInteger);
}

function loadConfig(cliOptions) {
    const fileConfig = fs.existsSync(configPath) ? readJson(configPath) : {};

    return {
        nanokaBaseUrl: stripTrailingSlash(cliOptions.baseUrl || fileConfig.nanokaBaseUrl),
        nanokaImageBaseUrl: stripTrailingSlash(fileConfig.nanokaImageBaseUrl || "https://static.nanoka.cc/assets/hsr"),
        dataDir: path.resolve(__dirname, cliOptions.dataDir || fileConfig.dataDir || "../data/shadow"),
        imagesDir: path.resolve(__dirname, fileConfig.imagesDir || "../images"),
        versionProbeLimit: Number(fileConfig.versionProbeLimit ?? 8),
        defaultDurationDays: Number(fileConfig.defaultDurationDays ?? 42),
        downloadMissingMonsterImages:
            cliOptions.downloadMissingMonsterImages ?? fileConfig.downloadMissingMonsterImages ?? true,
    };
}

async function fetchOptionalShadow(baseUrl, shadowId) {
    return fetchOptionalJson(`${baseUrl}/zh/boss/${shadowId}.json`);
}

function isValidShadowData(rawShadow) {
    return rawShadow && Number.isInteger(Number(rawShadow.id)) && Array.isArray(rawShadow.level);
}

function entryFileName(entry) {
    return `shadow_${entry.shadow_id}.json`;
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

function maxShadowId(entries) {
    return Math.max(...entries.map(function (item) {
        return toNumber(item.entry.shadow_id);
    }));
}

function regularLevels(rawShadow) {
    return rawShadow.level.filter(function (level) {
        return level.event_id_list1?.length && level.event_id_list2?.length;
    });
}

function starLevel(rawShadow) {
    return rawShadow.level.find(function (level) {
        return level.event_id_list?.length && !level.event_id_list1;
    });
}

function shadowBuffTotalId(shadowId) {
    const firstGeneratedId = 3015;
    const firstBuffId = 3110014;
    const numericShadowId = toNumber(shadowId);

    return numericShadowId >= firstGeneratedId ? firstBuffId + numericShadowId - firstGeneratedId : undefined;
}
function makeStage(rawStage, level, floorNumber, monsterStats, statResolver) {
    const firstMonsterId = stageMonsterIds(rawStage)[0]?.[0];
    const stage = compactObject({
        stage_id: rawStage.stage_id,
        level,
        hp_coefficient: floorNumber === 4 ? hpCoefficientForStage(rawStage, statResolver, firstMonsterId) : undefined,
        monsters: stageMonsterIds(rawStage).map(function (wave) {
            return wave.map(function (monsterId) {
                return makeMonster(monsterId, rawStage, monsterStats, statResolver, { hpRatioFallback: 2 });
            });
        }),
    });

    return stage;
}

function makeShadowEntry(shadowId, rawShadow, existingEntry, monsterStats, statResolver, fallbackTime) {
    const levels = regularLevels(rawShadow);
    const star = starLevel(rawShadow);
    const lastRegular = levels.at(-1);
    const buffTotal = preserveEffectIds(
        [compactObject({ ...formatEffect(rawShadow.buff), id: shadowBuffTotalId(shadowId) })],
        existingEntry?.buff_total ? [existingEntry.buff_total] : [],
    )[0];

    return {
        shadow_id: shadowId,
        shadow_name: cleanName(rawShadow.name),
        time: fallbackTime,
        element_upper: normalizeElements(lastRegular?.damage_type1 ?? []),
        element_lower: normalizeElements(lastRegular?.damage_type2 ?? []),
        element_star: normalizeElements(star?.damage_type ?? []),
        boss_features: {
            upper: preserveEffectIds(
                formatEffectList(lastRegular?.boss_monster_config1?.tag_list ?? []),
                existingEntry?.boss_features?.upper,
            ),
            lower: preserveEffectIds(
                formatEffectList(lastRegular?.boss_monster_config2?.tag_list ?? []),
                existingEntry?.boss_features?.lower,
            ),
            star: preserveEffectIds(
                formatEffectList(star?.boss_monster_config?.tag_list ?? []),
                existingEntry?.boss_features?.star,
            ),
        },
        floors: levels.map(function (level, index) {
            const floorNumber = index + 1;
            const levelNumber = level.event_id_list1[0].level;

            return {
                floor: floorNumber,
                level: levelNumber,
                upper: [makeStage(level.event_id_list1[0], levelNumber, floorNumber, monsterStats, statResolver)],
                lower: [makeStage(level.event_id_list2[0], levelNumber, floorNumber, monsterStats, statResolver)],
                star:
                    floorNumber === 4 && star
                        ? [makeStage(star.event_id_list[0], star.event_id_list[0].level, floorNumber, monsterStats, statResolver)]
                        : [],
            };
        }),
        buff_total: buffTotal,
        buff: {
            upper: preserveEffectIds(formatEffectList(rawShadow.buff_list1 ?? []), existingEntry?.buff?.upper),
            lower: preserveEffectIds(formatEffectList(rawShadow.buff_list2 ?? []), existingEntry?.buff?.lower),
            star: preserveEffectIds(formatEffectList(rawShadow.buff_list3 ?? []), existingEntry?.buff?.star),
        },
    };
}

function mergeEntries(localEntries, generatedEntries) {
    const byId = new Map();

    localEntries.forEach(function (item) {
        byId.set(toNumber(item.entry.shadow_id), clone(item.entry));
    });
    generatedEntries.forEach(function (entry) {
        byId.set(toNumber(entry.shadow_id), clone(entry));
    });

    return Array.from(byId.values()).sort(function (left, right) {
        return toNumber(right.shadow_id) - toNumber(left.shadow_id);
    });
}

function makeIndex(entries, existingIndex) {
    return {
        monster_catalog: existingIndex.monster_catalog ?? "monster_catalog.json",
        entries: entries.map(entryFileName),
    };
}

function localEntry(localEntries, shadowId) {
    return localEntries.find(function (item) {
        return toNumber(item.entry.shadow_id) === shadowId;
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

async function loadForcedShadows(baseUrl, forceIds) {
    const targets = [];

    for (const shadowId of forceIds) {
        const rawShadow = await fetchOptionalShadow(baseUrl, shadowId);
        if (!isValidShadowData(rawShadow)) throw new Error(`指定末日幻影 ${shadowId} 不存在。`);
        targets.push({ shadowId, rawShadow });
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
    const latestShadowId = maxShadowId(localEntries);
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
              siteUrl: `https://hsr.nanoka.cc/boss/${latestShadowId}`,
              hasData: async function (baseUrl) {
                  const [rawCurrent, rawNext] = await Promise.all([
                      fetchOptionalShadow(baseUrl, latestShadowId),
                      fetchOptionalShadow(baseUrl, latestShadowId + 1),
                  ]);

                  return isValidShadowData(rawCurrent) || isValidShadowData(rawNext);
              },
          });

    console.log(`配置版本：${versionState.configuredVersion}`);
    console.log(`远端版本：${versionState.latestVersion}`);

    if (!cliOptions.forceIds.length && !versionState.changed) {
        console.log("Nanoka 版本未变化，跳过末日幻影更新。");
        return;
    }

    const tables = await loadNanokaTables(versionState.latestBaseUrl);
    const statResolver = createNanokaStatResolver(tables);
    const monsterStats = collectMonsterStats(localEntryValues);
    const targets = cliOptions.forceIds.length
        ? await loadForcedShadows(versionState.latestBaseUrl, cliOptions.forceIds)
        : versionState.changeType === "major"
          ? [{ shadowId: latestShadowId + 1, rawShadow: await fetchOptionalShadow(versionState.latestBaseUrl, latestShadowId + 1) }]
          : [{ shadowId: latestShadowId, rawShadow: await fetchOptionalShadow(versionState.latestBaseUrl, latestShadowId) }];

    const generatedEntries = [];

    targets.forEach(function (target) {
        if (!isValidShadowData(target.rawShadow)) {
            throw new Error(`远端没有末日幻影 ${target.shadowId} 数据。`);
        }

        const fallbackTime = fallbackTimeForId(
            target.shadowId,
            localEntryValues.concat(generatedEntries),
            "shadow_id",
            config.defaultDurationDays,
        );
        const current = localEntry(localEntries, target.shadowId);
        const generated = makeShadowEntry(
            target.shadowId,
            target.rawShadow,
            current,
            monsterStats,
            statResolver,
            fallbackTime,
        );

        if (!sameEntry(generated, current)) {
            generatedEntries.push(generated);
        }
    });

    if (!generatedEntries.length) {
        updateNanokaBaseUrlConfig(configPath, versionState.latestBaseUrl, cliOptions.dryRun);
        console.log("末日幻影数据无变化。");
        return;
    }

    const allEntries = mergeEntries(localEntries, generatedEntries);
    const index = makeIndex(allEntries, localProject.index);
    const monsterCatalog = makeMonsterCatalog(allEntries, localProject.monsterCatalog, tables.monsterInfos, config.imagesDir);

    if (config.downloadMissingMonsterImages) {
        await downloadMissingMonsterImages(
            allEntries,
            tables.monsterInfos,
            config.imagesDir,
            config.nanokaImageBaseUrl,
            cliOptions.dryRun,
        );
    }

    writeProjectData(config.dataDir, index, monsterCatalog, generatedEntries, cliOptions.dryRun);
    updateNanokaBaseUrlConfig(configPath, versionState.latestBaseUrl, cliOptions.dryRun);

    generatedEntries.forEach(function (entry) {
        console.log(`已处理：${entry.shadow_id} ${entry.shadow_name}`);
    });
}

await main().catch(function (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
});


