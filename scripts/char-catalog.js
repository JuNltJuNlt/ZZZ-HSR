import { initMenu } from "./menu.js";
import { byId, create, image } from "./tools.js";

const asset = (path) => `../../images/${path}`;
const DATA_URLS = {
    avatar: "../../data/character/character.json",
    weapon: "../../data/lightcone/lightcone.json",
    relic: "../../data/relic/relic.json",
};

const elements = ["Phys", "Quantum", "Imaginary", "Ice", "Wind", "Fire", "Elec"];
const paths = ["Destruction", "Harmony", "Remembrance", "Erudition", "Hunt", "Preservation", "Abundance", "Nihility", "Elation"];
const elementColors = {
    None: "ffffff",
    Phys: "ffffff",
    Elec: "ffacff",
    Fire: "ff8877",
    Ice: "8addff",
    Wind: "97ffb7",
    Quantum: "7f9aea",
    Imaginary: "ffe779",
};

let avatars = [];
let weapons = [];
let relics = [];

const state = {
    mode: "avatar",
    avatarRarity: 5,
    weaponRarity: 5,
    elements: new Set(),
    paths: new Set(),
};

const pathIcon = (pathName) => (pathName === "Elation" ? "paths/Elation.webp" : `paths/${pathName}.png`);

const createSchedule = ({ className = "", attrs = {}, children = [], text, html, img }) =>
    create("schedule", {
        className,
        attrs,
        html,
        text,
        children: img ? [image(asset(img), "", "", { error: "remove" })] : children,
    });

const statLine = (icon, value) =>
    create("span", {
        className: "avatar-stat stat_fin",
        children: [
            image(asset(`others/${icon}.png`), "avatar-staticon", "", { error: "remove" }),
            document.createTextNode(String(Math.round(value ?? 0))),
        ],
    });

const renderTabs = () => {
    byId("catalogTabs").replaceChildren(
        createSchedule({
            className: state.mode === "avatar" ? "active _a" : "_a",
            attrs: { "data-mode": "avatar" },
            img: "others/IconAvatarDetail.png",
        }),
        createSchedule({
            className: state.mode === "weapon" ? "active _w" : "_w",
            attrs: { "data-mode": "weapon" },
            img: "others/IconAvatarLightCone.png",
        }),
        createSchedule({
            className: state.mode === "relic2" ? "active _r1" : "_r1",
            attrs: { "data-mode": "relic2" },
            img: "others/IconRelicBody.png",
        }),
        createSchedule({
            className: state.mode === "relic1" ? "active _r2" : "_r2",
            attrs: { "data-mode": "relic1" },
            img: "others/IconAvatarRelic.png",
        }),
    );
};

const renderRarityFilter = (kind) => {
    const values = kind === "avatar" ? [5, 4] : [5, 4, 3];
    const active = kind === "avatar" ? state.avatarRarity : state.weaponRarity;
    return create("section", {
        className: `${kind === "avatar" ? "avatar" : "weapon"}-rarity select_parts select_parts_size_2`,
        children: values.map((rarity) =>
            createSchedule({
                className: active === rarity ? "active" : "",
                attrs: { "data-filter": `${kind}-rarity`, "data-id": rarity },
                children: [create("span", { text: `${rarity}★` })],
            }),
        ),
    });
};

const renderElementFilter = () =>
    create("section", {
        className: "avatar-elem select_parts select_parts_size_3",
        children: elements.map((elementName) =>
            createSchedule({
                className: state.elements.has(elementName) ? "active" : "",
                attrs: { "data-filter": "element", "data-id": elementName },
                img: `element/${elementName}.png`,
            }),
        ),
    });

const renderPathFilter = () =>
    create("section", {
        className: "avatar-type select_parts select_parts_size_4",
        children: paths.map((pathName) =>
            createSchedule({
                className: state.paths.has(pathName) ? "active" : "",
                attrs: { "data-filter": "path", "data-id": pathName },
                img: pathIcon(pathName),
            }),
        ),
    });

const renderFilters = () => {
    if (state.mode === "avatar") {
        byId("catalogFilters").replaceChildren(renderRarityFilter("avatar"), renderElementFilter(), renderPathFilter());
        return;
    }
    if (state.mode === "weapon") {
        byId("catalogFilters").replaceChildren(renderRarityFilter("weapon"), renderPathFilter());
        return;
    }
    byId("catalogFilters").replaceChildren();
};

const passElement = (item) => !state.elements.size || state.elements.has(item.element);
const passPath = (item) => !state.paths.size || state.paths.has(item.path);

const renderAvatarCard = (avatar) => {
    const stats = avatar.stats;
    const statNodes = stats ? [
        Number.isFinite(stats.HP) ? statLine("_HP", stats.HP) : null,
        Number.isFinite(stats.ATK) ? statLine("_ATK", stats.ATK) : null,
        Number.isFinite(stats.DEF) ? statLine("_DEF", stats.DEF) : null,
        Number.isFinite(stats.SPD) ? statLine("_SPD", stats.SPD) : null,
        Number.isFinite(avatar.sp) ? statLine("_ENERGY", avatar.sp) : null,
    ].filter(Boolean) : [];

    return create("div", {
        className: `avatar-card avatar-card-avatar hover-shadow rar-${avatar.rarity}`,
        attrs: {
            "data-rarity": avatar.rarity,
            "data-type": avatar.path,
            "data-elem": avatar.element,
        },
        children: [
            avatar.ver ? create("p", { className: "av", text: avatar.ver, style: { fontWeight: "bold" } }) : null,
            image(asset(`character/character_icon_shop/${avatar.icon}`), "avatar-head", avatar.name, { error: "remove" }),
            create("p", {
                className: "avatar-name av",
                text: avatar.name,
                style: {
                    fontWeight: "bold",
                    color: `#${elementColors[avatar.element] ?? elementColors.None}`,
                },
            }),
            create("div", {
                style: {
                    display: "flex",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginTop: "10px",
                    marginBottom: "10px",
                },
                children: [
                    image(asset(`element/${avatar.element}.png`), "", avatar.element, {
                        style: {
                            width: "22%",
                            maxWidth: "35px",
                            margin: "0 5px",
                        },
                        error: "remove",
                    }),
                    avatar.path
                        ? image(asset(pathIcon(avatar.path)), "", avatar.path, {
                              style: {
                                  width: "22%",
                                  maxWidth: "35px",
                                  margin: "0 5px",
                              },
                              error: "remove",
                          })
                        : null,
                ].filter(Boolean),
            }),
            ...(statNodes.length ? [create("p", { children: statNodes })] : []),
        ],
    });
};

const renderWeaponCard = (weapon) => {
    const stats = weapon.stats;
    const statNodes = stats ? [
        Number.isFinite(stats.HP) ? statLine("_HP", stats.HP) : null,
        Number.isFinite(stats.ATK) ? statLine("_ATK", stats.ATK) : null,
        Number.isFinite(stats.DEF) ? statLine("_DEF", stats.DEF) : null,
    ].filter(Boolean) : [];

    return create("div", {
        className: `avatar-card hover-shadow avatar-card-weapon rar-${weapon.rarity}`,
        attrs: {
            "data-rarity": weapon.rarity,
            "data-type": weapon.path,
        },
        children: [
            create("p", {
                className: "avatar-name av",
                text: weapon.name,
                style: { fontWeight: "bold", marginTop: "12px" },
            }),
            create("p", { className: "relic_id", text: `ID ${weapon.id}` }),
            image(asset(`lightcone/lightcone_icon_default/${weapon.icon}`), "weapon-head", weapon.name, { error: "remove" }),
            create("div", {
                style: {
                    display: "flex",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginTop: "10px",
                    marginBottom: "10px",
                },
                children: weapon.path
                    ? [
                          image(asset(pathIcon(weapon.path)), "", weapon.path, {
                              style: {
                                  width: "30%",
                                  maxWidth: "48px",
                                  margin: "0",
                              },
                              error: "remove",
                          }),
                      ]
                    : [],
            }),
            ...(statNodes.length ? [create("p", { children: statNodes })] : []),
        ],
    });
};

const renderRelicCard = (relic) => {
    const skills = relic.skills.map((skill, index) =>
        create("p", {
            className: "desc",
            html: `<b><color style='color:#f29d38'>${(index + 1) * 2}P</color></b> ${skill}`,
        }),
    );

    return create("div", {
        className: "curio hover-shadow",
        children: [
            image(asset(`relic/${relic.icon}`), "icon", relic.name, { error: "remove" }),
            create("p", { className: "relic_id", text: `ID ${relic.id}` }),
            create("p", { className: "name", text: relic.name }),
            ...skills,
        ],
    });
};

const renderCards = () => {
    if (state.mode === "avatar") {
        byId("catalogArea").replaceChildren(
            ...avatars
                .filter((avatar) => avatar.rarity === state.avatarRarity)
                .filter(passElement)
                .filter(passPath)
                .map(renderAvatarCard),
        );
        return;
    }
    if (state.mode === "weapon") {
        byId("catalogArea").replaceChildren(
            ...weapons
                .filter((weapon) => weapon.rarity === state.weaponRarity)
                .filter(passPath)
                .map(renderWeaponCard),
        );
        return;
    }
    const targetSkillCount = state.mode === "relic2" ? 2 : 1;
    byId("catalogArea").replaceChildren(
        ...relics.filter((relic) => relic.skills.length === targetSkillCount).map(renderRelicCard),
    );
};

const render = () => {
    renderTabs();
    renderFilters();
    renderCards();
};

const bindEvents = () => {
    byId("catalogTabs").addEventListener("click", (event) => {
        const tab = event.target.closest("schedule");
        if (!tab || !tab.dataset.mode || tab.classList.contains("active")) return;
        state.mode = tab.dataset.mode;
        render();
    });

    byId("catalogFilters").addEventListener("click", (event) => {
        const node = event.target.closest("schedule");
        if (!node) return;
        const id = node.dataset.id;

        if (node.dataset.filter === "avatar-rarity") {
            state.avatarRarity = Number(id);
        } else if (node.dataset.filter === "weapon-rarity") {
            state.weaponRarity = Number(id);
        } else if (node.dataset.filter === "element") {
            state.elements.has(id) ? state.elements.delete(id) : state.elements.add(id);
        } else if (node.dataset.filter === "path") {
            state.paths.has(id) ? state.paths.delete(id) : state.paths.add(id);
        }
        render();
    });
};

const loadCatalogData = async () => {
    const [avatarResponse, weaponResponse, relicResponse] = await Promise.all([
        fetch(DATA_URLS.avatar),
        fetch(DATA_URLS.weapon),
        fetch(DATA_URLS.relic),
    ]);

    if (!avatarResponse.ok || !weaponResponse.ok || !relicResponse.ok) {
        throw new Error("无法读取角色、光锥、遗器数据");
    }

    [avatars, weapons, relics] = await Promise.all([
        avatarResponse.json(),
        weaponResponse.json(),
        relicResponse.json(),
    ]);
};

const init = async () => {
    initMenu();
    try {
        await loadCatalogData();
        bindEvents();
        render();
    } catch (error) {
        byId("catalogArea").replaceChildren(
            create("p", {
                className: "desc",
                text: error instanceof Error ? error.message : "数据读取失败",
            }),
        );
    }
};

init();
