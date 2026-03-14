export function encoded(url) {
  return encodeURI(url);
}

export function optimizedBasePath(src) {
  const trimmed = src.replace(/^\.\//, "");
  return `optimized/${trimmed.replace(/\.[^.]+$/, "")}`;
}

export function buildOptimizedPicture({
  src,
  alt = "",
  className = "",
  loading = "lazy",
  decoding = "async",
  fetchPriority = "low",
}) {
  const picture = document.createElement("picture");
  const base = optimizedBasePath(src);

  const avif = document.createElement("source");
  avif.type = "image/avif";
  avif.srcset = encoded(`${base}.avif`);

  const webp = document.createElement("source");
  webp.type = "image/webp";
  webp.srcset = encoded(`${base}.webp`);

  const img = document.createElement("img");
  img.src = encoded(`${base}.jpg`);
  img.alt = alt;
  if (className) img.className = className;
  img.loading = loading;
  img.decoding = decoding;
  img.fetchPriority = fetchPriority;

  // Fallback to original if optimized derivative is missing.
  img.addEventListener("error", () => {
    img.src = encoded(src);
  }, { once: true });

  picture.appendChild(avif);
  picture.appendChild(webp);
  picture.appendChild(img);

  return { picture, img };
}
