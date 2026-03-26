import {
  ensureCrtShell,
  injectNav,
  lazyHydrateEmbeds,
  registerServiceWorker,
  setIdleWatchers,
} from "./modules/core.js?v=20260351";
import { initHomeSlideshow, initCalendarForm } from "./modules/home.js";
import { initPosterCarousel } from "./modules/artwork.js";
import { initPhotoAlbum } from "./modules/photo-album.js";
import { initProjectsGallery } from "./modules/projects.js";

ensureCrtShell();
injectNav();
setIdleWatchers();
lazyHydrateEmbeds();
registerServiceWorker();

const page = document.body?.getAttribute("data-page");
if (page === "index") {
  initHomeSlideshow();
  void initCalendarForm();
}
if (page === "artwork") initPosterCarousel();
if (page === "photo-album") initPhotoAlbum();
if (page === "projects") initProjectsGallery();
