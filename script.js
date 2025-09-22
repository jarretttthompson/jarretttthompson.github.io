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

// ---- Weather Widget ----
(function weatherWidget(){
  const widget = document.getElementById('weatherWidget');
  if (!widget) return; // only on index
  
  async function fetchWeather() {
    const loading = widget.querySelector('.weather-loading');
    const content = widget.querySelector('.weather-content');
    
    try {
      // Using free wttr.in service - no API key needed
      const response = await fetch('https://wttr.in/Statesboro,GA?format=j1');
      const data = await response.json();
      
      if (data.current_condition && data.current_condition.length > 0) {
        const current = data.current_condition[0];
        const tempF = current.temp_F;
        const feelsLikeF = current.FeelsLikeF;
        const desc = current.weatherDesc[0].value;
        
        widget.querySelector('.weather-location').textContent = 'Statesboro, GA';
        widget.querySelector('.weather-temp').textContent = tempF + '°F';
        widget.querySelector('.weather-desc').textContent = desc.toLowerCase();
        widget.querySelector('.weather-feels-like').textContent = `Feels like ${feelsLikeF}°F`;
        
        loading.style.display = 'none';
        content.style.display = 'block';
      } else {
        loading.textContent = 'Weather unavailable';
      }
    } catch (error) {
      loading.textContent = 'Weather offline';
    }
  }
  
  fetchWeather();
  // Refresh every 15 minutes
  setInterval(fetchWeather, 900000);
})();

// ---- Poster carousels (page3) ----
(function posterCarousels(){
  const manualTrack = document.getElementById('posterCarouselManual');
  if (!manualTrack) return;

  const dotsContainer = document.getElementById('posterCarouselDots');
  const manualViewport = manualTrack.closest('[data-carousel="manual"]');
  const prevBtn = document.querySelector('.poster-carousel__control--prev');
  const nextBtn = document.querySelector('.poster-carousel__control--next');

  fetch('posters.json?ts=' + Date.now())
    .then(r=>r.json())
    .then(list => {
      if(!Array.isArray(list) || list.length===0) return;

      list.forEach(name => {
        manualTrack.appendChild(createPosterCard(name));
      });
      initManualCarousel({
        viewport: manualViewport,
        track: manualTrack,
        dotsContainer,
        prevBtn,
        nextBtn
      });
    })
    .catch(()=>{});

  function createPosterCard(filename){
    const card = document.createElement('div');
    card.className = 'poster-card';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = filename.replace(/[-_]/g,' ').replace(/\.[a-zA-Z0-9]+$/, '');
    img.src = `posterPortfolio/${filename}`;
    card.appendChild(img);
    return card;
  }

  function initManualCarousel({ viewport, track, dotsContainer, prevBtn, nextBtn }){
    if (!viewport || !track) return;

    const carouselRoot = viewport.closest('.poster-carousel--manual');
    let gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0');

    const getVisibleCount = () => {
      const value = parseFloat(getComputedStyle(carouselRoot).getPropertyValue('--poster-cards-visible'));
      return Number.isFinite(value) && value > 0 ? value : 1;
    };

    let visibleCount = getVisibleCount();
    let pageCount = Math.max(1, Math.ceil(track.children.length / visibleCount));
    let currentPage = 0;

    function buildDots(){
      if (!dotsContainer) return;
      dotsContainer.innerHTML = '';
      for (let i = 0; i < pageCount; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'poster-carousel__dot';
        dot.setAttribute('aria-label', `Go to poster group ${i + 1}`);
        if (i === currentPage) dot.setAttribute('aria-current', 'true');
        dot.addEventListener('click', () => goToPage(i));
        dotsContainer.appendChild(dot);
      }
    }

    function updateDots(){
      if (!dotsContainer) return;
      [...dotsContainer.children].forEach((dot, index) => {
        if (index === currentPage) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }

    function goToPage(index){
      if (!viewport) return;
      currentPage = (index + pageCount) % pageCount;
      const target = currentPage * viewport.clientWidth;
      viewport.scrollTo({ left: target, behavior: 'smooth' });
      updateDots();
    }

    prevBtn?.addEventListener('click', () => goToPage(currentPage - 1));
    nextBtn?.addEventListener('click', () => goToPage(currentPage + 1));

    let scrollTimeout;
    viewport.addEventListener('scroll', () => {
      if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
      scrollTimeout = requestAnimationFrame(() => {
        const ratio = viewport.scrollLeft / viewport.clientWidth;
        currentPage = Math.round(ratio);
        updateDots();
      });
    });

    window.addEventListener('resize', () => {
      gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0');
      visibleCount = getVisibleCount();
      pageCount = Math.max(1, Math.ceil(track.children.length / visibleCount));
      currentPage = Math.min(currentPage, pageCount - 1);
      buildDots();
      goToPage(currentPage);
    });

    buildDots();
    goToPage(0);
  }
})();
