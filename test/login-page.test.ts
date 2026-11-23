import { describe, expect, it } from 'vitest';
import login from '../public/login.html?raw';
import sessionBar from '../public/js/session-bar.js?raw';
import indexPage from '../public/index.html?raw';
import animatePage from '../public/animate.html?raw';
import matchPage from '../public/match.html?raw';
import { safeNextPath } from '../src/auth/gate.js';

/** public/login.html and the signed-in bar (#127): structure, the marketing notice, the free /match card. */

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((m) => !/\bsrc\s*=/.test(m[1])).map((m) => m[2]);
}

describe('public/login.html', () => {
  const scripts = inlineScripts(login);

  it('its inline script parses, ids are unique, and every id it reads exists once', () => {
    expect(scripts.length).toBe(1);
    expect(() => new Function(scripts[0])).not.toThrow();
    const ids = [...login.matchAll(/<[a-zA-Z][\w-]*\b[^>]*?\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(new Set(ids).size);
    const wanted = new Set([...scripts[0].matchAll(/el\('([^']+)'\)/g)].map((m) => m[1]));
    expect([...wanted].filter((id) => login.split(`id="${id}"`).length - 1 !== 1)).toEqual([]);
  });

  it('tells the user plainly that the email may be used for marketing later, with an unticked, optional box', () => {
    const notice = /<div class="notice-box" id="marketingNotice">([\s\S]*?)<\/div>/.exec(login)![1].replace(/\s+/g, ' ');
    expect(notice).toContain('We use your email address to sign you in.');
    expect(notice).toContain('marketing emails at a later date, but only if you tick the box below');
    expect(notice).toContain('You can withdraw at any time.');
    const box = /<md-checkbox id="chkMarketing"[^>]*>/.exec(login)![0];
    expect(box).not.toMatch(/\bchecked\b/);
    expect(box).not.toMatch(/\brequired\b/);
    // The choice is sent with the sign-in request; the server stamps the time and notice version.
    expect(scripts[0]).toContain("marketingOptIn: Boolean(el('chkMarketing').checked)");
  });

  it('promotes the free Horoscope Match, which needs no login', () => {
    expect(login).toContain('Horoscope Match: free, no login needed');
    expect(login).toContain('<a class="go" href="/match">');
  });

  it('signs in with Better Auth emailOTP: send a sign-in code, then sign in with it', () => {
    expect(scripts[0]).toContain("postAuth('/email-otp/send-verification-otp', { email, type: 'sign-in' })");
    expect(scripts[0]).toContain("postAuth('/sign-in/email-otp', { email, otp,");
  });

  it('the page follows the same next-path rule as the server (src/auth/gate.ts safeNextPath)', () => {
    const body = /function nextPath\(\) \{([\s\S]*?)\n    \}/.exec(scripts[0])![1];
    for (const next of ['/animate.html?x=1', '/', '//evil.example', 'https://evil.example', '/\\evil', 'evil', '']) {
      const pageNext = new Function('location', 'URLSearchParams', body)({ search: '?next=' + encodeURIComponent(next) }, URLSearchParams);
      expect(pageNext, next).toBe(safeNextPath(next));
    }
  });
});

describe('signed-in bar (public/js/session-bar.js)', () => {
  it('parses, and the chart, animate and match pages load it', () => {
    expect(() => new Function(sessionBar)).not.toThrow();
    for (const page of [indexPage, animatePage, matchPage]) {
      expect(page).toContain('<script src="/js/session-bar.js" defer></script>');
    }
  });

  it('shows "Signed in as" with a sign-out, or a sign-in link for the full app', () => {
    expect(sessionBar).toContain("who.append('Signed in as ')");
    expect(sessionBar).toContain("fetch('/api/auth/sign-out'");
    expect(sessionBar).toContain("'Sign in for the full app'");
    expect(sessionBar).toContain("fetch('/api/auth/get-session'");
  });
});
