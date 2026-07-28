import { create } from "./tools.js";

const HOME_DATA_URL = new URL("../data/home/home.json", import.meta.url);
let cachedHomeData;

function rootHref(href) {
    if (!href) return null;
    return href.replace(/^\.\//, "/ZZZ-HSR/");
}

async function loadHomeData(homeData) {
    if (homeData) {
        cachedHomeData = homeData;
        return cachedHomeData;
    }

    if (cachedHomeData) return cachedHomeData;

    const response = await fetch(HOME_DATA_URL);
    if (!response.ok) {
        throw new Error(`读取首页数据失败：${HOME_DATA_URL.pathname}`);
    }

    cachedHomeData = (await response.json()).homeData;
    return cachedHomeData;
}

function buildMenuGroups(homeData) {
    const zzzDir = homeData.directoryByGame?.zzz ?? [];
    const srDir = homeData.directoryByGame?.sr ?? homeData.directory ?? [];
    const zzzActions = homeData.actionsByGame?.zzz ?? [];
    const srActions = homeData.actionsByGame?.sr ?? homeData.actions ?? [];

    return {
        quickZzz: zzzActions.map((item) => [item.label, item.disabled ? null : rootHref(item.href)]),
        quickSr: srActions.map((item) => [item.label, item.disabled ? null : rootHref(item.href)]),
        zzz: zzzDir.map((item) => [item.label, item.disabled ? null : rootHref(item.href)]),
        sr: srDir.map((item) => [item.label, item.disabled ? null : rootHref(item.href)]),
    };
}

const scheduleLink = (label, href, options = {}) =>
    create("schedule", {
        className: options.className ?? "hover-shadow",
        attrs: href ? {} : { "aria-disabled": "true" },
        style: { width: options.width ?? "", ...(options.style ?? {}) },
        children: [
            create(href ? "a" : "span", {
                href,
                className: options.panel ? "panel" : "",
                text: label,
                style: {
                    fontSize: options.fontSize ?? (options.panel ? "" : "19px"),
                    margin: "auto",
                    fontWeight: options.panel ? "bold" : "",
                },
            }),
        ],
    });

const renderPanelLinks = (items) =>
    items.map(([label, href]) =>
        scheduleLink(label, href, {
            panel: true,
            className: "hover-shadow panelw",
            width: "max-content",
        }),
    );

const renderMainLinks = (items) => items.map(([label, href]) => scheduleLink(label, href));

let currentMenuGame = "zzz";

export const openMenu = async (homeData) => {
    const menuGroups = buildMenuGroups(await loadHomeData(homeData));

    document.querySelector("popmask.yuhengcup")?.remove();

    const dialog = create("popdialog", {
        style: { width: "95%" },
        children: [
            create("popheader", {
                html: "<color style='color:#fff'>HomDGCat</color>",
                children: [create("closeicon", { text: "×", attrs: { title: "关闭" } })],
            }),
            create("popbody"),
        ],
    });

    const body = dialog.querySelector("popbody");
    body.append(
        create("h3", {
            html: "<img src='/images/others/logo.png' class='logo_img_yhb'>",
            style: {
                color: "#27363E",
                marginTop: "5px",
                marginBottom: "25px",
                fontSize: "40px",
                cursor: "pointer",
            },
            attrs: { title: "首页" },
        }),
        create("section", {
            className: "menu_CTRL",
            style: { marginBottom: "30px" },
            children: [
                scheduleLink("首页", "/ZZZ-HSR/", {
                    fontSize: "16px",
                    className: "",
                    style: { border: "1.6px solid #7030A0" },
                }),
                create("schedule", {
                    html: "<span style='font-size:16px;margin:auto'><b>绝区零</b></span>",
                    className: currentMenuGame === "zzz" ? "active" : "hover-shadow",
                    attrs: { "data-menu-game": "zzz" },
                }),
                create("schedule", {
                    html: "<span style='font-size:16px;margin:auto'><b>星穹铁道</b></span>",
                    className: currentMenuGame === "sr" ? "active" : "hover-shadow",
                    attrs: { "data-menu-game": "sr" },
                }),
            ],
        }),
        create("section", {
            className: "menu_SR menu_SR_2",
            style: {
                marginBottom: "10px",
                marginTop: "-13px",
                justifyContent: "center",
            },
            children: renderPanelLinks(currentMenuGame === "zzz" ? menuGroups.quickZzz : menuGroups.quickSr),
        }),
        create("section", {
            className: "menu_SR",
            children: renderMainLinks(currentMenuGame === "zzz" ? menuGroups.zzz : menuGroups.sr),
        }),
    );

    const mask = create("popmask", {
        className: "yuhengcup",
        style: {
            zIndex: "99999",
        },
        children: [dialog],
    });

    const close = () => mask.remove();
    dialog.querySelector("closeicon").addEventListener("click", close);
    mask.addEventListener("click", (event) => {
        if (event.target === mask) close();
    });
    dialog.querySelector("h3").addEventListener("click", () => {
        window.location.href = "/ZZZ-HSR/";
    });

    dialog.querySelectorAll("[data-menu-game]").forEach((el) => {
        el.addEventListener("click", () => {
            currentMenuGame = el.dataset.menuGame;
            openMenu(homeData);
        });
    });

    document.body.append(mask);
};

export const initMenu = (homeData) => {
    if (homeData) cachedHomeData = homeData;

    document.body.addEventListener("click", async (event) => {
        const target = event.target.closest("._menu_, .icon-button, [data-menu-button]");
        if (!target) return;
        event.preventDefault();
        await openMenu(cachedHomeData);
    });
};
