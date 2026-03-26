import { buildOptimizedPicture, encoded } from "./media.js";

const SLIDE_INTERVAL_MS = 4000;

/** @type {HTMLElement | null} */
let albumModalEl = null;

/** @type {(() => void) | null} */
let albumCloseCallback = null;

export function initProjectsGallery() {
  const host = document.getElementById("projectsGallery");
  if (!host) return;

  fetch("projects/projects.json")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    })
    .then(async (projects) => {
      if (!Array.isArray(projects) || !projects.length) {
        host.innerHTML = '<p class="projects-gallery__empty">No projects to show yet.</p>';
        return;
      }
      host.innerHTML = "";

      const SOCIAL_INSTALL_SLUG = "socialInstall";
      for (const project of projects) {
        // Southern Social install: only the big slideshow goes in the main gallery.
        if (project?.slug === SOCIAL_INSTALL_SLUG) {
          const landscape = await createProjectSection(project, {
            variant: "landscape",
            showAlbumButton: true,
          });
          if (landscape) host.appendChild(landscape);
          continue;
        }

        const section = await createProjectSection(project, {
          variant: "landscape",
          showAlbumButton: true,
        });
        if (section) host.appendChild(section);
      }
    })
    .catch(() => {
      host.innerHTML = '<p class="projects-gallery__error">Unable to load projects right now.</p>';
    });
}

/**
 * @param {{ src?: string; alt?: string; type?: string }} item
 * @returns {Promise<HTMLElement>}
 */
async function buildMediaElement(item) {
  if (!item?.src) {
    const span = document.createElement("span");
    span.textContent = "";
    return span;
  }
  const src = item.src;
  const alt = item.alt || "";
  const t = (item.type || "").toLowerCase();

  if (t === "gif" || /\.gif$/i.test(src)) {
    const img = document.createElement("img");
    img.src = encoded(src);
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.className = "projects-slideshow__img";
    return img;
  }

  if (t === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.loop = true;
    video.muted = true;
    video.preload = "metadata";
    video.src = encoded(src);
    video.setAttribute("playsinline", "");
    video.className = "projects-slideshow__video";
    if (alt) video.setAttribute("aria-label", alt);
    return video;
  }

  const { picture } = await buildOptimizedPicture({
    src,
    alt,
    loading: "lazy",
    fetchPriority: "low",
  });
  picture.classList.add("projects-slideshow__picture");
  return picture;
}

function ensureAlbumModal() {
  if (albumModalEl) return albumModalEl;

  const el = document.createElement("div");
  el.id = "projects-album-modal";
  el.className = "projects-album-modal hidden";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("aria-labelledby", "projects-album-title");

  const backdrop = document.createElement("div");
  backdrop.className = "projects-album-modal__backdrop";

  const panel = document.createElement("div");
  panel.className = "projects-album-modal__panel";

  const header = document.createElement("div");
  header.className = "projects-album-modal__header";

  const title = document.createElement("h3");
  title.id = "projects-album-title";
  title.className = "projects-album-modal__title panel-heading text-sm";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "projects-album-modal__close";
  closeBtn.setAttribute("aria-label", "Close album");
  closeBtn.innerHTML = '<span aria-hidden="true">×</span>';

  const grid = document.createElement("div");
  grid.className = "projects-album-modal__grid";
  grid.id = "projects-album-grid";

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);
  panel.appendChild(grid);
  el.appendChild(backdrop);
  el.appendChild(panel);
  document.body.appendChild(el);

  const close = () => {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    const cb = albumCloseCallback;
    albumCloseCallback = null;
    if (typeof cb === "function") cb();
  };

  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.classList.contains("hidden")) {
      e.preventDefault();
      close();
    }
  });

  albumModalEl = el;
  return el;
}

/**
 * @param {{ title?: string }} project
 * @param {Array<{ src?: string; alt?: string; type?: string }>} items
 * @param {{ onClose?: () => void }} [options]
 */
async function openProjectsAlbum(project, items, options) {
  albumCloseCallback = options?.onClose ?? null;
  const modal = ensureAlbumModal();
  const titleEl = modal.querySelector("#projects-album-title");
  const grid = modal.querySelector("#projects-album-grid");
  if (!titleEl || !grid) return;

  titleEl.textContent = (project.title && String(project.title).trim()) || "Project album";
  grid.replaceChildren();

  for (const item of items) {
    if (!item?.src) continue;
    const cell = document.createElement("div");
    cell.className = "projects-album-modal__cell";
    const inner = document.createElement("div");
    inner.className = "projects-album-modal__thumb";
    const media = await buildMediaElement(item);
    inner.appendChild(media);
    cell.appendChild(inner);
    grid.appendChild(cell);
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const closeBtn = modal.querySelector(".projects-album-modal__close");
  if (closeBtn instanceof HTMLElement) closeBtn.focus();
}

/**
 * @param {{ slug?: string; title?: string; items?: Array<{ src?: string; alt?: string; type?: string }> }} project
 */
async function createProjectSection(project, options = {}) {
  if (!project || !Array.isArray(project.items)) return null;
  const items = project.items.filter((it) => it?.src);
  if (!items.length) return null;

  const variant = options.variant === "portrait" ? "portrait" : "landscape";
  const showAlbumButton = options.showAlbumButton !== false;
  const isSmall = options.small === true;

  const section = document.createElement("section");
  section.className = "project-section";

  const root = document.createElement("div");
  root.className = "projects-slideshow projects-slideshow--crossfade";
  if (variant === "portrait") root.classList.add("projects-slideshow--portrait");
  if (isSmall) root.classList.add("projects-slideshow--small");
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Installation photos");

  const stage = document.createElement("div");
  stage.className = "projects-slideshow__stage projects-slideshow__stage--crossfade";

  const layerA = document.createElement("div");
  layerA.className = "projects-slideshow__layer visible";
  const layerB = document.createElement("div");
  layerB.className = "projects-slideshow__layer";

  stage.appendChild(layerA);
  stage.appendChild(layerB);

  let albumBtn = null;
  if (showAlbumButton) {
    albumBtn = document.createElement("button");
    albumBtn.type = "button";
    albumBtn.className = "projects-slideshow__album-btn";
    albumBtn.textContent = "View full album";
  }

  root.appendChild(stage);
  if (albumBtn) root.appendChild(albumBtn);
  section.appendChild(root);

  /** @type {(HTMLElement | null)[]} */
  const cache = new Array(items.length).fill(null);

  let currentIndex = 0;
  /** @type {HTMLDivElement} */
  let activeLayer = layerA;
  /** @type {HTMLDivElement} */
  let inactiveLayer = layerB;

  /** @type {ReturnType<typeof setInterval> | null} */
  let timerId = null;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  async function ensureMedia(index) {
    if (cache[index]) return cache[index];
    const node = await buildMediaElement(items[index]);
    cache[index] = node;
    return node;
  }

  async function advance() {
    const len = items.length;
    if (len < 2) return;
    const next = (currentIndex + 1) % len;
    const el = await ensureMedia(next);
    inactiveLayer.replaceChildren(el);
    requestAnimationFrame(() => {
      inactiveLayer.classList.add("visible");
      activeLayer.classList.remove("visible");
      const prev = activeLayer;
      activeLayer = inactiveLayer;
      inactiveLayer = prev;
      currentIndex = next;
    });
  }

  function startAutoplay() {
    if (items.length < 2 || reducedMotion.matches) return;
    timerId = window.setInterval(() => {
      if (!document.hidden) void advance();
    }, SLIDE_INTERVAL_MS);
  }

  function stopAutoplay() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  if (albumBtn) {
    albumBtn.addEventListener("click", () => {
      stopAutoplay();
      void openProjectsAlbum(project, items, { onClose: () => startAutoplay() });
    });
  }

  const first = await ensureMedia(0);
  activeLayer.replaceChildren(first);
  currentIndex = 0;

  if (items.length >= 2) {
    startAutoplay();
  }

  const onReducedChange = () => {
    stopAutoplay();
    if (!reducedMotion.matches && items.length >= 2) startAutoplay();
  };
  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", onReducedChange);
  } else if (typeof reducedMotion.addListener === "function") {
    reducedMotion.addListener(onReducedChange);
  }

  return section;
}
