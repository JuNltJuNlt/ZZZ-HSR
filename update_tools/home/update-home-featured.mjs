import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const HOME_DATA_PATH = path.join(PROJECT_ROOT, "data", "home", "home.json");
const CHARACTER_PATH = path.join(PROJECT_ROOT, "data", "character", "character.json");
const LIGHTCONE_PATH = path.join(PROJECT_ROOT, "data", "lightcone", "lightcone.json");

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
    return {
        dryRun: argv.includes("--dry-run"),
    };
}

function versionRank(version) {
    const match = String(version ?? "").match(/^(\d+)\.(\d+)/);
    if (!match) return 0;
    return Number(match[1]) * 100 + Number(match[2]);
}

function getLatestCharacterVersion(characters) {
    return characters.reduce(function (latest, character) {
        return versionRank(character.ver) > versionRank(latest) ? character.ver : latest;
    }, "");
}

function getFeaturedCharacters(characters) {
    const latestVersion = getLatestCharacterVersion(characters);
    const latestCharacters = characters.filter(function (character) {
        return character.ver === latestVersion;
    });

    if (latestCharacters.length) {
        return latestCharacters;
    }
    return characters.slice(0, 3);
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const characters = readJson(CHARACTER_PATH);
    const lightcones = readJson(LIGHTCONE_PATH);
    const featuredCharacters = getFeaturedCharacters(characters);
    const featuredLightcones = lightcones.slice(0, featuredCharacters.length);
    const characterIds = featuredCharacters.map((character) => Number(character.id));
    const lightconeIds = featuredLightcones.map((lightcone) => Number(lightcone.id));

    const homeConfig = readJson(HOME_DATA_PATH);
    homeConfig.homeData.featured.characters = characterIds;
    homeConfig.homeData.featured.lightcones = lightconeIds;

    console.log(`首页角色版本：${featuredCharacters[0]?.ver ?? "未知"}`);
    console.log(`首页角色：${characterIds.join(", ")}`);
    console.log(`首页光锥：${lightconeIds.join(", ")}`);

    if (options.dryRun) {
        console.log("dry-run：首页截图配置未写入");
        return;
    }

    fs.writeFileSync(HOME_DATA_PATH, `${JSON.stringify(homeConfig, null, 4)}\n`, "utf8");
    console.log("首页截图配置已更新");
}

main();
