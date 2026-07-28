import fs from "node:fs";
import path from "node:path";

export const elementNameMap = {
    Physical: "Phys",
    Thunder: "Elec",
};

export function readText(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

export function readJson(filePath) {
    return JSON.parse(readText(filePath));
}

export function writeJsonFile(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`, "utf8");
}

export async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
    return response.json();
}

export async function fetchOptionalJson(url) {
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
    return response.json();
}

export async function fetchBytes(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
    return Buffer.from(await response.arrayBuffer());
}

export function stripTrailingSlash(value) {
    return String(value ?? "").replace(/\/+$/, "");
}

export function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function compactObject(value) {
    return Object.fromEntries(
        Object.entries(value).filter(function ([, item]) {
            return item !== undefined && item !== null && item !== "";
        }),
    );
}

export function toNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function toRatio(value) {
    return toNumber(value, 1);
}

export function round(value) {
    return Math.round(value);
}

export function normalizeElement(elementName) {
    return elementNameMap[elementName] ?? elementName;
}

export function normalizeElements(elements = []) {
    return elements.map(normalizeElement);
}

export function baseMonsterId(monsterId) {
    return Number(String(monsterId ?? "").replace(/\D/g, "").slice(0, 7));
}

export function cleanName(value) {
    return String(value ?? "")
        .replace(/<[^>]*>/g, "")
        .trim();
}

export function trimNumber(value) {
    const rounded = Math.round(Number(value) * 100) / 100;
    if (!Number.isFinite(rounded)) return String(value);
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatParam(value, isPercent) {
    const displayed = isPercent ? Number(value) * 100 : value;
    return `${trimNumber(displayed)}${isPercent ? "%" : ""}`;
}

export function formatDescription(description = "", params = []) {
    return String(description)
        .replace(/#(\d+)\[i\](%?)/g, function (_, rawIndex, percentMark) {
            const param = params[Number(rawIndex) - 1] ?? "";
            return formatParam(param, percentMark === "%");
        })
        .replace(/<color=#f29e38ff>/g, "<color style='color:#f29e38;'>")
        .replace(/<color=#[0-9a-fA-F]+>/g, "<color style='color:#f29e38;'>")
        .replace(/<\/?unbreak>/g, "")
        .replace(/\\n|\n/g, "<br>");
}

export function formatEffect(effect) {
    const source = effect && typeof effect === "object" ? effect : {};
    const extra = (source.child ?? source.extra ?? []).map(formatEffect).filter(hasEffectContent);
    const id = validEffectId(source.id);

    return compactObject({
        id,
        name: cleanName(source.name),
        description: formatDescription(source.desc ?? source.description, source.param ?? []),
        extra: extra.length ? extra : undefined,
    });
}

export function hasEffectContent(effect) {
    return Boolean(effect?.name || effect?.description || effect?.extra?.length);
}

export function formatEffectList(effects = []) {
    return effects.map(formatEffect).filter(hasEffectContent);
}

function validEffectId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : undefined;
}

function findEffectMatch(generated, existingItems, usedIndexes, exactDescription) {
    const generatedName = String(generated?.name ?? "");
    const generatedDescription = String(generated?.description ?? "");

    return existingItems.findIndex(function (existing, index) {
        if (usedIndexes.has(index)) return false;
        if (String(existing?.name ?? "") !== generatedName) return false;
        if (!exactDescription) return Boolean(generatedName);
        return String(existing?.description ?? "") === generatedDescription;
    });
}

export function preserveEffectIds(generatedItems = [], existingItems = []) {
    const sourceItems = Array.isArray(generatedItems) ? generatedItems : [];
    const localItems = Array.isArray(existingItems) ? existingItems : [];
    const usedIndexes = new Set();

    return sourceItems.map(function (generated) {
        let matchIndex = findEffectMatch(generated, localItems, usedIndexes, true);
        if (matchIndex < 0) {
            matchIndex = findEffectMatch(generated, localItems, usedIndexes, false);
        }

        const existing = matchIndex >= 0 ? localItems[matchIndex] : null;
        if (matchIndex >= 0) usedIndexes.add(matchIndex);

        const id = validEffectId(generated?.id) ?? validEffectId(existing?.id);
        const extra = preserveEffectIds(generated?.extra, existing?.extra);
        const { id: ignoredId, extra: ignoredExtra, ...content } = generated;

        return compactObject({
            id,
            ...content,
            extra: extra.length ? extra : undefined,
        });
    });
}

export async function loadNanokaTables(baseUrl) {
    const urls = [
        `${baseUrl}/monstervalue.json`,
        `${baseUrl}/EliteGroup.json`,
        `${baseUrl}/HardLevelGroup.json`,
        `${baseUrl}/monster.json`,
    ];
    const [monsterValues, eliteGroups, hardLevelGroups, monsterInfos] = await Promise.all(urls.map(fetchJson));
    const infiniteEliteGroups = (await fetchOptionalJson(`${baseUrl}/InfiniteEliteGroup.json`)) ?? [];

    return { monsterValues, eliteGroups, infiniteEliteGroups, hardLevelGroups, monsterInfos };
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

export function createNanokaStatResolver(tables) {
    const eliteGroupById = mapBy([...(tables.eliteGroups ?? []), ...(tables.infiniteEliteGroups ?? [])], "EliteGroup");
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
        const level = toNumber(rawStage.level);
        const statusResistanceBonus = level >= 51 ? Math.min((level - 50) * 0.004, 0.1) : 0;
        const statusResistanceBase = Number(monsterValue.StatusResistanceBase);

        return {
            hp,
            speed,
            stance: stanceRaw ? round(stanceRaw / 30) : 0,
            hp_ratio_sum: hpRatioSum,
            hp_coefficient: toRatio(eliteGroup.HPRatio),
            status_res: Number.isFinite(statusResistanceBase)
                ? Math.round((statusResistanceBase + statusResistanceBonus) * 1000) / 1000
                : undefined,
        };
    };
}

export function collectMonsterStats(value) {
    const byId = new Map();
    const byIdAndLevel = new Map();

    function visit(item, level) {
        if (Array.isArray(item)) {
            item.forEach(function (child) {
                visit(child, level);
            });
            return;
        }
        if (!item || typeof item !== "object") return;

        const currentLevel = item.level ?? level;
        if (item.id !== undefined && item.hp !== undefined) {
            if (!byId.has(item.id)) byId.set(item.id, clone(item));
            if (currentLevel !== undefined) {
                const key = `${item.id}:${currentLevel}`;
                if (!byIdAndLevel.has(key)) byIdAndLevel.set(key, clone(item));
            }
        }

        Object.values(item).forEach(function (child) {
            visit(child, currentLevel);
        });
    }

    visit(value);
    return { byId, byIdAndLevel };
}

export function makeMonster(rawId, rawStage, monsterStats, statResolver, extra = {}) {
    const calculated = statResolver(rawStage, rawId);
    if (calculated) {
        const hpRatioSum = calculated.hp_ratio_sum === 1 ? toNumber(extra.hpRatioFallback, 1) : calculated.hp_ratio_sum;

        return compactObject({
            id: rawId,
            hp: calculated.hp,
            speed: calculated.speed,
            stance: calculated.stance,
            hp_ratio_sum: hpRatioSum === 1 ? undefined : hpRatioSum,
            status_res: calculated.status_res,
            number: extra.number,
        });
    }

    const level = rawStage.level;
    const byLevel = monsterStats.byIdAndLevel.get(`${rawId}:${level}`);
    const byId = monsterStats.byId.get(rawId);
    const source = byLevel ?? byId;

    const monster = { ...(source ? clone(source) : {}), id: rawId, number: extra.number };
    if (monster.stance === undefined) monster.stance = 0;

    return compactObject(monster);
}

export function stageMonsterIds(stage) {
    return (stage.monster_list ?? []).map(function (wave) {
        return Object.keys(wave)
            .sort(function (left, right) {
                return Number(left.replace(/\D/g, "")) - Number(right.replace(/\D/g, ""));
            })
            .map(function (key) {
                return wave[key];
            });
    });
}

export function groupedMonsterIds(ids = []) {
    const groups = [];

    ids.forEach(function (id) {
        const existing = groups.find(function (item) {
            return item.id === id;
        });
        if (existing) {
            existing.number += 1;
        } else {
            groups.push({ id, number: 1 });
        }
    });

    return groups.map(function (item) {
        return item.number > 1 ? item : { id: item.id };
    });
}

export function hpCoefficientForStage(stage, statResolver, monsterId) {
    const calculated = statResolver(stage, monsterId);
    const coefficient = calculated?.hp_coefficient;
    return Number.isFinite(coefficient) ? coefficient : undefined;
}

export function nextTimeRange(previousTime, durationDays = 42) {
    const match = String(previousTime ?? "").match(/(\d{4})\/(\d{2})\/(\d{2})\s*-\s*(\d{4})\/(\d{2})\/(\d{2})/);
    if (!match) return previousTime ?? "";

    const end = new Date(Date.UTC(Number(match[4]), Number(match[5]) - 1, Number(match[6])));
    const start = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    const nextEnd = new Date(start.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);

    return `${formatDate(start)} - ${formatDate(nextEnd)}`;
}

function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
}

export function fallbackTimeForId(id, entries, idKey, durationDays) {
    const existing = entries.find(function (entry) {
        return toNumber(entry[idKey]) === id && entry.time;
    });
    if (existing) return existing.time;

    const previous = entries
        .filter(function (entry) {
            return toNumber(entry[idKey]) < id && entry.time;
        })
        .sort(function (left, right) {
            return toNumber(right[idKey]) - toNumber(left[idKey]);
        })[0];

    return nextTimeRange(previous?.time, durationDays);
}

export function sortComparable(value) {
    if (Array.isArray(value)) return value.map(sortComparable);
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

export function sameEntry(left, right) {
    return JSON.stringify(sortComparable(left)) === JSON.stringify(sortComparable(right));
}

export function monsterInfoForId(monsterInfos, id) {
    return monsterInfos[String(id)] ?? monsterInfos[String(baseMonsterId(id))] ?? null;
}

export function monsterFigureFileName(info, id) {
    const iconPath = info?.icon ? path.posix.basename(info.icon) : `Monster_${baseMonsterId(id)}.png`;
    return iconPath.replace(/\.[^.]+$/, ".webp");
}

export function localMonsterFigurePath(info, id) {
    return `monster/${monsterFigureFileName(info, id)}`;
}

export function nanokaMonsterFigureUrl(imageBaseUrl, info, id) {
    return `${imageBaseUrl}/monsterfigure/${monsterFigureFileName(info, id)}`;
}

export function collectUsedMonsterIds(value) {
    const ids = new Set();

    function visit(item) {
        if (Array.isArray(item)) {
            item.forEach(visit);
            return;
        }
        if (!item || typeof item !== "object") return;

        if (item.id !== undefined && item.hp !== undefined) ids.add(String(item.id));
        Object.values(item).forEach(visit);
    }

    visit(value);
    return ids;
}

export function makeMonsterCatalog(entries, existingCatalog, monsterInfos, imagesDir) {
    const usedIds = collectUsedMonsterIds(entries);
    const catalog = {};

    Array.from(usedIds)
        .sort(function (left, right) {
            return toNumber(left) - toNumber(right);
        })
        .forEach(function (id) {
            const info = monsterInfoForId(monsterInfos, id);
            const existing = clone(existingCatalog[String(id)] ?? {});

            if (!existing["1"] || !fs.existsSync(path.join(imagesDir, existing["1"]))) {
                existing["1"] = localMonsterFigurePath(info, id);
            }
            if (!Array.isArray(existing["2"]) || !existing["2"].length) existing["2"] = normalizeElements(info?.weak ?? []);
            if (!existing["3"]) existing["3"] = 1;
            if (!existing["4"] || existing["4"] === "...") existing["4"] = info?.zh ?? String(id);

            // 深渊页面使用具名字段，旧数据工具仍会读取数字字段；两套字段保持同源。
            existing.name = existing["4"];
            existing.icon = existing["1"];
            existing.weakness = clone(existing["2"]);

            catalog[id] = existing;
        });

    return catalog;
}

export async function downloadMissingMonsterImages(entries, monsterInfos, imagesDir, imageBaseUrl, dryRun) {
    const ids = collectUsedMonsterIds(entries);
    const result = { downloaded: 0, existing: 0, failed: 0, failedIds: [] };

    for (const id of ids) {
        const info = monsterInfoForId(monsterInfos, id);
        const relativePath = localMonsterFigurePath(info, id);
        const targetPath = path.join(imagesDir, relativePath);
        if (fs.existsSync(targetPath)) {
            result.existing += 1;
            continue;
        }

        if (dryRun) {
            result.downloaded += 1;
            continue;
        }

        const fileNames = Array.from(
            new Set([monsterFigureFileName(info, id), `Monster_${baseMonsterId(id)}.webp`]),
        );
        let imageData = null;

        for (const fileName of fileNames) {
            try {
                imageData = await fetchBytes(`${imageBaseUrl}/monsterfigure/${fileName}`);
                break;
            } catch {
                // 新怪物偶尔没有完整图标元数据，继续尝试标准文件名。
            }
        }

        if (!imageData) {
            result.failed += 1;
            result.failedIds.push(String(id));
            continue;
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, imageData);
        result.downloaded += 1;
    }

    return result;
}

