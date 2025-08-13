// ---- Shared nav injection ----
(function injectNav(){
  const container = document.querySelector('.nav-boxes');
  if (!container) return;
  fetch('partials/nav.html')
    .then(r => r.text())
    .then(html => {
      container.outerHTML = html; // replace existing nav markup
      const current = document.body.getAttribute('data-page');
      if (current) {
        document
          .querySelectorAll(`nav a[data-page]`)
          .forEach(a => {
            if (a.dataset.page === current) a.setAttribute('aria-current','page');
          });
      }
    })
    .catch(()=>{});
})();

// ---- Setup ----
let slideImages = [];
let currentIndex = 0;
let idleTimer = null;
const IDLE_TIMEOUT = 15000; // 15s then pause animations

function setIdleWatchers() {
  const body = document.body;
  const resetIdle = () => {
    body.classList.remove('no-anim');
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => body.classList.add('no-anim'), IDLE_TIMEOUT);
  };
  ['mousemove','keydown','touchstart','scroll','click'].forEach(evt =>
    window.addEventListener(evt, resetIdle, { passive: true })
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) body.classList.add('no-anim');
    else resetIdle();
  });
  resetIdle();
}

// Get slide image elements
const slide1 = document.getElementById('slide1');
const slide2 = document.getElementById('slide2');

// ---- Fetch the JSON file ----
fetch('slides.json')  // ✅ updated to match root folder
  .then(response => response.json())
  .then(data => {
    // Prepend the folder path to each filename
    slideImages = data.map(filename => `slideshow/${filename}`);
    if (slideImages.length < 2) return; // Need at least 2 images

    // Set initial images
    slide1.src = slideImages[0];
    slide2.src = slideImages[1];
    slide1.classList.add('visible');

    // Start the loop
    setInterval(showNextSlide, 3000);
  })
  .catch(err => {
    console.error('Failed to load slides.json:', err);
  });

// ---- Swap slides ----
function showNextSlide() {
  const visibleSlide = slide1?.classList.contains('visible') ? slide1 : slide2;
  const hiddenSlide = visibleSlide === slide1 ? slide2 : slide1;
  if (!visibleSlide || !hiddenSlide) return;

  currentIndex = (currentIndex + 1) % slideImages.length;
  hiddenSlide.src = slideImages[currentIndex];

  setTimeout(() => {
    visibleSlide.classList.remove('visible');
    hiddenSlide.classList.add('visible');
  }, 100);
}

// ---- flickering effect ----
function randomFlicker() {
  const h1 = document.getElementById('lightbulb');
  if (!h1) return;
  const opacity = Math.random() > 0.9 ? 0.1 : 1;
  const blur = Math.floor(Math.random() * 15) + 5;
  const x = Math.floor(Math.random() * 3) - 1;
  const y = Math.floor(Math.random() * 3) - 1;

  h1.style.opacity = opacity;
  h1.style.transform = `translate(${x}px, ${y}px)`;
  h1.style.textShadow = `0 0 ${blur}px #0ff, 0 0 ${blur * 2}px #fff`;
}

setInterval(randomFlicker, 120); // Every 120ms

// start idle watchers
setIdleWatchers();

// ---- Photo album vertical marquee (conveyor) ----
(function setupMarquee(){
  const viewport = document.querySelector('.marquee-viewport');
  if (!viewport) return; // only on photo-album
  const track = viewport.querySelector('.marquee-track');
  const gallery = track?.querySelector('.photo-gallery');
  if (!track || !gallery) return;

  // Clone gallery for seamless loop
  const clone = gallery.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);

  // Calculate duration based on one gallery height for consistent speed
  function setDuration() {
    const oneHeight = gallery.scrollHeight; // distance to travel
    const PX_PER_SEC = 40; // adjust to change speed
    const dur = Math.max(20, Math.round(oneHeight / PX_PER_SEC));
    track.style.setProperty('--marquee-duration', dur + 's');
  }

  // Recompute after images load and on resize
  window.addEventListener('load', setDuration);
  window.addEventListener('resize', setDuration);
  setDuration();
})();

// Speed slider for marquee
(function marqueeSpeedControl(){
  const speedInput = document.getElementById('marqueeSpeed');
  const speedVal = document.getElementById('speedVal');
  const viewport = document.querySelector('.marquee-viewport');
  const track = document.querySelector('.marquee-track');
  const gallery = track?.querySelector('.photo-gallery');
  if (!speedInput || !track || !gallery) return;

  // read saved
  const saved = localStorage.getItem('marqueePxPerSec');
  if (saved) {
    speedInput.value = saved;
    speedVal.textContent = saved;
  }

  function applySpeed(pxPerSec){
    speedVal.textContent = pxPerSec;
    localStorage.setItem('marqueePxPerSec', pxPerSec);
    // recompute duration using the same formula as setupMarquee
    const oneHeight = gallery.scrollHeight;
    const dur = Math.max(10, Math.round(oneHeight / pxPerSec));
    track.style.setProperty('--marquee-duration', dur + 's');
  }

  // initial apply after setupMarquee possibly ran
  window.addEventListener('load', () => applySpeed(Number(speedInput.value)));

  speedInput.addEventListener('input', (e)=>{
    applySpeed(Number(e.target.value));
  });
})();

// ---- Poster portfolio carousel (page3) ----
(function posterCarousel(){
  const viewport = document.getElementById('posterViewport');
  const track = document.getElementById('posterTrack');
  if (!viewport || !track) return; // only on page3

  // Load poster list (cache-busted)
  fetch('posters.json?ts=' + Date.now())
    .then(r => r.json())
    .then(list => {
      if (!Array.isArray(list) || list.length === 0) return;
      // Create slides
      list.forEach(name => {
        const div = document.createElement('div');
        div.className = 'carousel-slide';
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = name.replace(/[-_]/g,' ').replace(/\.[a-zA-Z0-9]+$/, '');
        img.src = `posterPortfolio/${name}`;
        div.appendChild(img);
        track.appendChild(div);
      });

      // Duplicate for seamless loop
      track.querySelectorAll('.carousel-slide').forEach(slide => {
        track.appendChild(slide.cloneNode(true));
      });

      // Compute loop distance and duration from slide width
      function setDuration(){
        const slides = track.querySelectorAll('.carousel-slide');
        if (slides.length === 0) return;
        const half = Math.floor(slides.length/2);
        let width = 0;
        for (let i=0; i<half; i++) width += slides[i].getBoundingClientRect().width + 16; // include gap
        const pxPerSec = 60;
        const dur = Math.max(15, Math.round(width / pxPerSec));
        track.style.setProperty('--poster-loop', `-${width}px`);
        track.style.setProperty('--poster-duration', `${dur}s`);
      }

      window.addEventListener('resize', setDuration);
      window.addEventListener('load', setDuration);
      setDuration();
    })
    .catch(()=>{});
})();





