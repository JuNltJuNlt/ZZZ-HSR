import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    cleanName,
    downloadImages,
    extractArray,
    extractKeyedArray,
    fetchFirstJson,
    firstValue,
    idFromEntry,
    loadConfig,
    parseArgs,
    rarityLabel,
    rarityStars,
    readJson,
    resolveProjectPath,
    resolveStaticBaseUrl,
    sortByNumberDesc,
    toNumber,
    uniqueBy,
    writeJsonFile,
} from "../lib/static-update-common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "item-update-config.json");

function printHelp() {
    console.log(`用法：
  node update_tools/item/update-items.mjs
  node update_tools/item/update-items.mjs --dry-run
  node update_tools/item/update-items.mjs --base https://static.nanoka.cc/hsr/4.3.55
  node update_tools/item/update-items.mjs --no-images`);
}

function itemSources(baseUrl) {
    return [`${baseUrl}/zh/item.json`, `${baseUrl}/zh/item/item.json`, `${baseUrl}/item/item.json`, `${baseUrl}/item.json`];
}

function existingLabelMap(items) {
    return new Map((items ?? []).map((item) => [String(item.value), item.label]));
}

function rarityValue(entry, stars) {
    return String(firstValue(entry, ["rarity", "Rarity", "rank", "Rank"], stars >= 5 ? "SuperRare" : stars >= 4 ? "VeryRare" : "Rare"));
}

function purposeValue(entry) {
    return String(firstValue(entry, ["purpose", "Purpose", "purpose_id", "PurposeID", "purpose_type", "PurposeType", "type", "Type"], "none"));
}

function transformItem(entry, fallbackIndex, existingPurposeLabels) {
    const id = idFromEntry(entry, fallbackIndex);
    const stars = rarityStars(firstValue(entry, ["stars", "Stars", "rarity", "Rarity", "rank", "Rank"], 0));
    const purpose = purposeValue(entry);
    const rarity = rarityValue(entry, stars);

    const item = {
        id,
        name: cleanName(firstValue(entry, ["name", "Name", "zh", "item_name", "ItemName", "title", "Title"], id)),
        sub_type: String(firstValue(entry, ["sub_type", "subType", "SubType", "item_sub_type", "ItemSubType"], "")),
        purpose,
        purpose_label: firstValue(entry, ["purpose_label", "purposeLabel", "PurposeLabel", "purpose_name", "PurposeName"], existingPurposeLabels.get(purpose) ?? purpose),
        rarity,
        rarity_label: firstValue(entry, ["rarity_label", "rarityLabel", "RarityLabel"], rarityLabel(stars)),
        stars,
        icon: `${id}.webp`,
    };

    const sourceIcon = itemSourceIconName(entry);
    if (sourceIcon && sourceIcon !== item.icon) {
        Object.defineProperty(item, "sourceIcon", {
            value: sourceIcon,
            enumerable: false,
        });
    }

    return item;
}

function itemSourceIconName(entry) {
    const rawIcon = firstValue(entry, ["icon", "Icon", "item_figure_icon_path", "ItemFigureIconPath"], "");
    if (!rawIcon) return "";

    const baseName = path.posix.basename(String(rawIcon), path.posix.extname(String(rawIcon)));
    return `${baseName}.webp`;
}

function buildPurposes(existingPurposes, items) {
    const known = existingLabelMap(existingPurposes);

    for (const item of items) {
        if (!known.has(item.purpose)) known.set(item.purpose, item.purpose_label);
    }

    return [...known.entries()]
        .map(([value, label]) => ({ value, label }))
        .filter((item) => item.value !== "all")
        .sort((a, b) => toNumber(a.value, 9999) - toNumber(b.value, 9999));
}

function buildRarities(items) {
    const byRarity = new Map();

    for (const item of items) {
        if (!byRarity.has(item.rarity)) {
            byRarity.set(item.rarity, {
                value: item.rarity,
                label: item.rarity_label || rarityLabel(item.stars),
                stars: item.stars,
            });
        }
    }

    return [...byRarity.values()].sort((a, b) => b.stars - a.stars);
}

function itemImageUrls(imageBaseUrl, item) {
    const icons = [...new Set([item.sourceIcon, item.icon].filter(Boolean))];
    const urls = icons.flatMap((icon) => [
        `${imageBaseUrl}/item/${icon}`,
        `${imageBaseUrl}/itemicon/${icon}`,
        `${imageBaseUrl}/itemfigures/${icon}`,
    ]);

    return [
        ...urls,
        `${imageBaseUrl}/item/${item.id}.webp`,
        `${imageBaseUrl}/itemicon/${item.id}.webp`,
        `${imageBaseUrl}/itemfigures/${item.id}.webp`,
    ];
}

function removeUnreferencedImages(imagesDir, items, dryRun) {
    if (!fs.existsSync(imagesDir)) return 0;

    const referenced = new Set(items.map((item) => item.icon));
    let removed = 0;

    for (const file of fs.readdirSync(imagesDir, { withFileTypes: true })) {
        if (!file.isFile() || referenced.has(file.name)) continue;
        removed += 1;

        if (!dryRun) {
            fs.unlinkSync(path.join(imagesDir, file.name));
        }
    }

    return removed;
}

function mergeById(remoteItems, existingItems) {
    const remoteIds = new Set(remoteItems.map((item) => String(item.id)));
    return [
        ...remoteItems,
        ...existingItems.filter(function (item) {
            return !remoteIds.has(String(item.id));
        }),
    ];
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const config = loadConfig(configPath, options);
    const baseUrl = await resolveStaticBaseUrl(configPath, config, options.dryRun);
    const dataFile = resolveProjectPath(configPath, config.dataFile);
    const imagesDir = resolveProjectPath(configPath, config.imagesDir);
    const existing = readJson(dataFile, { purposes: [], rarities: [], items: [] });
    const purposeLabels = existingLabelMap(existing.purposes);
    const remote = await fetchFirstJson(itemSources(baseUrl));
    const rawItems = extractKeyedArray(remote.value, ["items", "item", "Items"]);
    const remoteItems = sortByNumberDesc(
        uniqueBy(
            rawItems
                .map(function (entry, index) {
                    return transformItem(entry, index, purposeLabels);
                })
                .filter(function (item) {
                    return item.id && item.name;
                }),
            function (item) {
                return item.id;
            },
        ),
    ).reverse();
    const items = mergeById(remoteItems, existing.items ?? []);

    const data = {
        purposes: buildPurposes(existing.purposes, items),
        rarities: buildRarities(items),
        items,
    };

    console.log(`物品数据源：${remote.url}`);
    console.log(`物品数量：${items.length}`);

    if (!options.dryRun) {
        writeJsonFile(dataFile, data);
    }

    if (config.downloadImages) {
        const result = await downloadImages(
            items,
            function (item) {
                return itemImageUrls(config.nanokaImageBaseUrl, item);
            },
            function (item) {
                return path.join(imagesDir, item.icon);
            },
            options.dryRun,
        );
        const removed = removeUnreferencedImages(imagesDir, items, options.dryRun);
        console.log(`物品图片：下载 ${result.downloaded}，缺失 ${result.missing}`);
        if (removed) {
            console.log(`removed old item images: ${removed}`);
        }

    }
}

main().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
