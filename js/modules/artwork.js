import { buildOptimizedPicture, loadVariantsManifest } from "./media.js";

export function initPosterCarousel() {
  const manualTrack = document.getElementById("posterCarouselManual");
  if (!manualTrack) return;

  const dotsContainer = document.getElementById("posterCarouselDots");
  const manualViewport = manualTrack.closest('[data-carousel="manual"]');
  const prevBtn = document.querySelector(".poster-carousel__control--prev");
  const nextBtn = document.querySelector(".poster-carousel__control--next");

  fetch("posters.json")
    .then((r) => r.json())
    .then(async (list) => {
      if (!Array.isArray(list) || !list.length) return;
      await loadVariantsManifest();
      const cards = await Promise.all(list.map((name) => createPosterCard(name)));
      for (const card of cards) {
        if (card) manualTrack.appendChild(card);
      }
      initControls(manualViewport, manualTrack, dotsContainer, prevBtn, nextBtn);
    })
    .catch(() => {});
}

async function createPosterCard(filename) {
  const card = document.createElement("div");
  card.className = "poster-card";
  const src = `posterPortfolio/${filename}`;
  const { picture } = await buildOptimizedPicture({
    src,
    alt: filename.replace(/[-_]/g, " ").replace(/\.[a-zA-Z0-9]+$/, ""),
    loading: "lazy",
    fetchPriority: "low",
  });
  card.appendChild(picture);
  return card;
}

function initControls(viewport, track, dotsContainer, prevBtn, nextBtn) {
  if (!viewport || !track) return;
  const carouselRoot = viewport.closest(".poster-carousel--manual");
  const getVisibleCount = () => {
    const value = parseFloat(getComputedStyle(carouselRoot).getPropertyValue("--poster-cards-visible"));
    return Number.isFinite(value) && value > 0 ? value : 1;
  };

  let visibleCount = getVisibleCount();
  let pageCount = Math.max(1, Math.ceil(track.children.length / visibleCount));
  let currentPage = 0;

  const buildDots = () => {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = "";
    for (let i = 0; i < pageCount; i += 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "poster-carousel__dot";
      dot.setAttribute("aria-label", `Go to poster group ${i + 1}`);
      if (i === currentPage) dot.setAttribute("aria-current", "true");
      dot.addEventListener("click", () => goToPage(i));
      dotsContainer.appendChild(dot);
    }
  };

  const updateDots = () => {
    if (!dotsContainer) return;
    [...dotsContainer.children].forEach((dot, index) => {
      if (index === currentPage) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  };

  const goToPage = (index) => {
    currentPage = (index + pageCount) % pageCount;
    const target = currentPage * viewport.clientWidth;
    viewport.scrollTo({ left: target, behavior: "smooth" });
    updateDots();
  };

  prevBtn?.addEventListener("click", () => goToPage(currentPage - 1));
  nextBtn?.addEventListener("click", () => goToPage(currentPage + 1));
  viewport.addEventListener("scroll", () => {
    const ratio = viewport.scrollLeft / viewport.clientWidth;
    currentPage = Math.round(ratio);
    updateDots();
  }, { passive: true });

  window.addEventListener("resize", () => {
    visibleCount = getVisibleCount();
    pageCount = Math.max(1, Math.ceil(track.children.length / visibleCount));
    currentPage = Math.min(currentPage, pageCount - 1);
    buildDots();
    goToPage(currentPage);
  });

  buildDots();
  goToPage(0);
}
