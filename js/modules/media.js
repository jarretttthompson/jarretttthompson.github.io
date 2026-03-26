export function encoded(url) {
  return encodeURI(url);
}

export function optimizedBasePath(src) {
  const trimmed = src.replace(/^\.\//, "");
  return `optimized/${trimmed.replace(/\.[^.]+$/, "")}`;
}

/** Default sizes= when variants.json has no entry (legacy single-file derivatives). */
export const DEFAULT_PICTURE_SIZES =
  "(max-width: 480px) 88vw, (max-width: 768px) 55vw, (max-width: 1200px) 38vw, 360px";

let variantsManifest = null;
let variantsPromise = null;

export async function loadVariantsManifest() {
  if (variantsManifest) return variantsManifest;
  if (!variantsPromise) {
    variantsPromise = fetch(encoded("optimized/variants.json"))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  variantsManifest = await variantsPromise;
  return variantsManifest;
}

export function getVariantEntry(manifest, src) {
  if (!manifest || !src) return null;
  const key = optimizedBasePath(src);
  return manifest[key] || null;
}

function buildSrcsetFromTiers(tiers, prop) {
  if (!tiers?.length) return "";
  const parts = [];
  for (const t of tiers) {
    const url = t[prop];
    const w = t.w;
    if (url && w) parts.push(`${encoded(url)} ${w}w`);
  }
  return parts.join(", ");
}

function pickLargestJpgFromTiers(tiers) {
  if (!tiers?.length) return null;
  let best = null;
  for (const t of tiers) {
    if (!t.jpg) continue;
    if (!best || (t.w ?? 0) > (best.w ?? 0)) best = t;
  }
  return best?.jpg || null;
}

/**
 * Largest JPEG URL for “open full” links (responsive tier bundle).
 */
export async function optimizedFullJpegUrl(src) {
  const manifest = await loadVariantsManifest();
  const entry = getVariantEntry(manifest, src);
  const fromTiers = pickLargestJpgFromTiers(entry?.tiers);
  if (fromTiers) return fromTiers;
  return `${optimizedBasePath(src)}.jpg`;
}

/**
 * Build <picture> with AVIF + WebP + JPEG srcsets when variants.json lists tiers;
 * otherwise fall back to legacy single-file paths under optimized/.
 */
export async function buildOptimizedPicture({
  src,
  alt = "",
  className = "",
  loading = "lazy",
  decoding = "async",
  fetchPriority = "low",
  sizes: sizesOverride = null,
}) {
  const picture = document.createElement("picture");
  const base = optimizedBasePath(src);
  const manifest = await loadVariantsManifest();
  const entry = getVariantEntry(manifest, src);
  const sizes = sizesOverride || entry?.sizes || DEFAULT_PICTURE_SIZES;
  const tiers = entry?.tiers;

  if (tiers?.length) {
    const avifSet = buildSrcsetFromTiers(tiers, "avif");
    const webpSet = buildSrcsetFromTiers(tiers, "webp");
    const jpgSet = buildSrcsetFromTiers(tiers, "jpg");

    if (avifSet) {
      const avif = document.createElement("source");
      avif.type = "image/avif";
      avif.srcset = avifSet;
      avif.sizes = sizes;
      picture.appendChild(avif);
    }
    if (webpSet) {
      const webp = document.createElement("source");
      webp.type = "image/webp";
      webp.srcset = webpSet;
      webp.sizes = sizes;
      picture.appendChild(webp);
    }

    const img = document.createElement("img");
    const jpgs = tiers.map((t) => t.jpg).filter(Boolean);
    img.src = encoded(jpgs[jpgs.length - 1] || `${base}.jpg`);
    if (jpgSet) {
      img.srcset = jpgSet;
      img.sizes = sizes;
    }
    img.alt = alt;
    if (className) img.className = className;
    img.loading = loading;
    img.decoding = decoding;
    img.fetchPriority = fetchPriority;

    img.addEventListener(
      "error",
      () => {
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        img.src = encoded(src);
      },
      { once: true },
    );

    picture.appendChild(img);
    return { picture, img };
  }

  /* Legacy single derivative */
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

  img.addEventListener(
    "error",
    () => {
      img.src = encoded(src);
    },
    { once: true },
  );

  picture.appendChild(avif);
  picture.appendChild(webp);
  picture.appendChild(img);

  return { picture, img };
}
