import { buildOptimizedPicture } from "./media.js";

export function initProjectsGallery() {
  const host = document.getElementById("projectsGallery");
  if (!host) return;

  fetch("projects/projects.json")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    })
    .then((projects) => {
      if (!Array.isArray(projects) || !projects.length) {
        host.innerHTML = '<p class="projects-gallery__empty">No projects to show yet.</p>';
        return;
      }
      host.innerHTML = "";
      projects.forEach((project) => {
        const section = createProjectSection(project);
        if (section) host.appendChild(section);
      });
    })
    .catch(() => {
      host.innerHTML = '<p class="projects-gallery__error">Unable to load projects right now.</p>';
    });
}

function createProjectSection(project) {
  if (!project || !Array.isArray(project.items) || project.items.length === 0) return null;
  const section = document.createElement("section");
  section.className = "project-section";

  const carousel = document.createElement("div");
  carousel.className = "poster-carousel poster-carousel--manual projects-carousel";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "poster-carousel__control poster-carousel__control--prev";
  prevBtn.setAttribute("aria-label", "Show previous media");
  prevBtn.innerHTML = '<span aria-hidden="true">‹</span>';

  const viewport = document.createElement("div");
  viewport.className = "poster-carousel__viewport";
  const track = document.createElement("div");
  track.className = "poster-carousel__track";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "poster-carousel__control poster-carousel__control--next";
  nextBtn.setAttribute("aria-label", "Show next media");
  nextBtn.innerHTML = '<span aria-hidden="true">›</span>';

  project.items.forEach((item) => {
    if (!item?.src) return;
    const card = document.createElement("div");
    card.className = "poster-card project-card";
    if (item.type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.loop = true;
      video.muted = true;
      video.preload = "metadata";
      video.src = item.src;
      video.setAttribute("playsinline", "");
      if (item.alt) video.setAttribute("aria-label", item.alt);
      card.appendChild(video);
    } else {
      const { picture } = buildOptimizedPicture({
        src: item.src,
        alt: item.alt || "",
      });
      card.appendChild(picture);
    }
    track.appendChild(card);
  });

  if (!track.children.length) return null;
  viewport.appendChild(track);
  carousel.appendChild(prevBtn);
  carousel.appendChild(viewport);
  carousel.appendChild(nextBtn);
  section.appendChild(carousel);
  setupControls(viewport, prevBtn, nextBtn);
  return section;
}

function setupControls(viewport, prevBtn, nextBtn) {
  const track = viewport.firstElementChild;
  if (!track) return;
  const tolerance = 4;
  const updateControls = () => {
    const maxScroll = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const canScroll = maxScroll > tolerance;
    prevBtn.disabled = !canScroll || viewport.scrollLeft <= tolerance;
    nextBtn.disabled = !canScroll || viewport.scrollLeft >= maxScroll - tolerance;
  };

  const scrollByAmount = () => viewport.clientWidth * 0.9;
  prevBtn.addEventListener("click", () => viewport.scrollBy({ left: -scrollByAmount(), behavior: "smooth" }));
  nextBtn.addEventListener("click", () => viewport.scrollBy({ left: scrollByAmount(), behavior: "smooth" }));
  viewport.addEventListener("scroll", updateControls, { passive: true });
  window.addEventListener("resize", updateControls);

  requestAnimationFrame(() => {
    viewport.scrollLeft = 0;
    updateControls();
  });
}
