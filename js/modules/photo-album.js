import { buildOptimizedPicture, encoded } from "./media.js";

export function initPhotoAlbum() {
  const gallery = document.getElementById("photoGallery");
  if (!gallery) return;

  const deriveAltFromSrc = (src) => {
    const file = src.split("/").pop() || "";
    return file.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Photo";
  };

  const normalizePhoto = (item) => {
    if (!item?.src) return null;
    const alt = item.alt && item.alt !== "N" ? item.alt : deriveAltFromSrc(item.src);
    return { src: item.src, alt };
  };

  fetch("photo-album.json")
    .then((response) => {
      if (!response.ok) throw new Error("Unable to load photo manifest");
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error("Invalid photo manifest");
      const photos = data.map(normalizePhoto).filter(Boolean);
      if (!photos.length) throw new Error("No photos found");
      render(photos);
    })
    .catch(() => {
      gallery.innerHTML = '<p class="photo-gallery__loading">Unable to load photos right now.</p>';
    });

  function render(items) {
    gallery.innerHTML = "";
    const frag = document.createDocumentFragment();
    items.forEach((photo, index) => {
      const link = document.createElement("a");
      link.className = "album-link";
      link.href = encoded(photo.src);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Open full image: ${photo.alt}`);

      const card = document.createElement("figure");
      card.className = "framed-photo album-card";

      const { picture, img } = buildOptimizedPicture({
        src: photo.src,
        alt: photo.alt,
        loading: index < 8 ? "eager" : "lazy",
        fetchPriority: index < 4 ? "high" : "low",
      });
      img.classList.add("album-image");

      card.appendChild(picture);
      link.appendChild(card);
      frag.appendChild(link);
    });
    gallery.appendChild(frag);
  }
}
