import { initMenu } from "../menu.js";
import { byId, create } from "../tools.js";

const DATA_URL = new URL("../../data/zzz/formula.json", import.meta.url);

async function loadFormulaeData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
        throw new Error(`无法读取公式数据：${DATA_URL}`);
    }
    return response.json();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formulaHtml(value) {
    return escapeHtml(value)
        .replace(/@/g, '<span class="formulae-highlight">')
        .replace(/#/g, "</span>");
}

function renderTextItem(text) {
    return create("p", {
        className: "formulae-desc",
        html: formulaHtml(text),
    });
}

function renderListItem(items) {
    return create("ul", {
        className: "formulae-list",
        children: items.map(function (item) {
            return create("li", {
                html: formulaHtml(item),
            });
        }),
    });
}

function renderSection(section, index) {
    const body = section.items.map(function (item) {
        if (Array.isArray(item)) {
            return renderListItem(item);
        }
        return renderTextItem(item);
    });

    return create("article", {
        className: "formulae-card",
        children: [
            create("button", {
                className: "formulae-card-title",
                attrs: {
                    type: "button",
                    "aria-expanded": "true",
                    "aria-controls": `formulaeBody${index}`,
                },
                children: [
                    create("span", { text: section.title }),
                    create("span", { className: "formulae-toggle", text: "−" }),
                ],
            }),
            create("div", {
                id: `formulaeBody${index}`,
                className: "formulae-card-body",
                children: body,
            }),
        ],
    });
}

function typesetMath() {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise();
    }
}

function bindCollapse() {
    byId("formulaeGrid").addEventListener("click", function (event) {
        const button = event.target.closest(".formulae-card-title");
        if (!button) return;

        const card = button.closest(".formulae-card");
        const collapsed = card.classList.toggle("collapsed");
        button.setAttribute("aria-expanded", String(!collapsed));
        button.querySelector(".formulae-toggle").textContent = collapsed ? "＋" : "−";
    });
}

function render(data) {
    byId("formulaeGrid").replaceChildren(
        ...data.sections.map(function (section, index) {
            return renderSection(section, index);
        }),
    );
    typesetMath();
}

async function init() {
    initMenu();
    bindCollapse();
    const data = await loadFormulaeData();
    render(data);
}

init().catch(function (error) {
    console.error(error);
});