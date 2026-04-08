export const MAX_OUTPUT_LENGTH = 8192;
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;
export const MAX_UPLOAD_SVG_BYTES = 1024 * 1024;
export const MAX_UPLOAD_RASTER_BYTES = 6 * 1024;
export const MAX_FETCHED_SVG_BYTES = 1024 * 1024;
export const GITHUB_STARS_CACHE_TTL_MS = 15 * 60 * 1000;
export const GITHUB_RELEASE_CACHE_TTL_MS = 15 * 60 * 1000;

export const APP_STATE_STORAGE_KEY = "pve-notebuddy:state-v1";
export const LEGACY_EMOJI_RAIL_STORAGE_KEY = "pve-notebuddy:emoji-rail-collapsed";
export const LEGACY_LOCAL_TEMPLATES_STORAGE_KEY = "pve-notebuddy:local-templates-v1";
export const LEGACY_SIDEBAR_COLLAPSED_STORAGE_KEY = "pve-notebuddy:sidebar-collapsed";
export const MIN_DESKTOP_VIEWPORT_WIDTH = 1200;

export const DEFAULT_APP_STATE = Object.freeze({
  ui: {
    sidebarCollapsed: false,
    activeSidebarPanel: "templates",
  },
  settings: {
    weservDomain: "",
    svgPreferredMode: "embed",
  },
  templates: {
    localCatalog: [],
  },
});

export const PROXMOX_NOTE_EMOJI_GROUPS = [
  {
    title: "Infrastructure & Network",
    items: ["🏠", "🌐", "🔗", "🛰️", "📡", "🛜", "🌍", "🌎", "🌏", "🚀", "🧭", "🗺️"],
  },
  {
    title: "Systems & Hardware",
    items: ["🖥️", "💻", "📱", "⌨️", "🖱️", "🖨️", "🧰", "🧲", "🔌", "🔋", "⚙️", "🛠️"],
  },
  {
    title: "Services & Platforms",
    items: ["📦", "🐳", "☸️", "🧱", "🧩", "🧪", "🧠", "🔧", "🧵", "🔀", "🪄", "📺"],
  },
  {
    title: "Storage & Data",
    items: ["💾", "💽", "🗄️", "🗃️", "📁", "📂", "🗂️", "📋", "📊", "🧾", "📎", "🖇️"],
  },
  {
    title: "Security & Monitoring",
    items: ["🔐", "🔓", "🛡️", "🔒", "🕵️", "🔍", "🔎", "🚨", "🚧", "🔥", "🧯", "📈"],
  },
  {
    title: "Status & Actions",
    items: ["✅", "☑️", "❌", "🚫", "⚠️", "❗️", "⭕️", "🔹", "🔸", "➡️", "⭐️", "💎"],
  },
];
