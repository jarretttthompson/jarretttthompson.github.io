import {
  ensureCrtShell,
  injectNav,
  lazyHydrateEmbeds,
  registerServiceWorker,
  setIdleWatchers,
  startHeaderFlicker,
  weatherWidget,
} from "./modules/core.js";
import { initHomeSlideshow } from "./modules/home.js";
import { initPosterCarousel } from "./modules/artwork.js";
import { initPhotoAlbum } from "./modules/photo-album.js";
import { initProjectsGallery } from "./modules/projects.js";

ensureCrtShell();
injectNav();
setIdleWatchers();
startHeaderFlicker();
weatherWidget();
lazyHydrateEmbeds();
registerServiceWorker();

if (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  import("./dev-toolbar.js");

const page = document.body?.getAttribute("data-page");
if (page === "index") initHomeSlideshow();
if (page === "page3") initPosterCarousel();
if (page === "photo-album") initPhotoAlbum();
if (page === "page4") initProjectsGallery();
