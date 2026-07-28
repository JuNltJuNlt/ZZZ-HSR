import fs from "node:fs";
import path from "node:path";

export function stripTrailingSlash(value) {
    return String(value ?? "").replace(/\/+$/, "");
}

export function parseNanokaBaseUrl(baseUrl) {
    const match = stripTrailingSlash(baseUrl).match(/^(.*\/)(\d+)\.(\d+)\.5([1-5])$/);
    if (!match) return null;

    return {
        prefix: match[1],
        major: Number(match[2]),
        minor: Number(match[3]),
        patch: Number(match[4]),
    };
}

export function formatNanokaBaseUrl(version) {
    return `${version.prefix}${version.major}.${version.minor}.5${version.patch}`;
}

export function nextNanokaBaseVersion(version) {
    if (version.patch < 5) {
        return { ...version, patch: version.patch + 1 };
    }

    return {
        ...version,
        minor: version.minor + 1,
        patch: 1,
    };
}

export function nanokaBaseCandidates(baseUrl, limit) {
    const parsed = parseNanokaBaseUrl(baseUrl);
    if (!parsed) return [stripTrailingSlash(baseUrl)];

    const candidates = [];
    let current = parsed;

    for (let index = 0; index < limit; index += 1) {
        candidates.push(formatNanokaBaseUrl(current));
        current = nextNanokaBaseVersion(current);
    }

    return candidates;
}

export function nanokaVersionLabel(baseUrl) {
    const parsed = parseNanokaBaseUrl(baseUrl);
    return parsed ? `${parsed.major}.${parsed.minor}.5${parsed.patch}` : stripTrailingSlash(baseUrl);
}

export function displayVersionLabel(baseUrl) {
    const parsed = parseNanokaBaseUrl(baseUrl);
    return parsed ? `${parsed.major}.${parsed.minor + 1}v${parsed.patch}` : "";
}

export function nanokaVersionChangeType(configuredBaseUrl, latestBaseUrl) {
    const configured = parseNanokaBaseUrl(configuredBaseUrl);
    const latest = parseNanokaBaseUrl(latestBaseUrl);

    if (!configured || !latest) {
        return stripTrailingSlash(configuredBaseUrl) === stripTrailingSlash(latestBaseUrl) ? "same" : "major";
    }
    if (configured.major === latest.major && configured.minor === latest.minor && configured.patch === latest.patch) {
        return "same";
    }
    if (configured.major === latest.major && configured.minor === latest.minor) {
        return "small";
    }

    return "major";
}

export async function fetchNanokaSiteBaseUrl(siteUrl) {
    if (!siteUrl) return "";

    const response = await fetch(siteUrl);
    if (!response.ok) return "";

    const html = await response.text();
    const match = html.match(/(?:https?:)?\/\/static\.nanoka\.cc\/hsr\/(\d+\.\d+\.5[1-5])/);
    return match ? `https://static.nanoka.cc/hsr/${match[1]}` : "";
}

export async function resolveNanokaVersionState({ baseUrl, limit, hasData, siteUrl }) {
    const configuredBaseUrl = stripTrailingSlash(baseUrl);
    let latestBaseUrl = "";

    if (siteUrl) {
        latestBaseUrl = await fetchNanokaSiteBaseUrl(siteUrl);
        if (latestBaseUrl) {
            console.log(`Nanoka 页面版本：${latestBaseUrl}`);
        } else {
            console.log("Nanoka 页面未解析到静态资源版本，改用数据候选版本探测。");
        }
    }

    const candidates = nanokaBaseCandidates(configuredBaseUrl, limit);
    if (!latestBaseUrl) {
        latestBaseUrl = candidates[0];

        for (const candidate of candidates) {
            console.log(`检查 Nanoka 数据版本：${candidate}`);
            if (await hasData(candidate)) {
                latestBaseUrl = candidate;
            }
        }
    }

    const changeType = nanokaVersionChangeType(configuredBaseUrl, latestBaseUrl);

    return {
        configuredBaseUrl,
        latestBaseUrl,
        configuredVersion: nanokaVersionLabel(configuredBaseUrl),
        latestVersion: nanokaVersionLabel(latestBaseUrl),
        changed: changeType !== "same",
        changeType,
    };
}

export function updateHomeVersionConfig(configPath, latestBaseUrl, dryRun) {
    const displayVersion = displayVersionLabel(latestBaseUrl);
    if (!displayVersion) return;

    updateHtmlVersionLabels(configPath, displayVersion, dryRun);
    updateHomeDataVersion(configPath, displayVersion, dryRun);
}

function updateHomeDataVersion(configPath, displayVersion, dryRun) {
    const projectRoot = findProjectRoot(configPath);
    const homeDataPath = path.join(projectRoot, "data", "home", "home.json");
    if (!fs.existsSync(homeDataPath)) return;

    const data = JSON.parse(fs.readFileSync(homeDataPath, "utf8"));
    if (!data.homeData || data.homeData.siteVersion === displayVersion) return;

    data.homeData.siteVersion = displayVersion;

    if (dryRun) {
        console.log(`dry-run：首页网站版本将更新为 ${displayVersion}`);
        return;
    }

    fs.writeFileSync(homeDataPath, `${JSON.stringify(data, null, 4)}\n`, "utf8");
    console.log(`已更新首页网站版本：${displayVersion}`);
}

export function updateHtmlVersionLabels(configPath, displayVersion, dryRun) {
    const projectRoot = findProjectRoot(configPath);
    const htmlFiles = [];
    const homePath = path.join(projectRoot, "index.html");
    const srHtmlPath = path.join(projectRoot, "sr_html");

    if (fs.existsSync(homePath)) {
        htmlFiles.push(homePath);
    }

    collectIndexHtmlFiles(srHtmlPath, htmlFiles);

    let updateCount = 0;

    for (const htmlPath of htmlFiles) {
        const source = fs.readFileSync(htmlPath, "utf8");
        const nextSource = source.replace(/<b>\d+\.\d+v[1-5]<\/b>/g, `<b>${displayVersion}</b>`);

        if (nextSource === source) continue;
        updateCount += 1;

        if (!dryRun) {
            fs.writeFileSync(htmlPath, nextSource, "utf8");
        }
    }

    if (updateCount === 0) return;

    if (dryRun) {
        console.log(`dry-run：${updateCount} 个页面页眉版本号将更新为 ${displayVersion}`);
        return;
    }

    console.log(`已更新 ${updateCount} 个页面页眉版本号：${displayVersion}`);
}

function findProjectRoot(configPath) {
    let current = path.resolve(path.dirname(configPath));

    while (true) {
        if (fs.existsSync(path.join(current, "data", "home", "home.json"))) {
            return current;
        }

        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    return path.resolve(path.dirname(configPath), "..");
}

function collectIndexHtmlFiles(dirPath, htmlFiles) {
    if (!fs.existsSync(dirPath)) return;

    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            collectIndexHtmlFiles(entryPath, htmlFiles);
            continue;
        }

        if (entry.isFile() && entry.name === "index.html") {
            htmlFiles.push(entryPath);
        }
    }
}

export function updateNanokaBaseUrlConfig(configPath, latestBaseUrl, dryRun) {
    if (!latestBaseUrl) return;

    updateHomeVersionConfig(configPath, latestBaseUrl, dryRun);

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (stripTrailingSlash(config.nanokaBaseUrl) === stripTrailingSlash(latestBaseUrl)) return;

    config.nanokaBaseUrl = stripTrailingSlash(latestBaseUrl);

    if (dryRun) {
        console.log(`dry-run：配置版本将更新为 ${config.nanokaBaseUrl}`);
        return;
    }

    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 4)}\n`, "utf8");
    console.log(`已更新配置版本：${path.basename(configPath)} -> ${config.nanokaBaseUrl}`);
}
