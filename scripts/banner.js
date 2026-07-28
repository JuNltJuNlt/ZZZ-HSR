import { initMenu } from "./menu.js";
import { create, image } from "./tools.js";

const asset = (path) => `../../images/${path}`;
const dataPath = "../data/banner/banner.json";

const phaseLabels = ["第 ? 期", "第一期", "第二期", "第三期"];
const text = {
    title: "跃迁卡池",
    search: "搜索",
    tip: "点击角色可搜索卡池，再次点击重置",
    subtitle: "妮可少女 玉衡杯数据库 yuhengcup.wiki",
};

const state = {
    selectedId: "",
};

let srBanners = [];
let srBannerIndex = {};

const loadBannerData = async () => {
    const response = await fetch(new URL(dataPath, import.meta.url));
    if (!response.ok) {
        throw new Error("无法读取跃迁卡池数据");
    }

    const data = await response.json();
    srBanners = data.banners;
    srBannerIndex = data.index;
};

const avatarSrc = (id) => asset(`character/character_icon_default/${id}.webp`);

const bannerAvatarIds = (banner) =>
    banner.phases.flatMap((phase) =>
        [...phase.five_star, ...phase.four_star].map((item) => String(item.id)),
    );

const renderPic = (item, star) => {
    const id = String(item.id);
    const icon = create("div", {
        className: `icon icon_${star}`,
        children: [
            image(avatarSrc(id), "", id),
            ...(id !== "999"
                ? [
                      create("span", {
                          className: `num num_${star}`,
                          text: String(item.count),
                      }),
                  ]
                : []),
        ],
    });

    return create("div", {
        className: "pic hover-shadow",
        attrs: {
            "data-id": id,
            "data-num": item.count,
            title: id,
        },
        children: [icon],
    });
};

const renderPhase = (phase) =>
    create("div", {
        className: "phase",
        children: [
            create("p", {
                className: "desc",
                text: phaseLabels[phase.phase] ?? phaseLabels[0],
            }),
            ...(phase.five_star.length
                ? [
                      create("div", {
                          className: "pics",
                          children: phase.five_star.map((item) => renderPic(item, 5)),
                      }),
                  ]
                : []),
            ...(phase.four_star.length
                ? [
                      create("div", {
                          className: "pics",
                          children: phase.four_star.map((item) => renderPic(item, 4)),
                      }),
                  ]
                : []),
        ],
    });

const renderBannerCard = (banner) =>
    create("div", {
        className: "card",
        attrs: { "data-avatar-ids": bannerAvatarIds(banner).join(" ") },
        children: [
            create("p", {
                className: "name",
                text: banner.version,
            }),
            create("div", {
                className: "phases",
                children: banner.phases.map(renderPhase),
            }),
        ],
    });

const renderSearchPic = (id) =>
    create("div", {
        className: "pic hover-shadow",
        attrs: { "data-id": id },
        children: [
            create("div", {
                className: "icon icon_5",
                children: [image(avatarSrc(id), "", id)],
            }),
        ],
    });

const clearSelection = () => {
    state.selectedId = "";
    document.querySelectorAll(".card").forEach((card) => {
        card.style.display = "";
    });
    document.querySelector(".search").replaceChildren();
    document.querySelector(".search").style.display = "none";
    document.querySelector("#INPUT").value = "";
    document.querySelector(".tip2").style.display = "none";
    document.querySelector(".avd_1").style.display = "";
};

const applySelection = (id) => {
    state.selectedId = String(id);
    document.querySelector(".tip2").style.display = "";
    document.querySelector(".avd_1").style.display = "none";
    document.querySelectorAll(".card").forEach((card) => {
        card.style.display = card.dataset.avatarIds.split(" ").includes(state.selectedId) ? "" : "none";
    });

    const search = document.querySelector(".search");
    search.replaceChildren(renderSearchPic(state.selectedId));
    search.style.display = "";
    document.querySelectorAll(".num").forEach((node) => {
        node.style.display = "";
    });
};

const searchByInput = () => {
    const input = document.querySelector("#INPUT");
    const query = input.value.replaceAll(" ", "").toUpperCase();
    if (!query) return;

    const match = Object.entries(srBannerIndex).find(([name]) =>
        name.replaceAll(" ", "").toUpperCase().includes(query),
    );
    if (!match) return;

    const id = String(match[1]);
    if (state.selectedId === id) {
        clearSelection();
        return;
    }
    applySelection(id);
};

const toggleNumbers = () => {
    document.querySelectorAll(".num").forEach((node) => {
        node.style.display = node.style.display === "none" ? "" : "none";
    });
};

const toggleCompactCards = () => {
    const inputWrap = document.querySelector(".input_wrap");
    inputWrap.style.display = inputWrap.style.display === "none" ? "" : "none";

    document.querySelectorAll(".card").forEach((card, index) => {
        if (index === 0) return;
        card.style.display = card.style.display === "none" ? "" : "none";
    });
};

const bindEvents = () => {
    document.body.addEventListener("click", (event) => {
        const pic = event.target.closest(".pic");
        if (pic) {
            event.preventDefault();
            const id = pic.dataset.id;
            if (state.selectedId === id) {
                clearSelection();
            } else {
                applySelection(id);
            }
            return;
        }

        if (event.target.closest(".but")) {
            searchByInput();
            return;
        }

        if (event.target.closest(".input_wrap")) return;
        if (event.target.closest(".content")) toggleNumbers();
    });

    document.querySelector("#INPUT").addEventListener("keydown", (event) => {
        if (event.key === "Enter") searchByInput();
    });

    document.querySelector(".title").addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        toggleCompactCards();
    });
};

const render = () => {
    document.querySelector("#bannerApp").replaceChildren(
        create("p", {
            className: "sch_2",
            text: text.title,
        }),
        create("div", {
            className: "input_wrap",
            children: [
                create("input", {
                    attrs: {
                        type: "text",
                        id: "INPUT",
                    },
                }),
                create("div", {
                    className: "but",
                    children: [
                        create("span", {
                            className: "desc",
                            text: text.search,
                        }),
                    ],
                }),
            ],
        }),
        create("p", {
            className: "avd tip2",
            text: text.tip,
            style: {
                margin: "18px 8px 14px",
                fontWeight: "normal",
                textAlign: "center",
                display: "none",
            },
        }),
        create("p", {
            className: "avd avd_1",
            text: text.subtitle,
            style: {
                color: "#0066FF",
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: "13px",
                marginTop: "13px",
            },
        }),
        create("div", {
            className: "pics search",
            style: { display: "none" },
        }),
        create("div", {
            className: "blessing_card_area",
            children: srBanners.map(renderBannerCard),
        }),
    );
};

const init = async () => {
    initMenu();
    await loadBannerData();
    render();
    bindEvents();
};

init();
