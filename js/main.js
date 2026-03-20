import {
  ensureCrtShell,
  injectNav,
  lazyHydrateEmbeds,
  registerServiceWorker,
  setIdleWatchers,
  startHeaderFlicker,
} from "./modules/core.js?v=20260332";
import { initHomeSlideshow, initCalendarForm } from "./modules/home.js";
import { initPosterCarousel } from "./modules/artwork.js";
import { initPhotoAlbum } from "./modules/photo-album.js";
import { initProjectsGallery } from "./modules/projects.js";

ensureCrtShell();
injectNav();
setIdleWatchers();
startHeaderFlicker();
lazyHydrateEmbeds();
registerServiceWorker();

const page = document.body?.getAttribute("data-page");
if (page === "index") { initHomeSlideshow(); initCalendarForm(); }
if (page === "page3") initPosterCarousel();
if (page === "photo-album") initPhotoAlbum();
if (page === "page4") initProjectsGallery();
