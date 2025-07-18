// ---- Setup ----
let slideImages = [];
let currentIndex = 0;

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
  const visibleSlide = slide1.classList.contains('visible') ? slide1 : slide2;
  const hiddenSlide = visibleSlide === slide1 ? slide2 : slide1;

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
  const opacity = Math.random() > 0.9 ? 0.1 : 1;
  const blur = Math.floor(Math.random() * 15) + 5;
  const x = Math.floor(Math.random() * 3) - 1;
  const y = Math.floor(Math.random() * 3) - 1;

  h1.style.opacity = opacity;
  h1.style.transform = `translate(${x}px, ${y}px)`;
  h1.style.textShadow = `0 0 ${blur}px #0ff, 0 0 ${blur * 2}px #fff`;
}

setInterval(randomFlicker, 120); // Every 120ms





