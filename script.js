// ---- Layout helpers ----
(function ensureCrtShell(){
  const body = document.body;
  if (!body) return;
  const first = body.firstElementChild;
  if (first && first.classList.contains('crt-shell')) return;

  const shell = document.createElement('div');
  shell.className = 'crt-shell';

  while (body.firstChild) {
    shell.appendChild(body.firstChild);
  }

  body.appendChild(shell);
})();

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

  // Use requestAnimationFrame for smoother transitions
  requestAnimationFrame(() => {
    setTimeout(() => {
      visibleSlide.classList.remove('visible');
      hiddenSlide.classList.add('visible');
    }, 100);
  });
}

// ---- flickering effect ----
function randomFlicker() {
  const h1 = document.getElementById('lightbulb');
  if (!h1) return;
  const opacity = Math.random() > 0.9 ? 0.1 : 1;
  const blur = Math.floor(Math.random() * 15) + 5;
  const x = Math.floor(Math.random() * 3) - 1;
  const y = Math.floor(Math.random() * 3) - 1;

  // Use requestAnimationFrame for smoother animations
  requestAnimationFrame(() => {
    h1.style.opacity = opacity;
    h1.style.transform = `translate(${x}px, ${y}px)`;
    h1.style.textShadow = `0 0 ${blur}px #0ff, 0 0 ${blur * 2}px #fff`;
  });
}

// Use requestAnimationFrame for smoother flicker timing
let flickerTimeout;
function scheduleFlicker() {
  flickerTimeout = setTimeout(() => {
    randomFlicker();
    scheduleFlicker();
  }, 120);
}
scheduleFlicker();

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

// ---- Projects gallery (page4) ----
(function projectsGallery(){
  if (document.body.getAttribute('data-page') !== 'page4') return;

  const host = document.getElementById('projectsGallery');
  if (!host) return;

  const dataUrl = 'projects/projects.json?ts=' + Date.now();

  fetch(dataUrl)
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    })
    .then(projects => {
      if (!Array.isArray(projects) || projects.length === 0) {
        host.innerHTML = '<p class="projects-gallery__empty">No projects to show yet.</p>';
        return;
      }
      host.innerHTML = '';
      projects.forEach(project => {
        const section = createProjectSection(project);
        if (section) host.appendChild(section);
      });
    })
    .catch(() => {
      host.innerHTML = '<p class="projects-gallery__error">Unable to load projects right now.</p>';
    });

  function createProjectSection(project){
    if (!project || !Array.isArray(project.items) || project.items.length === 0) return null;

    const section = document.createElement('section');
    section.className = 'project-section';

    const carousel = document.createElement('div');
    carousel.className = 'poster-carousel poster-carousel--manual projects-carousel';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'poster-carousel__control poster-carousel__control--prev';
    prevBtn.setAttribute('aria-label', 'Show previous media');
    prevBtn.innerHTML = '<span aria-hidden="true">‹</span>';

    const viewport = document.createElement('div');
    viewport.className = 'poster-carousel__viewport';

    const track = document.createElement('div');
    track.className = 'poster-carousel__track';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'poster-carousel__control poster-carousel__control--next';
    nextBtn.setAttribute('aria-label', 'Show next media');
    nextBtn.innerHTML = '<span aria-hidden="true">›</span>';

    const cardVideoMap = new Map();

    project.items.forEach(item => {
      if (!item || !item.src) return;
      const card = document.createElement('div');
      card.className = 'poster-card project-card';

      if (item.type === 'video') {
        const video = document.createElement('video');
        video.controls = true;
        video.loop = true;
        video.muted = true;
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.preload = 'metadata';
        video.src = item.src;
        video.setAttribute('playsinline', '');
        if (item.alt) video.setAttribute('aria-label', item.alt);
        card.appendChild(video);
        cardVideoMap.set(card, video);
      } else {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = item.src;
        img.alt = item.alt || '';
        card.appendChild(img);
      }

      track.appendChild(card);
    });

    if (!track.children.length) return null;

    viewport.appendChild(track);

    carousel.appendChild(prevBtn);
    carousel.appendChild(viewport);
    carousel.appendChild(nextBtn);
    section.appendChild(carousel);

    setupControls(viewport, prevBtn, nextBtn, cardVideoMap);

    return section;
  }

  function setupControls(viewport, prevBtn, nextBtn, cardVideoMap){
    if (!viewport) return;
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

    prevBtn.addEventListener('click', () => {
      viewport.scrollBy({ left: -scrollByAmount(), behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      viewport.scrollBy({ left: scrollByAmount(), behavior: 'smooth' });
    });

    const videos = cardVideoMap && typeof cardVideoMap.forEach === 'function'
      ? Array.from(cardVideoMap.values())
      : [];

    const pauseVideo = (video) => {
      video.pause();
      if (video.currentTime > 0.25) video.currentTime = 0;
    };

    const playVideo = (video) => {
      video.play().catch(() => {});
    };

    let observer = null;
    if (videos.length && cardVideoMap && cardVideoMap.size) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const video = cardVideoMap.get(entry.target);
          if (!video) return;
          if (entry.isIntersecting) {
            playVideo(video);
          } else {
            pauseVideo(video);
          }
        });
      }, {
        root: viewport,
        threshold: 0.1,
        rootMargin: '0px'
      });

      videos.forEach(pauseVideo);
      cardVideoMap.forEach((video, card) => observer.observe(card));
    }

    let scrollRAF = null;
    const handleScroll = () => {
      if (scrollRAF) cancelAnimationFrame(scrollRAF);
      scrollRAF = requestAnimationFrame(() => {
        updateControls();
      });
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateControls);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateControls();
      });
      resizeObserver.observe(track);
      resizeObserver.observe(viewport);
    }

    if (!track || track.children.length <= 1) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      updateControls();
      if (videos.length) {
        playVideo(videos[0]);
      }
      return;
    }

    requestAnimationFrame(() => {
      viewport.scrollLeft = 0;
      updateControls();
    });
  }
})();
