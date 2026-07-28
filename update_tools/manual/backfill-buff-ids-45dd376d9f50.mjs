import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, "../..");
const mapping = JSON.parse(fs.readFileSync(path.join(currentDirectory, "buff-id-map.json"), "utf8"));
const dryRun = process.argv.includes("--dry-run");
const writes = [];
const totals = {
    fiction: 0,
    shadowBuffs: 0,
    shadowFeatures: 0,
    arbitration: 0,
};

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function dataFiles(directory, prefix) {
    return fs
        .readdirSync(directory)
        .filter(function (fileName) {
            return new RegExp(`^${prefix}_\\d+\\.json$`).test(fileName);
        })
        .sort(function (left, right) {
            return left.localeCompare(right, "zh-CN", { numeric: true });
        });
}

function addId(item, id) {
    const numericId = Number(id);
    assert(Number.isInteger(numericId) && numericId > 0, `无效的 Buff ID：${id}`);
    const { id: oldId, ...rest } = item;
    return { id: numericId, ...rest };
}

function assignIds(items, ids, label) {
    assert(Array.isArray(items), `${label} 不是数组`);
    assert(Array.isArray(ids), `${label} 缺少编号映射`);
    assert(items.length === ids.length, `${label} 数量不一致：本地 ${items.length}，编号 ${ids.length}`);
    return items.map(function (item, index) {
        return addId(item, ids[index]);
    });
}

function queueWrite(filePath, data) {
    writes.push({ filePath, content: `${JSON.stringify(data, null, 4)}\n` });
}

function backfillFiction() {
    const directory = path.join(projectRoot, "data/fiction");

    for (const fileName of dataFiles(directory, "fiction")) {
        const filePath = path.join(directory, fileName);
        const entry = readJson(filePath);
        const ids = mapping.fiction[String(entry.story_id)];
        assert(ids, `${fileName} 找不到虚构叙事编号映射`);

        entry.blessing = assignIds(entry.blessing, ids.blessing, `${fileName} blessing`);
        entry.buffs = assignIds(entry.buffs, ids.buffs, `${fileName} buffs`);
        totals.fiction += entry.blessing.length + entry.buffs.length;
        queueWrite(filePath, entry);
    }
}

function backfillShadow() {
    const directory = path.join(projectRoot, "data/shadow");

    for (const fileName of dataFiles(directory, "shadow")) {
        const filePath = path.join(directory, fileName);
        const entry = readJson(filePath);
        const ids = mapping.shadow[String(entry.shadow_id)];
        assert(ids, `${fileName} 找不到末日幻影编号映射`);

        for (const side of ["upper", "lower", "star"]) {
            entry.buff[side] = assignIds(entry.buff[side] ?? [], ids.buff[side], `${fileName} buff.${side}`);
            entry.boss_features[side] = assignIds(
                entry.boss_features[side] ?? [],
                ids.boss_features[side],
                `${fileName} boss_features.${side}`,
            );
            totals.shadowBuffs += entry.buff[side].length;
            totals.shadowFeatures += entry.boss_features[side].length;
        }
        queueWrite(filePath, entry);
    }
}

function backfillArbitration() {
    const directory = path.join(projectRoot, "data/arbitration");
    const fields = [
        "debuff_a",
        "debuff_b",
        "debuff_c",
        "buff_final",
        "debuff_final_easy",
        "debuff_final_hard",
    ];

    for (const fileName of dataFiles(directory, "arbitration")) {
        const filePath = path.join(directory, fileName);
        const entry = readJson(filePath);
        const ids = mapping.arbitration[String(entry.arbitration_id)];
        assert(ids, `${fileName} 找不到异相仲裁编号映射`);

        for (const field of fields) {
            entry[field] = assignIds(entry[field], ids[field], `${fileName} ${field}`);
            totals.arbitration += entry[field].length;
        }
        queueWrite(filePath, entry);
    }
}

function commitWrites() {
    if (dryRun) return;
    for (const write of writes) {
        fs.writeFileSync(write.filePath, write.content, "utf8");
    }
}

backfillFiction();
backfillShadow();
backfillArbitration();
commitWrites();

console.log(dryRun ? "Buff ID 回填检查通过，未写入文件。" : "Buff ID 已全部回填。");
console.log(`虚构叙事：${totals.fiction}`);
console.log(`末日幻影终焉公理：${totals.shadowBuffs}`);
console.log(`末日幻影首领特性：${totals.shadowFeatures}`);
console.log(`异相仲裁：${totals.arbitration}`);
console.log(`数据文件：${writes.length}`);
