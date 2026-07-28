import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    asArray,
    cleanName,
    downloadImages,
    extractArray,
    extractKeyedArray,
    fetchFirstJson,
    firstValue,
    idFromEntry,
    loadConfig,
    normalizeElements,
    parseArgs,
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
const configPath = path.join(__dirname, "monster-update-config.json");

function printHelp() {
    console.log(`用法：
  node update_tools/monster/update-monsters.mjs
  node update_tools/monster/update-monsters.mjs --dry-run
  node update_tools/monster/update-monsters.mjs --base https://static.nanoka.cc/hsr/4.3.55
  node update_tools/monster/update-monsters.mjs --no-images`);
}

function monsterSources(baseUrl) {
    return [
        `${baseUrl}/zh/monster/monster.json`,
        `${baseUrl}/monster/monster.json`,
        `${baseUrl}/monster.json`,
    ];
}

function baseMonsterId(id) {
    return String(id ?? "").replace(/\D/g, "").slice(0, 7);
}

function monsterIconName(entry, id, existing) {
    const rawIcon = firstValue(entry, ["icon", "Icon", "image", "Image", "figure", "Figure"], "");
    if (rawIcon) {
        const baseName = path.posix.basename(String(rawIcon), path.posix.extname(String(rawIcon)));
        if (baseName.endsWith("_Unknown")) {
            return existing?.icon ?? "BossIconTemporary.webp";
        }
        return `${baseName}.webp`;
    }
    return existing?.icon ?? `Monster_${baseMonsterId(id)}.webp`;
}

function rankLabel(entry) {
    return firstValue(entry, ["rank_label", "rankLabel", "RankLabel", "rank_name", "RankName"], "");
}

function campId(entry) {
    const value = firstValue(entry, ["camp", "Camp", "camp_id", "CampID", "faction", "Faction"], "none");
    return String(value ?? "none");
}

function campLabel(entry, categoryByValue) {
    return (
        firstValue(entry, ["camp_label", "campLabel", "CampLabel", "camp_name", "CampName", "faction_name", "FactionName"], "") ||
        categoryByValue.get(campId(entry)) ||
        "其他"
    );
}

function children(entry, id) {
    const rawChildren = firstValue(entry, ["children", "child", "Child", "monster_list", "MonsterList"], []);
    const childIds = asArray(rawChildren)
        .map(function (item) {
            return toNumber(firstValue(item, ["id", "Id", "ID"], item), 0);
        })
        .filter(Boolean);

    return childIds.length ? childIds : [toNumber(id)];
}

function monsterName(entry, id) {
    return cleanName(firstValue(entry, ["name", "Name", "zh", "cn", "title", "Title"], id));
}

function transformMonster(entry, fallbackIndex, categoryByValue, existingById) {
    const id = idFromEntry(entry, fallbackIndex);
    const existing = existingById.get(String(id));

    return {
        id,
        name: monsterName(entry, id),
        rank: String(firstValue(entry, ["rank", "Rank", "type", "Type"], "")),
        rank_label: rankLabel(entry),
        camp: campId(entry),
        camp_label: campLabel(entry, categoryByValue),
        weak: normalizeElements(firstValue(entry, ["weak", "Weak", "weakness", "Weakness", "elements", "Elements"], [])),
        icon: monsterIconName(entry, id, existing),
        children: children(entry, id),
    };
}

function buildCategories(existingCategories, monsters) {
    const categories = [{ value: "all", label: "全部" }];
    const known = new Map(existingCategories.map((item) => [String(item.value), item.label]));

    for (const monster of monsters) {
        if (monster.camp === "all") continue;
        if (!known.has(monster.camp)) known.set(monster.camp, monster.camp_label || monster.camp);
    }

    for (const [value, label] of known.entries()) {
        if (value === "all") continue;
        categories.push({ value, label });
    }

    return categories;
}

function imageUrls(imageBaseUrl, monster) {
    const baseId = baseMonsterId(monster.id);
    return [
        `${imageBaseUrl}/monsterfigure/${monster.icon}`,
        `${imageBaseUrl}/monsterfigure/Monster_${baseId}.webp`,
        `${imageBaseUrl}/monsterfigure/Monster_${baseId}.png`,
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
    const existing = readJson(dataFile, { categories: [], monsters: [] });
    const categoryByValue = new Map((existing.categories ?? []).map((item) => [String(item.value), item.label]));
    const existingById = new Map((existing.monsters ?? []).map((item) => [String(item.id), item]));
    const remote = await fetchFirstJson(monsterSources(baseUrl));
    const rawMonsters = extractKeyedArray(remote.value, ["monsters", "monster", "Monster"]);
    const monsters = sortByNumberDesc(
        uniqueBy(
            rawMonsters
                .map(function (entry, index) {
                    return transformMonster(entry, index, categoryByValue, existingById);
                })
                .filter(function (monster) {
                    return monster.id && monster.name;
                }),
            function (monster) {
                return monster.id;
            },
        ),
    );
    const data = {
        categories: buildCategories(existing.categories ?? [], monsters),
        monsters,
    };

    console.log(`怪物数据源：${remote.url}`);
    console.log(`怪物数量：${monsters.length}`);

    if (!options.dryRun) {
        writeJsonFile(dataFile, data);
    }

    if (config.downloadImages) {
        const result = await downloadImages(
            monsters,
            function (monster) {
                return imageUrls(config.nanokaImageBaseUrl, monster);
            },
            function (monster) {
                return path.join(imagesDir, monster.icon);
            },
            options.dryRun,
        );
        console.log(`怪物图片：下载 ${result.downloaded}，缺失 ${result.missing}`);
        if (result.missingItems.length) {
            console.log("缺失怪物图片：");
            result.missingItems.forEach(function (monster) {
                console.log(`- ${monster.id} ${monster.name} -> ${monster.icon}`);
            });
        }
    }
}

main().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
