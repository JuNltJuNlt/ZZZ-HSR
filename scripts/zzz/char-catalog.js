import { initMenu } from "../menu.js";
import { byId, create, image } from "../tools.js";

const asset = (path) => `../../images/ZZZ%20images/${path}`;

const state = {
    mode: "char",
};

const createSchedule = ({ className = "", attrs = {}, children = [], text, img }) =>
    create("schedule", {
        className,
        attrs,
        text,
        children: img ? [image(asset(img), "", "", { error: "remove" })] : children,
    });

const renderTabs = () => {
    byId("catalogTabs").replaceChildren(
        createSchedule({
            className: state.mode === "char" ? "active _a" : "_a",
            attrs: { "data-mode": "char" },
            img: "others/代理人.webp",
        }),
        createSchedule({
            className: state.mode === "wengine" ? "active _w" : "_w",
            attrs: { "data-mode": "wengine" },
            img: "others/音擎.webp",
        }),
        createSchedule({
            className: state.mode === "drive" ? "active _r1" : "_r1",
            attrs: { "data-mode": "drive" },
            img: "others/驱动盘.webp",
        }),
        createSchedule({
            className: state.mode === "bangboo" ? "active _r2" : "_r2",
            attrs: { "data-mode": "bangboo" },
            img: "others/邦布.webp",
        }),
    );
};

const render = () => {
    renderTabs();
    byId("catalogFilters").replaceChildren();
    byId("catalogArea").replaceChildren(
        create("p", { className: "desc", text: "数据加载中..." }),
    );
};

const bindEvents = () => {
    byId("catalogTabs").addEventListener("click", (event) => {
        const tab = event.target.closest("schedule");
        if (!tab || !tab.dataset.mode || tab.classList.contains("active")) return;
        state.mode = tab.dataset.mode;
        render();
    });
};

const init = async () => {
    initMenu();
    bindEvents();
    render();
};

init();