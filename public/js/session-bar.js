// "Signed in as … · Sign out" bar for KP-Web pages (#127). Reads the Better Auth session; on a page a
// signed-out visitor may open (/match), it offers sign-in for the full app instead.
(function () {
  const bar = document.createElement('div');
  bar.id = 'sessionBar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Account');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:flex-end;align-items:center;' +
    'max-width:1200px;margin:0 auto 16px auto;font:500 0.875rem/1.25rem var(--font-plain);' +
    'color:var(--md-sys-color-on-surface-variant);';

  function link(text, href) {
    const a = document.createElement('a');
    a.textContent = text;
    a.href = href;
    a.style.color = 'var(--md-sys-color-primary)';
    return a;
  }

  function render(user) {
    bar.replaceChildren();
    if (user && user.email) {
      const who = document.createElement('span');
      who.append('Signed in as ');
      const strong = document.createElement('strong');
      strong.textContent = user.email;
      who.append(strong);
      const out = link('Sign out', '/login');
      out.id = 'btnSessionSignOut';
      out.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await fetch('/api/auth/sign-out', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' }, body: '{}',
          });
        } finally {
          location.assign('/login');
        }
      });
      bar.append(who, ' · ', out);
    } else {
      const here = location.pathname + location.search;
      bar.append('Free Horoscope Match. ', link('Sign in for the full app', '/login?next=' + encodeURIComponent(here)));
    }
  }

  document.body.prepend(bar);
  fetch('/api/auth/get-session', { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => render(json && json.user))
    .catch(() => render(null));
})();
