import {
  ensureCrtShell,
  injectNav,
  lazyHydrateEmbeds,
  registerServiceWorker,
  setIdleWatchers,
} from "./modules/core.js?v=20260351";
// Site Tuner: local dev only (see docs/SITE_TUNING_POLICY.md) — not loaded on production hostnames
import { initHomeSlideshow } from "./modules/home.js";
import { initPosterCarousel } from "./modules/artwork.js";
import { initPhotoAlbum } from "./modules/photo-album.js";
import { initProjectsGallery } from "./modules/projects.js";

ensureCrtShell();
injectNav();
setIdleWatchers();
lazyHydrateEmbeds();
registerServiceWorker();
{
  const h = location.hostname;
  const allowTune =
    h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
  if (allowTune) {
    import("./modules/site-tune.js?v=20260398")
      .then((m) => m.initSiteTuning())
      .catch((err) => console.warn("[site-tune] failed to load:", err));
  }
}

const page = document.body?.getAttribute("data-page");
if (page === "index") {
  initHomeSlideshow();
}
if (page === "artwork") initPosterCarousel();
if (page === "photo-album") {
  initPhotoAlbum();
  // Dynamically load upload module only when ?upload is in the URL
  if (new URLSearchParams(location.search).has("upload")) {
    import("./modules/photo-upload.js").then((m) => m.initPhotoUpload());
  }
}
if (page === "projects") initProjectsGallery();
