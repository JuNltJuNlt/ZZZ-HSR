import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    cleanName,
    downloadImages,
    extractKeyedArray,
    fetchFirstJson,
    firstValue,
    iconFileName,
    idFromEntry,
    loadConfig,
    normalizeElement,
    normalizePathName,
    parseArgs,
    rarityStars,
    readJson,
    resolveProjectPath,
    resolveStaticBaseUrl,
    toNumber,
    uniqueBy,
    writeJsonFile,
} from "../lib/static-update-common.mjs";
import { displayVersionLabel } from "../lib/nanoka-version.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "catalog-update-config.json");

function printHelp() {
    console.log(`用法：
  node update_tools/catalog/update-character-lightcone-relic.mjs
  node update_tools/catalog/update-character-lightcone-relic.mjs --dry-run
  node update_tools/catalog/update-character-lightcone-relic.mjs --base https://static.nanoka.cc/hsr/4.3.55
  node update_tools/catalog/update-character-lightcone-relic.mjs --no-images`);
}

function avatarSources(baseUrl) {
    return [`${baseUrl}/character.json`, `${baseUrl}/zh/avatar/avatar.json`, `${baseUrl}/avatar/avatar.json`, `${baseUrl}/avatar.json`];
}

function lightconeSources(baseUrl) {
    return [
        `${baseUrl}/lightcone.json`,
        `${baseUrl}/zh/equipment/equipment.json`,
        `${baseUrl}/zh/lightcone/lightcone.json`,
        `${baseUrl}/equipment/equipment.json`,
        `${baseUrl}/equipment.json`,
    ];
}

function relicSources(baseUrl) {
    return [`${baseUrl}/relicset.json`, `${baseUrl}/zh/relic/relic.json`, `${baseUrl}/relic/relic.json`, `${baseUrl}/relic.json`];
}

function statValue(entry, names) {
    const stats = firstValue(entry, ["stats", "Stats", "status", "Status"], entry);
    return toNumber(firstValue(stats, names, 0), 0);
}

function releaseValue(entry, existing) {
    return toNumber(firstValue(entry, ["release", "Release", "release_time", "ReleaseTime"], existing?.release), undefined);
}

function versionValue(entry, existing) {
    return firstValue(entry, ["ver", "version", "Version"], existing?.ver);
}

function itemName(entry, fallbackId) {
    return cleanName(firstValue(entry, ["name", "Name", "zh", "cn", "title", "Title"], fallbackId));
}

function byIdMap(items) {
    return new Map(items.map((item) => [String(item.id), item]));
}

function transformCharacter(entry, fallbackIndex, existingById, context) {
    const id = idFromEntry(entry, fallbackIndex);
    const existing = existingById.get(String(id));
    const icon = existing?.icon ?? `${id}.webp`;
    const version = versionValue(entry, existing) ?? (context.newIds.has(String(id)) ? context.newVersion : undefined);

    return {
        id: toNumber(id),
        ...(releaseValue(entry, existing) ? { release: releaseValue(entry, existing) } : {}),
        name: itemName(entry, id),
        rarity: rarityStars(firstValue(entry, ["rarity", "Rarity", "rank", "Rank"], existing?.rarity)),
        element: normalizeElement(firstValue(entry, ["element", "Element", "damage_type", "DamageType", "damageType"], existing?.element)),
        path: normalizePathName(firstValue(entry, ["path", "Path", "base_type", "BaseType", "baseType"], existing?.path)),
        icon,
        ...(toNumber(firstValue(entry, ["sp", "SP", "energy", "Energy"], existing?.sp), 0) ? {
            sp: toNumber(firstValue(entry, ["sp", "SP", "energy", "Energy"], existing?.sp), 0),
        } : {}),
        stats: {
            HP: statValue(entry, ["HP", "hp", "MaxHP", "max_hp"]) || existing?.stats?.HP || 0,
            ATK: statValue(entry, ["ATK", "atk", "Attack", "attack"]) || existing?.stats?.ATK || 0,
            DEF: statValue(entry, ["DEF", "def", "Defence", "defence"]) || existing?.stats?.DEF || 0,
            SPD: statValue(entry, ["SPD", "spd", "Speed", "speed"]) || existing?.stats?.SPD || 0,
            Aggro: statValue(entry, ["Aggro", "aggro", "Taunt", "taunt"]) || existing?.stats?.Aggro || 0,
        },
        ...(version ? { ver: version } : {}),
    };
}

function transformLightcone(entry, fallbackIndex, existingById) {
    const id = idFromEntry(entry, fallbackIndex);
    const existing = existingById.get(String(id));
    const icon = existing?.icon ?? `${id}.webp`;

    return {
        id: toNumber(id),
        ...(releaseValue(entry, existing) ? { release: releaseValue(entry, existing) } : {}),
        name: itemName(entry, id),
        rarity: rarityStars(firstValue(entry, ["rarity", "Rarity", "rank", "Rank"], existing?.rarity)),
        path: normalizePathName(firstValue(entry, ["path", "Path", "base_type", "BaseType", "baseType"], existing?.path)),
        icon,
        stats: {
            HP: statValue(entry, ["HP", "hp", "MaxHP", "max_hp"]) || existing?.stats?.HP || 0,
            ATK: statValue(entry, ["ATK", "atk", "Attack", "attack"]) || existing?.stats?.ATK || 0,
            DEF: statValue(entry, ["DEF", "def", "Defence", "defence"]) || existing?.stats?.DEF || 0,
        },
        ...(versionValue(entry, existing) ? { ver: versionValue(entry, existing) } : {}),
    };
}

function transformRelic(entry, fallbackIndex, existingById) {
    const id = idFromEntry(entry, fallbackIndex);
    const existing = existingById.get(String(id));
    const icon = existing?.icon ?? iconFileName(entry, firstValue(entry, ["icon_id", "IconID"], id));
    const set = firstValue(entry, ["set", "Set"], null);
    const rawSkills = set
        ? Object.values(set).map((item) => firstValue(item, ["zh", "desc", "Desc", "description", "Description"], ""))
        : firstValue(entry, ["skills", "Skills", "desc", "Desc", "description", "Description"], existing?.skills ?? []);
    const skills = Array.isArray(rawSkills) ? rawSkills : [rawSkills].filter(Boolean);

    return {
        id: toNumber(id),
        name: itemName(entry, id),
        icon,
        skills: skills.map(String),
    };
}

function sortLightcones(items) {
    return [...items].sort(function (a, b) {
        const aSpecial = a.id >= 24000 && a.id <= 24006;
        const bSpecial = b.id >= 24000 && b.id <= 24006;

        if (aSpecial !== bSpecial) return aSpecial ? 1 : -1;
        if (aSpecial && bSpecial) return b.id - a.id;
        return toNumber(b.release) - toNumber(a.release) || b.rarity - a.rarity || b.id - a.id;
    });
}

function versionRank(item) {
    const match = String(item.ver ?? "").match(/^(\d+)\.(\d+)/);
    if (!match) return 0;
    return Number(match[1]) * 100 + Number(match[2]);
}

function sortCharacters(items) {
    return [...items].sort(function (a, b) {
        const versionDiff = versionRank(b) - versionRank(a);
        if (versionDiff) return versionDiff;

        const releaseDiff = toNumber(b.release, -1) - toNumber(a.release, -1);
        if (releaseDiff) return releaseDiff;

        if (versionRank(a)) return toNumber(a.id) - toNumber(b.id);
        return toNumber(b.id) - toNumber(a.id);
    });
}

function buildChineseBannerIndex(characterItems, banners) {
    const bannerCharacterIds = new Set(
        banners.flatMap(function (banner) {
            return banner.phases.flatMap(function (phase) {
                return [...phase.five_star, ...phase.four_star].map(function (item) {
                    return Number(item.id);
                });
            });
        }),
    );
    const index = {};

    for (const character of characterItems) {
        if (!character.name || character.name === "{NICKNAME}") continue;

        const existingId = index[character.name];
        if (
            existingId === undefined ||
            (!bannerCharacterIds.has(Number(existingId)) && bannerCharacterIds.has(Number(character.id)))
        ) {
            index[character.name] = Number(character.id);
        }
    }

    index["\u5f00\u62d3\u8005"] = 8004;
    return index;
}

function syncChineseBannerIndex(configPath, config, characterItems, dryRun) {
    const bannerFile = resolveProjectPath(configPath, config.bannerFile ?? "../../data/banner/banner.json");
    const bannerData = readJson(bannerFile, { banners: [], index: {} });
    const index = buildChineseBannerIndex(characterItems, bannerData.banners ?? []);

    if (dryRun) {
        console.log(`dry-run\uff1a\u5361\u6c60\u4e2d\u6587\u7d22\u5f15\u5c06\u66f4\u65b0\u4e3a ${Object.keys(index).length} \u6761`);
        return;
    }

    bannerData.index = index;
    writeJsonFile(bannerFile, bannerData);
    console.log(`\u5df2\u66f4\u65b0\u5361\u6c60\u4e2d\u6587\u7d22\u5f15\uff1a${Object.keys(index).length} \u6761`);
}

function transformList(
    rawItems,
    existingItems,
    transform,
    sortFn,
    filterItem = function () { return true; },
    newVersion = "",
) {
    const existingById = byIdMap(existingItems);
    const candidateNewIds = new Set(
        rawItems
            .map(function (entry, index) {
                return idFromEntry(entry, index);
            })
            .filter(function (id) {
                return id && !existingById.has(String(id));
            })
            .map(String),
    );
    const items = sortFn(
        uniqueBy(
            rawItems
                .map(function (entry, index) {
                    return transform(entry, index, existingById, { newIds: candidateNewIds, newVersion });
                })
                .filter(function (item) {
                    return item.id && item.name && filterItem(item);
                }),
            function (item) {
                return String(item.id);
            },
        ),
    );

    return {
        items,
        newIds: new Set(
            items
                .filter(function (item) {
                    return candidateNewIds.has(String(item.id));
                })
                .map(function (item) {
                    return String(item.id);
                }),
        ),
    };
}

function characterImageGroups(imageBaseUrl, imagesDir) {
    return [
        {
            label: "character_artwork",
            imagesDir: path.join(imagesDir, "character_artwork"),
            imageUrls: function (item) {
                return [`${imageBaseUrl}/avatardrawcard/${item.id}.webp`];
            },
        },
        {
            label: "character_icon_default",
            imagesDir: path.join(imagesDir, "character_icon_default"),
            imageUrls: function (item) {
                return [`${imageBaseUrl}/avataricon/avatar/${item.id}.webp`];
            },
        },
        {
            label: "character_icon_shop",
            imagesDir: path.join(imagesDir, "character_icon_shop"),
            imageUrls: function (item) {
                return [`${imageBaseUrl}/avatarshopicon/${item.id}.webp`];
            },
        },
        {
            label: "character_icon_round",
            imagesDir: path.join(imagesDir, "character_icon_round"),
            imageUrls: function (item) {
                return [`${imageBaseUrl}/avatarroundicon/${item.id}.webp`];
            },
        },
    ];
}

async function loadLightconeShopUrls(apiUrl) {
    const response = await fetch(apiUrl, {
        headers: {
            Origin: "https://act.mihoyo.com",
            Referer: "https://act.mihoyo.com/",
        },
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
        throw new Error(`米哈游光锥图标接口请求失败：${response.status}`);
    }

    const result = await response.json();
    if (result.retcode !== 0 || !Array.isArray(result.data?.list)) {
        throw new Error(`米哈游光锥图标接口返回异常：${result.message ?? result.retcode}`);
    }

    return new Map(
        result.data.list.map(function (item) {
            return [String(item.item_id), item.item_url];
        }),
    );
}

function lightconeImageGroups(imageBaseUrl, imagesDir, context) {
    return [
        {
            label: "lightcone_artwork",
            imagesDir: path.join(imagesDir, "lightcone_artwork"),
            imageUrls: function (item) {
                return [`${imageBaseUrl}/lightconemaxfigures/${item.id}.webp`];
            },
        },
        {
            label: "lightcone_icon_default",
            imagesDir: path.join(imagesDir, "lightcone_icon_default"),
            imageUrls: function (item) {
                return [`${imageBaseUrl}/lightconemediumicon/${item.id}.webp`];
            },
        },
        {
            label: "lightcone_icon_shop",
            imagesDir: path.join(imagesDir, "lightcone_icon_shop"),
            imageUrls: function (item) {
                const url = context.lightconeShopUrls.get(String(item.id));
                return url ? [url] : [];
            },
            fileName: function (item) {
                return `${item.id}.png`;
            },
        },
    ];
}

function relicImageUrls(imageBaseUrl, item) {
    return [
        `${imageBaseUrl}/relic/${item.icon}`,
        `${imageBaseUrl}/relic/${item.id}.webp`,
        `${imageBaseUrl}/item/${item.icon}`,
        `${imageBaseUrl}/itemicon/${item.icon}`,
    ];
}

async function updateOne({
    key,
    title,
    sources,
    dataFile,
    imagesDir,
    existingFallback,
    extractKeys,
    transform,
    sortFn,
    filterItem,
    imageUrls,
    imageGroups,
    newVersion,
}) {
    const remote = await fetchFirstJson(sources);
    const rawItems = extractKeyedArray(remote.value, extractKeys);
    const existingItems = readJson(dataFile, existingFallback);
    const transformed = transformList(rawItems, existingItems, transform, sortFn, filterItem, newVersion);
    const items = transformed.items;
    const newIds = transformed.newIds;

    console.log(`${title}数据源：${remote.url}`);
    console.log(`${title}数量：${items.length}`);
    console.log(`${title}新增 ID：${newIds.size ? Array.from(newIds).join(", ") : "无"}`);

    return { key, items, newIds, imagesDir, imageUrls, imageGroups, dataFile };
}

function updateHomeFeatured(configPath, config, updates, displayVersion, dryRun) {
    const characterUpdate = updates.find(function (update) {
        return update.key === "character";
    });
    const lightconeUpdate = updates.find(function (update) {
        return update.key === "lightcone";
    });
    const characterIds = characterUpdate.items
        .filter(function (item) {
            return characterUpdate.newIds.has(String(item.id));
        })
        .map(function (item) {
            return item.id;
        });
    const lightconeIds = lightconeUpdate.items
        .filter(function (item) {
            return lightconeUpdate.newIds.has(String(item.id));
        })
        .map(function (item) {
            return item.id;
        });

    if (!characterIds.length && !lightconeIds.length) {
        console.log("人物和光锥都没有新增，首页推荐保持不变。");
        return;
    }

    const homeFile = resolveProjectPath(configPath, config.homeFile ?? "../../data/home/home.json");
    const homeConfig = readJson(homeFile, {});
    const currentFeatured = homeConfig.homeData?.featured ?? {};
    homeConfig.homeData = homeConfig.homeData ?? {};
    homeConfig.homeData.featured = {
        ...currentFeatured,
        version: displayVersion || currentFeatured.version,
        characters: characterIds,
        lightcones: lightconeIds,
    };

    if (dryRun) {
        console.log(
            `dry-run：首页推荐将更新为 ${displayVersion}；人物 ${characterIds.join(", ") || "无"}；光锥 ${lightconeIds.join(", ") || "无"}`,
        );
        return;
    }

    writeJsonFile(homeFile, homeConfig);
    console.log(`已更新首页推荐：${displayVersion}`);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const config = loadConfig(configPath, options);
    const baseUrl = await resolveStaticBaseUrl(configPath, config, options.dryRun);
    const displayVersion = displayVersionLabel(baseUrl);
    const newVersion = displayVersion.replace(/v\d+$/i, "");
    const characterFile = resolveProjectPath(configPath, config.characterFile);
    const lightconeFile = resolveProjectPath(configPath, config.lightconeFile);
    const relicFile = resolveProjectPath(configPath, config.relicFile);

    const updates = await Promise.all([
        updateOne({
            key: "character",
            title: "角色",
            sources: avatarSources(baseUrl),
            dataFile: characterFile,
            imagesDir: resolveProjectPath(configPath, config.characterImagesDir),
            existingFallback: [],
            extractKeys: ["avatars", "avatar", "characters", "items"],
            transform: transformCharacter,
            sortFn: sortCharacters,
            filterItem: function (item) {
                return item.id !== 1011;
            },
            imageGroups: characterImageGroups,
            newVersion,
        }),
        updateOne({
            key: "lightcone",
            title: "光锥",
            sources: lightconeSources(baseUrl),
            dataFile: lightconeFile,
            imagesDir: resolveProjectPath(configPath, config.lightconeImagesDir),
            existingFallback: [],
            extractKeys: ["equipment", "lightcones", "items"],
            transform: transformLightcone,
            sortFn: sortLightcones,
            imageGroups: lightconeImageGroups,
            newVersion,
        }),
        updateOne({
            key: "relic",
            title: "遗器",
            sources: relicSources(baseUrl),
            dataFile: relicFile,
            imagesDir: resolveProjectPath(configPath, config.relicImagesDir),
            existingFallback: [],
            extractKeys: ["relics", "relic", "items"],
            transform: transformRelic,
            sortFn: function (items) {
                return [...items].sort((a, b) => b.id - a.id);
            },
            imageUrls: relicImageUrls,
            newVersion,
        }),
    ]);

    if (!options.dryRun) {
        for (const update of updates) {
            writeJsonFile(update.dataFile, update.items);
        }
    }

    const characterUpdate = updates.find(function (update) {
        return update.key === "character";
    });
    syncChineseBannerIndex(configPath, config, characterUpdate.items, options.dryRun);

    updateHomeFeatured(configPath, config, updates, displayVersion, options.dryRun);

    if (config.downloadImages) {
        const imageContext = {
            lightconeShopUrls: await loadLightconeShopUrls(config.lightconeShopApiUrl),
        };

        for (const update of updates) {
            const imageGroups = update.imageGroups
                ? update.imageGroups(config.nanokaImageBaseUrl, update.imagesDir, imageContext)
                : [
                      {
                          label: path.basename(update.imagesDir),
                          imagesDir: update.imagesDir,
                          imageUrls: function (item) {
                              return update.imageUrls(config.nanokaImageBaseUrl, item);
                          },
                      },
                  ];

            for (const group of imageGroups) {
                const result = await downloadImages(
                    update.items,
                    group.imageUrls,
                    function (item) {
                        const fileName = group.fileName ? group.fileName(item) : item.icon;
                        return path.join(group.imagesDir, fileName);
                    },
                    options.dryRun,
                );
                console.log(`图片 ${group.label}：下载 ${result.downloaded}，缺失 ${result.missing}`);
                if (result.missingItems.length) {
                    console.log(`  缺失 ID：${result.missingItems.map(function (item) { return item.id; }).join(", ")}`);
                }
            }
        }
    }
}

main().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
