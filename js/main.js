// GlobeTrotter download site — small, dependency-free interactions.

// Recommend the mobile app on Android/iOS, the web app everywhere else —
// a UX nicety, not a hard gate: both options stay fully usable regardless.
(function highlightRecommended() {
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const mobileCard = document.getElementById('mobileCard');
  const webCard = document.getElementById('webCard');
  if (isMobile) {
    mobileCard.classList.add('is-recommended');
  } else {
    webCard.classList.add('is-recommended');
  }
})();

// Copy the web app link to the clipboard — resolved against this
// page's own location, so it works whatever domain this site ends up on.
(function copyLink() {
  const btn = document.getElementById('copyLinkBtn');
  const toast = document.getElementById('toast');
  const url = new URL('./app/index.html', window.location.href).href;

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      // Clipboard API unavailable (older browser, insecure context) — fall back.
      const temp = document.createElement('textarea');
      temp.value = url;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  });
})();

// Scroll-reveal for the feature grid.
(function revealOnScroll() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((el) => io.observe(el));
})();
