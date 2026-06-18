(function () {
  const body = document.querySelector('.post-body');
  if (!body) return;

  const headings = Array.from(body.querySelectorAll('h2'));
  if (headings.length === 0) return;

  headings.forEach(h => {
    if (!h.id) {
      h.id = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  });

  const nav = document.createElement('nav');
  nav.className = 'toc';
  nav.setAttribute('aria-label', 'Table of contents');

  const links = headings.map(h => {
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    a.addEventListener('click', e => {
      e.preventDefault();
      window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });
    nav.appendChild(a);
    return a;
  });

  document.body.appendChild(nav);

  function updateActive() {
    const threshold = window.scrollY + 80;
    let current = -1;
    headings.forEach((h, i) => { if (h.offsetTop <= threshold) current = i; });
    links.forEach((l, i) => l.classList.toggle('toc-active', i === current));
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
})();
