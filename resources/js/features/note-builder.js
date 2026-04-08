import DOMPurify from "../vendor/purify.es.mjs";
import { sanitizeFqdnHref } from "../core/utils.js";

export function createNoteBuilderFeature({
  form,
  getEl,
  escapeHtml,
  getIconAlign,
  getIconMode,
  getIconResolvedSrc,
  getIconGalleryItems,
  getIconGalleryColumns,
  getIconGallerySpacing,
  getWeservBaseUrl,
  isWsrvResizeEnabled,
  isAllowedIconImageUrl,
  getHostEntries,
  getNetworkEntries,
  getConfigLocationEntries,
  getCustomRowEntries,
  getOrderedRowKeys,
  isRowVisible,
  getBlockImportedRemoteCustomImages,
  isCrossOriginHttpUrl,
}) {
  function getFormat(prefix) {
    const checkedAlign = form.querySelector(`input[name="${prefix}Align"]:checked`);
    const checkedHeading = form.querySelector(`input[name="${prefix}Heading"]:checked`);
    return {
      align: checkedAlign ? checkedAlign.value : "center",
      tag: checkedHeading ? checkedHeading.value : "none",
      bold: Boolean(getEl(`${prefix}Bold`)?.checked),
      italic: Boolean(getEl(`${prefix}Italic`)?.checked),
      strong: Boolean(getEl(`${prefix}Strong`)?.checked),
      code: Boolean(getEl(`${prefix}Code`)?.checked),
    };
  }

  function textToHtml(value, keepLineBreaks = false) {
    const escaped = escapeHtml(value);
    if (!keepLineBreaks) {
      return escaped;
    }
    return escaped.replaceAll("\n", "<br />");
  }

  function sanitizeHref(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    if (/^(https?:|mailto:|tel:)/i.test(raw) || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("#")) {
      return raw;
    }

    return "";
  }

  function sanitizeImageSrc(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    if (getBlockImportedRemoteCustomImages() && isCrossOriginHttpUrl(raw)) {
      return "";
    }

    if (/^https?:/i.test(raw) || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) {
      return raw;
    }

    if (/^data:image\/(?:png|gif|jpe?g|webp);base64,/i.test(raw)) {
      return raw;
    }

    return "";
  }

  function sanitizeCustomHtml(value, keepLineBreaks = false) {
    const allowedTags = [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "strong",
      "ul",
    ];
    const blockedTags = ["script", "style", "iframe", "object", "embed", "svg", "math"];
    const rawValue = String(value || "");
    const fragment = DOMPurify.sanitize(rawValue, {
      ALLOWED_TAGS: allowedTags,
      FORBID_TAGS: blockedTags,
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "width", "height"],
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true,
      RETURN_DOM_FRAGMENT: true,
      SANITIZE_DOM: true,
    });
    const holder = document.createElement("div");
    holder.append(fragment);

    if (keepLineBreaks) {
      const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        textNodes.push(node);
      }
      for (const textNode of textNodes) {
        const valueNow = textNode.textContent || "";
        if (!valueNow.includes("\n") || !textNode.parentNode) {
          continue;
        }
        const replacement = document.createDocumentFragment();
        const parts = valueNow.split("\n");
        for (let index = 0; index < parts.length; index += 1) {
          if (index > 0) {
            replacement.append(document.createElement("br"));
          }
          replacement.append(document.createTextNode(parts[index]));
        }
        textNode.parentNode.replaceChild(replacement, textNode);
      }
    }

    function clearElementAttributes(el) {
      for (const attr of Array.from(el.attributes)) {
        el.removeAttribute(attr.name);
      }
    }

    function unwrapElement(el) {
      const parent = el.parentNode;
      if (!parent) {
        return;
      }
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }

    function sanitizeAnchorElement(el) {
      const href = sanitizeHref(el.getAttribute("href"));
      if (!href) {
        unwrapElement(el);
        return;
      }

      const target = el.getAttribute("target") === "_blank" ? "_blank" : "";
      const relTokens = new Set(
        String(el.getAttribute("rel") || "")
          .split(/\s+/)
          .map((token) => token.trim().toLowerCase())
          .filter(Boolean)
      );
      if (target === "_blank") {
        relTokens.add("noopener");
        relTokens.add("noreferrer");
      }

      clearElementAttributes(el);
      el.setAttribute("href", href);
      if (target) {
        el.setAttribute("target", target);
      }
      if (relTokens.size > 0) {
        el.setAttribute("rel", Array.from(relTokens).join(" "));
      }
      el.setAttribute("referrerpolicy", "no-referrer");
    }

    function sanitizeImageElement(el) {
      const src = sanitizeImageSrc(el.getAttribute("src"));
      if (!src) {
        el.remove();
        return;
      }

      const alt = el.getAttribute("alt");
      const title = el.getAttribute("title");
      const width = el.getAttribute("width");
      const height = el.getAttribute("height");
      clearElementAttributes(el);
      el.setAttribute("src", src);
      if (alt !== null) {
        el.setAttribute("alt", alt);
      }
      if (title) {
        el.setAttribute("title", title);
      }
      if (width && /^[0-9]{1,4}$/.test(width.trim())) {
        el.setAttribute("width", width.trim());
      }
      if (height && /^[0-9]{1,4}$/.test(height.trim())) {
        el.setAttribute("height", height.trim());
      }
      el.setAttribute("referrerpolicy", "no-referrer");
    }

    for (const el of Array.from(holder.querySelectorAll("*"))) {
      const tag = el.tagName.toLowerCase();
      if (tag === "a") {
        sanitizeAnchorElement(el);
        continue;
      }

      if (tag === "img") {
        sanitizeImageElement(el);
        continue;
      }

      clearElementAttributes(el);
    }

    return holder.innerHTML;
  }

  function wrapTextForHeading(textHtml, format) {
    let value = textHtml;
    if (format.code) {
      value = `<code>${value}</code>`;
    }
    if (format.italic) {
      value = `<i>${value}</i>`;
    }
    if (format.strong) {
      value = `<strong>${value}</strong>`;
    } else if (format.bold) {
      value = `<b>${value}</b>`;
    }
    return value;
  }

  function wrapTextForPlain(textHtml, format) {
    let value = textHtml;
    if (format.strong) {
      value = `<strong>${value}</strong>`;
    } else if (format.bold) {
      value = `<b>${value}</b>`;
    }
    if (format.italic) {
      value = `<i>${value}</i>`;
    }
    if (format.code) {
      value = `<code>${value}</code>`;
    }
    return value;
  }

  function buildRowDiv({ align, contentHtml }) {
    const safeAlign = ["left", "center", "right"].includes(align) ? align : "center";
    return `<div align="${safeAlign}">${contentHtml}</div>`;
  }

  function buildTextRow({ align, icon, textHtml, format }) {
    const iconHtml = icon ? `${escapeHtml(icon)} ` : "";
    if (format.tag !== "none") {
      const textOnly = wrapTextForHeading(textHtml, format);
      return buildRowDiv({ align, contentHtml: `<${format.tag}>${iconHtml}${textOnly}</${format.tag}>` });
    }

    const textOnly = wrapTextForPlain(textHtml, format);
    return buildRowDiv({ align, contentHtml: `${iconHtml}${textOnly}` });
  }

  function buildSafeImageTag(src, alt = "App icon") {
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" />`;
  }

  function buildWsrvUrl(url, width) {
    return `${getWeservBaseUrl()}/?url=${encodeURIComponent(String(url || "").trim())}&w=${encodeURIComponent(String(width || ""))}`;
  }

  function buildTransparentSpacerTag(width = 5) {
    const safeWidth = Math.max(1, Number.parseInt(String(width || ""), 10) || 5);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="1" viewBox="0 0 ${safeWidth} 1"></svg>`;
    const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    return `<img src="${dataUri}" />`;
  }

  function resolveGallerySpacingPreset() {
    const preset = String(getIconGallerySpacing ? getIconGallerySpacing() : "s").trim().toLowerCase();
    if (preset === "m") {
      return { horizontal: 23, rowBreaks: 2 };
    }
    if (preset === "l") {
      return { horizontal: 42, rowBreaks: 3 };
    }
    return { horizontal: 5, rowBreaks: 1 };
  }

  function normalizeItemsPerRow(value, fallback) {
    const numeric = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(8, Math.max(1, numeric));
  }

  function buildGalleryHtml() {
    const mode = getIconMode();
    if (mode !== "gallery") {
      return "";
    }

    const rawItems = Array.isArray(getIconGalleryItems()) ? getIconGalleryItems() : [];
    const items = rawItems
      .map((value) => String(value || "").trim())
      .filter((value) => value && isAllowedIconImageUrl(value))
      .slice(0, 20);
    if (items.length === 0) {
      return "";
    }

    const columns = normalizeItemsPerRow(getIconGalleryColumns(), 4);
    const scopedItems = items;
    const spacing = resolveGallerySpacingPreset();
    const spacer = buildTransparentSpacerTag(spacing.horizontal);
    const rowSeparator = Array.from({ length: Math.max(1, spacing.rowBreaks) }, () => "<br />").join("");

    const lines = [];
    for (let index = 0; index < scopedItems.length; index += columns) {
      const rowItems = scopedItems.slice(index, index + columns);
      const images = rowItems
        .map((item) => {
          const src = isWsrvResizeEnabled() ? buildWsrvUrl(item, getEl("iconScale")?.value || "100") : item;
          return buildSafeImageTag(src, "App icon");
        })
        .join(spacer);
      lines.push(images);
    }

    return `<div align="${escapeHtml(getIconAlign())}">${lines.join(rowSeparator)}</div>`;
  }

  function buildNoteHtml() {
    const byKey = {};
    const lines = [];

    const iconMode = getIconMode();
    if (iconMode === "gallery") {
      const galleryHtml = buildGalleryHtml();
      if (galleryHtml) {
        byKey.icon = [galleryHtml];
      }
    } else {
      const iconResolvedSrc = getIconResolvedSrc();
      if (iconResolvedSrc) {
        byKey.icon = [buildRowDiv({ align: getIconAlign(), contentHtml: buildSafeImageTag(iconResolvedSrc, "App icon") })];
      }
    }

    const titleText = getEl("titleText").value.trim();
    if (titleText) {
      const format = getFormat("title");
      byKey.title = [buildTextRow({ align: format.align, icon: getEl("titleEmoji").value, textHtml: textToHtml(titleText), format })];
    }

    const hostEntries = getHostEntries();
    if (hostEntries.length > 0) {
      const format = getFormat("fqdn");
      byKey.fqdn = hostEntries.map((entry) => {
        const fqdnUrl = sanitizeFqdnHref(entry.url);
        const label = textToHtml(entry.label);
        const linked = fqdnUrl
          ? `<a href="${escapeHtml(fqdnUrl)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${label}</a>`
          : label;
        return buildTextRow({ align: format.align, icon: entry.icon, textHtml: linked, format });
      });
    }

    const networkEntries = getNetworkEntries();
    if (networkEntries.length > 0) {
      const format = getFormat("network");
      byKey.network = networkEntries.map((entry) =>
        buildTextRow({ align: format.align, icon: entry.icon, textHtml: textToHtml(entry.value), format })
      );
    }

    const configLocations = getConfigLocationEntries();
    if (configLocations.length > 0) {
      const format = getFormat("config");
      byKey.config = configLocations.map((location) =>
        buildTextRow({ align: format.align, icon: location.icon, textHtml: textToHtml(location.value), format })
      );
    }

    for (const customRow of getCustomRowEntries()) {
      const text = customRow.text.trim();
      if (!text) {
        continue;
      }
      const format = getFormat(customRow.id);
      byKey[customRow.id] = [buildTextRow({ align: format.align, icon: "", textHtml: sanitizeCustomHtml(text, true), format })];
    }

    for (const key of getOrderedRowKeys()) {
      if (!isRowVisible(key)) {
        continue;
      }
      const section = byKey[key];
      if (!section) {
        continue;
      }
      lines.push(...section);
    }

    return lines.join("\n");
  }

  return {
    buildNoteHtml,
  };
}
