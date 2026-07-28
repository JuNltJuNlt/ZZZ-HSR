import fs from "node:fs";
import path from "node:path";
import { fetchNanokaSiteBaseUrl, stripTrailingSlash, updateNanokaBaseUrlConfig } from "./nanoka-version.mjs";

export const elementNameMap = {
    Physical: "Phys",
    Thunder: "Elec",
    Lightning: "Elec",
};

export const pathNameMap = {
    Warrior: "Destruction",
    Knight: "Preservation",
    Rogue: "Hunt",
    Mage: "Erudition",
    Warlock: "Nihility",
    Shaman: "Harmony",
    Priest: "Abundance",
    Memory: "Remembrance",
    Joy: "Elation",
};

export function readJson(filePath, fallback = null) {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

export async function fetchFirstJson(urls) {
    const errors = [];

    for (const url of urls) {
        try {
            const value = await fetchOptionalJson(url);
            if (value !== null) return { url, value };
        } catch (error) {
            errors.push(error.message);
        }
    }

    throw new Error(`没有可用的数据源：\n${urls.join("\n")}\n${errors.join("\n")}`);
}

export function parseArgs(argv) {
    const options = {
        dryRun: false,
        baseUrl: "",
        downloadImages: null,
        help: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === "--help" || arg === "-h") {
            options.help = true;
        } else if (arg === "--dry-run") {
            options.dryRun = true;
        } else if (arg === "--no-images") {
            options.downloadImages = false;
        } else if (arg === "--base") {
            options.baseUrl = argv[index + 1] ?? "";
            index += 1;
        } else if (arg.startsWith("--base=")) {
            options.baseUrl = arg.slice("--base=".length);
        } else {
            throw new Error(`未知参数：${arg}`);
        }
    }

    return options;
}

export function loadConfig(configPath, cliOptions) {
    const fileConfig = readJson(configPath, {});
    return {
        ...fileConfig,
        cliBaseUrl: cliOptions.baseUrl || "",
        nanokaBaseUrl: stripTrailingSlash(cliOptions.baseUrl || fileConfig.nanokaBaseUrl),
        nanokaImageBaseUrl: stripTrailingSlash(fileConfig.nanokaImageBaseUrl ?? "https://static.nanoka.cc/assets/hsr"),
        downloadImages: cliOptions.downloadImages ?? fileConfig.downloadImages ?? true,
    };
}

export async function resolveStaticBaseUrl(configPath, config, dryRun) {
    if (config.cliBaseUrl) {
        return config.nanokaBaseUrl;
    }

    if (config.nanokaBaseUrl && config.skipVersionProbe) {
        return config.nanokaBaseUrl;
    }

    if (!config.siteUrl) {
        return config.nanokaBaseUrl;
    }

    const latestBaseUrl = await fetchNanokaSiteBaseUrl(config.siteUrl);
    if (!latestBaseUrl) {
        return config.nanokaBaseUrl;
    }

    updateNanokaBaseUrlConfig(configPath, latestBaseUrl, dryRun);
    return latestBaseUrl;
}

export function resolveProjectPath(configPath, relativePath) {
    return path.resolve(path.dirname(configPath), relativePath);
}

export function cleanName(value) {
    return String(value ?? "")
        .replace(/<[^>]*>/g, "")
        .trim();
}

export function normalizeElement(value) {
    return elementNameMap[value] ?? value;
}

export function normalizeElements(values) {
    return asArray(values).map(normalizeElement).filter(Boolean);
}

export function normalizePathName(value) {
    return pathNameMap[value] ?? value;
}

export function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

export function toStringId(value) {
    return String(value ?? "").trim();
}

export function firstValue(object, names, fallback = undefined) {
    if (!object) return fallback;

    for (const name of names) {
        if (object[name] !== undefined && object[name] !== null) {
            return object[name];
        }
    }

    const lowerMap = new Map(
        Object.keys(object).map(function (key) {
            return [key.toLowerCase(), key];
        }),
    );

    for (const name of names) {
        const key = lowerMap.get(String(name).toLowerCase());
        if (key && object[key] !== undefined && object[key] !== null) {
            return object[key];
        }
    }

    return fallback;
}

export function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    if (typeof value === "object") return Object.values(value);
    return [value];
}

export function extractArray(payload, keys = []) {
    if (Array.isArray(payload)) return payload;

    for (const key of keys) {
        const value = firstValue(payload, [key]);
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") return Object.values(value);
    }

    const values = Object.values(payload ?? {});
    const arrayValue = values.find(function (value) {
        return Array.isArray(value) && value.some((item) => item && typeof item === "object");
    });

    if (arrayValue) return arrayValue;

    if (values.every((value) => value && typeof value === "object")) {
        return values;
    }

    return [];
}

export function extractKeyedArray(payload, keys = []) {
    function withKey(value, key) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return value;
        if (firstValue(value, ["id", "Id", "ID", "_id"], undefined) !== undefined) return value;
        return { id: key, ...value };
    }

    if (Array.isArray(payload)) return payload;

    for (const key of keys) {
        const value = firstValue(payload, [key]);
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") {
            return Object.entries(value).map(([entryKey, entryValue]) => withKey(entryValue, entryKey));
        }
    }

    if (payload && typeof payload === "object") {
        const values = Object.values(payload);
        if (values.every((value) => value && typeof value === "object" && !Array.isArray(value))) {
            return Object.entries(payload).map(([entryKey, entryValue]) => withKey(entryValue, entryKey));
        }
    }

    return extractArray(payload, keys);
}

export function idFromEntry(entry, fallbackIndex = 0) {
    return toStringId(firstValue(entry, ["id", "Id", "ID", "_id"], fallbackIndex));
}

export function iconFileName(entry, fallbackId, extension = "webp") {
    const rawIcon = firstValue(entry, ["icon", "Icon", "image", "Image", "figure", "Figure"], "");
    const name = rawIcon ? path.posix.basename(String(rawIcon)) : `${fallbackId}.${extension}`;
    return name.includes(".") ? name : `${name}.${extension}`;
}

export function rarityStars(value) {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized.includes("super") || normalized.includes("5")) return 5;
    if (normalized.includes("very") || normalized.includes("4")) return 4;
    if (normalized.includes("rare") || normalized.includes("3")) return 3;
    if (normalized.includes("normal") || normalized.includes("2")) return 2;
    return toNumber(value, 0);
}

export function rarityLabel(stars) {
    return stars ? `${stars}★` : "";
}

export function uniqueBy(items, keyFn) {
    const seen = new Set();
    const result = [];

    for (const item of items) {
        const key = keyFn(item);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
    }

    return result;
}

export function sortByNumberDesc(items, key = "id") {
    return [...items].sort(function (a, b) {
        return toNumber(b[key]) - toNumber(a[key]);
    });
}

export function sortByReleaseOrIdDesc(items) {
    return [...items].sort(function (a, b) {
        return toNumber(b.release) - toNumber(a.release) || toNumber(b.id) - toNumber(a.id);
    });
}

export async function downloadFileCandidates(urls, targetPath, dryRun) {
    if (fs.existsSync(targetPath)) return "exists";

    if (dryRun) {
        return "dry-run";
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    for (const url of urls) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) continue;

            const bytes = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(targetPath, bytes);
            return "downloaded";
        } catch {
            // Try the next candidate URL.
        }
    }

    return "missing";
}

export async function downloadImages(items, getUrls, getTargetPath, dryRun) {
    let downloaded = 0;
    let missing = 0;
    const missingItems = [];

    for (const item of items) {
        const result = await downloadFileCandidates(getUrls(item), getTargetPath(item), dryRun);
        if (result === "downloaded") downloaded += 1;
        if (result === "missing") {
            missing += 1;
            missingItems.push(item);
        }
    }

    return { downloaded, missing, missingItems };
}
