import { encoded } from "./media.js";

export function initHomeSlideshow() {
  const slide1 = document.getElementById("slide1");
  const slide2 = document.getElementById("slide2");
  if (!slide1 || !slide2) return;

  let currentIndex = 0;
  let entries = [];

  const chooseVariant = (entry) => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const variant = isMobile ? entry.mobile : entry.desktop;
    return variant || entry.desktop || entry.mobile;
  };

  const setSlideSrc = (img, entry) => {
    const variant = chooseVariant(entry);
    if (!variant) return;
    img.onerror = () => {
      img.src = encoded(variant.fallback);
    };
    img.src = encoded(variant.webp || variant.fallback);
  };

  const showNext = () => {
    if (!entries.length) return;
    const visible = slide1.classList.contains("visible") ? slide1 : slide2;
    const hidden = visible === slide1 ? slide2 : slide1;
    currentIndex = (currentIndex + 1) % entries.length;
    setSlideSrc(hidden, entries[currentIndex]);
    requestAnimationFrame(() => {
      visible.classList.remove("visible");
      hidden.classList.add("visible");
    });
  };

  fetch("slides.optimized.json")
    .then((r) => r.json())
    .then((data) => {
      if (!Array.isArray(data) || data.length < 2) return;
      entries = data;
      setSlideSrc(slide1, entries[0]);
      setSlideSrc(slide2, entries[1]);
      slide1.classList.add("visible");
      setInterval(() => {
        if (!document.hidden) showNext();
      }, 3000);
    })
    .catch(() => {});
}
