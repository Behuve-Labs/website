// Behuve comments widget. Mount: <section id="behuve-comments" data-slug="post-1"></section>
//   - logged out → shows "sign in with GitHub / Google" buttons
//   - logged in  → shows "signed in as X · log out" + a textarea form
//   - always     → renders the comment list below

(function () {
  const root = document.getElementById('behuve-comments');
  if (!root) return;
  const slug = root.dataset.slug;
  if (!slug) return;

  root.innerHTML = `
    <section class="comments-section">
      <h2 class="comments-heading">Comments</h2>
      <div class="comments-auth" data-auth></div>
      <div class="comments-list" data-list>
        <p class="comments-status">Loading…</p>
      </div>
    </section>
  `;

  const authEl = root.querySelector('[data-auth]');
  const listEl = root.querySelector('[data-list]');

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
    );

  const fmtDate = (ms) =>
    new Date(ms).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  function renderSignedOut() {
    const ret = encodeURIComponent(location.pathname + location.search);
    authEl.innerHTML = `
      <div class="comments-signin">
        <p class="comments-signin-prompt">Sign in to leave a comment.</p>
        <div class="comments-providers">
          <a class="comments-provider" href="/api/auth/github?return=${ret}">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path fill="currentColor" d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2.2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/>
            </svg>
            GitHub
          </a>
          <a class="comments-provider" href="/api/auth/google?return=${ret}">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.1 3.3v2.7h3.4c2-1.9 3.2-4.6 3.2-8z" fill="#4285F4"/>
              <path d="M12 23c2.8 0 5.2-.9 7-2.5l-3.4-2.7c-.9.6-2.1 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.5v2.8C4.3 20.7 7.9 23 12 23z" fill="#34A853"/>
              <path d="M6 14.4c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2V7.5H2.5C1.7 9 1.3 10.5 1.3 12s.4 3 1.2 4.5L6 14.4z" fill="#FBBC05"/>
              <path d="M12 5.5c1.6 0 3 .5 4.1 1.6l3-3C17.2 2.5 14.8 1.5 12 1.5c-4.1 0-7.7 2.3-9.5 5.8L6 10c.9-2.5 3.2-4.4 6-4.4z" fill="#EA4335"/>
            </svg>
            Google
          </a>
        </div>
      </div>
    `;
  }

  function renderSignedIn(user) {
    authEl.innerHTML = `
      <div class="comments-composer">
        <div class="comments-signedin">
          <span>Signed in as <strong>${esc(user.name)}</strong></span>
          <button type="button" class="comments-logout">Log out</button>
        </div>
        <form class="comments-form">
          <textarea name="body" maxlength="2000" placeholder="Add a comment…" required></textarea>
          <div class="comments-form-row">
            <span class="comments-form-hint" data-counter>0 / 2000</span>
            <button type="submit" class="comments-submit">Post</button>
          </div>
          <p class="comments-error" data-error hidden></p>
        </form>
      </div>
    `;

    const form = authEl.querySelector('.comments-form');
    const textarea = form.querySelector('textarea');
    const counter = form.querySelector('[data-counter]');
    const errorEl = form.querySelector('[data-error]');
    const submit = form.querySelector('.comments-submit');

    textarea.addEventListener('input', () => {
      counter.textContent = `${textarea.value.length} / 2000`;
    });

    authEl.querySelector('.comments-logout').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      location.reload();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = textarea.value.trim();
      if (!body) return;
      submit.disabled = true;
      errorEl.hidden = true;
      try {
        const res = await fetch(`/api/comments/${encodeURIComponent(slug)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        });
        if (res.status === 401) {
          renderSignedOut();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { comment } = await res.json();
        textarea.value = '';
        counter.textContent = '0 / 2000';
        appendComment(comment);
      } catch (err) {
        errorEl.textContent = 'Could not post comment. Try again.';
        errorEl.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
  }

  function renderComments(comments) {
    if (!comments || comments.length === 0) {
      listEl.innerHTML = `<p class="comments-status">No comments yet.</p>`;
      return;
    }
    listEl.innerHTML = comments.map(commentHtml).join('');
  }

  function commentHtml(c) {
    return `
      <article class="comment">
        <header class="comment-head">
          <span class="comment-author">${esc(c.author)}</span>
          <span class="comment-date">${fmtDate(c.created_at)}</span>
        </header>
        <div class="comment-body">${esc(c.body)}</div>
      </article>
    `;
  }

  function appendComment(c) {
    const status = listEl.querySelector('.comments-status');
    if (status) listEl.innerHTML = '';
    listEl.insertAdjacentHTML('beforeend', commentHtml(c));
  }

  async function load() {
    try {
      const [meRes, listRes] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'same-origin' }),
        fetch(`/api/comments/${encodeURIComponent(slug)}`),
      ]);
      const { user } = await meRes.json();
      const { comments } = await listRes.json();
      if (user) renderSignedIn(user);
      else renderSignedOut();
      renderComments(comments);
    } catch {
      // Backend unreachable — keep the section visible but inert.
      renderSignedOut();
      listEl.innerHTML = `<p class="comments-status">Comments unavailable.</p>`;
    }
  }

  load();
})();
