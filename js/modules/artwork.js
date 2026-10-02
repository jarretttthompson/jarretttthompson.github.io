import { buildOptimizedPicture, getVariantEntry, loadVariantsManifest } from "./media.js";

/**
 * Artwork walls: equal-width columns, each picture at its own proportions. Cards are dealt into
 * whichever column is currently shortest so the order in the list reads across the top.
 */
export function initArtworkWalls() {
  initWall({
    wallId: "paintingWall",
    listUrl: "paintings.json",
    noun: "painting",
    toItem: (entry) => (entry?.src ? { src: entry.src, caption: entry.alt && entry.alt !== "N" ? entry.alt : "" } : null),
  });
  initWall({
    wallId: "posterWall",
    listUrl: "posters.json",
    noun: "poster",
    toItem: (name) => (typeof name === "string" && name ? { src: `posterPortfolio/${name}`, caption: "" } : null),
  });
}

function initWall({ wallId, listUrl, noun, toItem }) {
  const wall = document.getElementById(wallId);
  if (!wall) return;

  fetch(listUrl)
    .then((r) => r.json())
    .then(async (list) => {
      if (!Array.isArray(list)) return;
      const items = list.map(toItem).filter(Boolean);
      if (!items.length) return;
      const manifest = await loadVariantsManifest();
      const lightbox = createLightbox(items, noun);
      const cards = await Promise.all(items.map((item, index) => createCard(item, index, noun, manifest, lightbox)));

      const getColumnCount = () => {
        const value = parseInt(getComputedStyle(wall).getPropertyValue("--art-wall-cols"), 10);
        return Number.isFinite(value) && value > 0 ? value : 1;
      };
      let columnCount = 0;
      const layout = () => {
        const next = getColumnCount();
        if (next === columnCount) return;
        columnCount = next;
        const columns = Array.from({ length: columnCount }, () => {
          const col = document.createElement("div");
          col.className = "art-wall__col";
          return { col, height: 0 };
        });
        for (const card of cards) {
          const shortest = columns.reduce((a, b) => (b.height < a.height ? b : a));
          shortest.col.appendChild(card.el);
          shortest.height += card.ratio;
        }
        wall.replaceChildren(...columns.map((c) => c.col));
      };
      layout();
      window.addEventListener("resize", layout);
    })
    .catch(() => {});
}

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

async function createCard(item, index, noun, manifest, lightbox) {
  const figure = document.createElement("figure");
  figure.className = "art-card";

  const open = document.createElement("button");
  open.type = "button";
  open.className = "art-card__open";
  open.setAttribute("aria-label", `View larger: ${item.caption || `${noun} ${index + 1}`}`);
  open.addEventListener("click", () => lightbox.show(index));

  const { picture, img } = await buildOptimizedPicture({
    src: item.src,
    alt: item.caption || `${capitalize(noun)} ${index + 1}`,
    loading: "lazy",
    fetchPriority: "low",
  });
  // Known proportions reserve the space before the file arrives, so the wall never jumps.
  const tiers = getVariantEntry(manifest, item.src)?.tiers;
  const largest = tiers?.[tiers.length - 1];
  let ratio = 1;
  if (largest?.w && largest?.h) {
    img.width = largest.w;
    img.height = largest.h;
    ratio = largest.h / largest.w;
  }
  open.appendChild(picture);
  figure.appendChild(open);

  if (item.caption) {
    const text = document.createElement("figcaption");
    text.className = "art-card__caption";
    text.textContent = item.caption;
    figure.appendChild(text);
  }
  return { el: figure, ratio };
}

function createLightbox(items, noun) {
  const dialog = document.createElement("dialog");
  dialog.className = "art-lightbox";
  dialog.setAttribute("aria-label", `${capitalize(noun)}, larger view`);

  const button = (className, label, glyph) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `art-lightbox__btn ${className}`;
    el.setAttribute("aria-label", label);
    el.innerHTML = `<span aria-hidden="true">${glyph}</span>`;
    return el;
  };
  const closeBtn = button("art-lightbox__btn--close", "Close", "×");
  const prevBtn = button("art-lightbox__btn--prev", `Previous ${noun}`, "‹");
  const nextBtn = button("art-lightbox__btn--next", `Next ${noun}`, "›");

  const figure = document.createElement("figure");
  figure.className = "art-lightbox__figure";
  const stage = document.createElement("div");
  stage.className = "art-lightbox__stage";
  const caption = document.createElement("figcaption");
  caption.className = "art-lightbox__caption";
  figure.append(stage, caption);

  dialog.append(figure, closeBtn, prevBtn, nextBtn);
  document.body.appendChild(dialog);

  let current = 0;
  const render = async (index) => {
    current = (index + items.length) % items.length;
    const item = items[current];
    const { picture } = await buildOptimizedPicture({
      src: item.src,
      alt: item.caption || `${capitalize(noun)} ${current + 1}`,
      loading: "eager",
      fetchPriority: "high",
      sizes: "96vw",
    });
    if (items[current] !== item) return;
    stage.replaceChildren(picture);
    caption.textContent = [item.caption, `${current + 1} / ${items.length}`].filter(Boolean).join(" · ");
  };

  closeBtn.addEventListener("click", () => dialog.close());
  prevBtn.addEventListener("click", () => render(current - 1));
  nextBtn.addEventListener("click", () => render(current + 1));
  // The dialog fills the screen, so a click that lands on it (not on the picture or a button) is the backdrop.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target === figure || e.target === stage) dialog.close();
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") render(current - 1);
    else if (e.key === "ArrowRight") render(current + 1);
  });

  return {
    show(index) {
      render(index);
      if (!dialog.open) dialog.showModal();
    },
  };
}
