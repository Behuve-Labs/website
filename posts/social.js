// Behuve social widget — views + likes.
// Mount: <section id="behuve-social" data-slug="post-1"></section>
// Records a view on mount, lets the visitor toggle a like.

(function () {
  const root = document.getElementById('behuve-social');
  if (!root) return;
  const slug = root.dataset.slug;
  if (!slug) return;

  // No wrapping container — `#behuve-social` uses `display: contents`
  // so these elements flow into the parent flex layout (post-meta row).
  root.innerHTML = `
    <span class="social-stat">
      <span class="social-stat-num" data-views>—</span>
      <span class="social-stat-label">views</span>
    </span>
    <button class="social-like" type="button" aria-pressed="false" aria-label="Like this post" disabled>
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        <path d="M12 20.5s-7-4.2-9.2-9C1.3 8.2 3.2 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.8 0 5.7 3.7 4.2 7-2.2 4.8-9.2 9-9.2 9z"></path>
      </svg>
      <span class="social-stat-num" data-likes>—</span>
    </button>
  `;

  const viewsEl = root.querySelector('[data-views]');
  const likesEl = root.querySelector('[data-likes]');
  const likeBtn = root.querySelector('.social-like');

  function render(state) {
    viewsEl.textContent = state.views.toLocaleString();
    likesEl.textContent = state.likes.toLocaleString();
    likeBtn.classList.toggle('liked', !!state.liked);
    likeBtn.setAttribute('aria-pressed', state.liked ? 'true' : 'false');
  }

  async function send(url) {
    const res = await fetch(url, { method: 'POST', credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Mount: increment view, render state, enable the button.
  send(`/api/stats/${encodeURIComponent(slug)}`)
    .then((state) => {
      render(state);
      likeBtn.disabled = false;
    })
    .catch(() => {
      // Endpoint unreachable (e.g., serving via plain http.server). Show zeros
      // and keep the button disabled — better than a broken click.
      render({ views: 0, likes: 0, liked: false });
    });

  likeBtn.addEventListener('click', async () => {
    if (likeBtn.disabled) return;
    likeBtn.disabled = true;
    try {
      const state = await send(`/api/likes/${encodeURIComponent(slug)}`);
      render(state);
    } catch {
      /* swallow — UI stays in last known state */
    } finally {
      likeBtn.disabled = false;
    }
  });
})();
