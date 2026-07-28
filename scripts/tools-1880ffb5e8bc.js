export function byId(id) {
    return document.getElementById(id);
}

export function create(tagName, options = {}) {
    const node = document.createElement(tagName);
    const {
        className,
        text,
        textValue,
        html,
        href,
        src,
        alt = "",
        attrs = {},
        style = {},
        children = [],
    } = options;

    const textContent = text !== undefined ? text : textValue;

    if (className) node.className = className;
    if (textContent !== undefined) node.textContent = textContent;
    if (html !== undefined) node.innerHTML = html;
    if (href) node.href = href;
    if (src) node.src = src;
    if (tagName === "img") node.alt = alt;

    Object.entries(attrs).forEach(function ([name, value]) {
        if (value !== false && value !== null && value !== undefined) {
            node.setAttribute(name, String(value));
        }
    });

    Object.assign(node.style, style);
    children.filter(Boolean).forEach(function (child) {
        node.append(child);
    });

    return node;
}

export function image(src, className = "", alt = "", options = {}) {
    const normalized = normalizeImageOptions(options);
    const node = create("img", {
        src,
        alt,
        className,
        attrs: { loading: "lazy", ...normalized.attrs },
        style: normalized.style,
    });

    if (normalized.error === "remove") {
        node.addEventListener("error", function () {
            node.remove();
        });
    } else if (normalized.error !== "none") {
        node.addEventListener("error", function () {
            node.style.opacity = "0";
        });
    }

    return node;
}

export function wrapIndex(index, length) {
    if (!Number.isFinite(length) || length <= 0) return 0;
    return ((index % length) + length) % length;
}

function normalizeImageOptions(options) {
    if (!options || typeof options !== "object") {
        return { attrs: {}, style: {}, error: "hide" };
    }

    if ("attrs" in options || "style" in options || "error" in options) {
        if (typeof options.style === "string") {
            return { attrs: options, style: {}, error: "hide" };
        }

        return {
            attrs: options.attrs ?? {},
            style: options.style ?? {},
            error: options.error ?? "hide",
        };
    }

    return { attrs: {}, style: options, error: "hide" };
}
