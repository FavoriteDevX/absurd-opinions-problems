/* Absurd Opinions Problems — app */
(function () {
  'use strict';

  const CFG = window.AOP_CONFIG || {};
  const CATS = window.AOP_CATEGORIES;
  const TIERS = {
    measured: { label: 'Measured', tip: 'Real-world usage data or a scientific measurement.' },
    survey: { label: 'Poll', tip: 'A published poll. Mostly US or UK adults; wording and year vary.' },
    guess: { label: 'Educated guess', tip: 'No reliable data found. This number is an estimate — vote to argue with it.' }
  };
  const TIER_ORDER = { measured: 0, survey: 1, guess: 2 };

  /* ───── Live world population (estimate) ─────
     ~8.30 billion in mid-2026 (UN World Population Prospects 2024, medium
     projection), growing by roughly 70 million a year ≈ 2.2 people/second. */
  const POP_BASE = 8.30e9;
  const POP_T0 = Date.UTC(2026, 6, 1);
  const POP_PER_SEC = 2.2;
  const worldPop = () => POP_BASE + ((Date.now() - POP_T0) / 1000) * POP_PER_SEC;

  const nf = new Intl.NumberFormat('en-US');
  const fmtPct = (p) => (Math.round(p * 10) / 10).toFixed(Number.isInteger(Math.round(p * 10) / 10) ? 0 : 1);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ───── Storage (never trusted to exist) ───── */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ }
    }
  };

  /* ───── Topics ───── */
  const topics = window.AOP_TOPICS.map((t) => {
    let pct = t.raw ? (t.raw[0] / (t.raw[0] + t.raw[1])) * 100 : t.pct;
    pct = Math.min(99.9, Math.max(0.1, Math.round(pct * 10) / 10));
    const la = t.la || (t.q ? t.a : cap(t.a));
    const lb = t.lb || (t.q ? t.b : cap(t.b));
    let title;
    let plain;
    if (t.q) {
      let n = 0;
      title = esc(t.q).replace(/\*(.+?)\*/g, (_, x) => `<mark class="${n++ % 2 === 0 ? 'ma' : 'mb'}">${x}</mark>`);
      plain = t.q.replace(/\*/g, '');
    } else {
      title = `How many people prefer <mark class="ma">${esc(t.a)}</mark> over <mark class="mb">${esc(t.b)}</mark>?`;
      plain = `How many people prefer ${t.a} over ${t.b}?`;
    }
    const cat = CATS[t.cat] || { label: t.cat, emoji: '•' };
    return Object.assign({}, t, {
      pct, la, lb, title, plain, catInfo: cat,
      haystack: [plain, la, lb, cat.label, t.src || ''].join(' ').toLowerCase()
    });
  });
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));

  // Stable shuffle per page load
  const shuffleRank = {};
  topics.map((t) => t.id).sort(() => Math.random() - 0.5).forEach((id, i) => { shuffleRank[id] = i; });

  /* ───── State ───── */
  const state = { q: '', cat: 'all', tiers: new Set(['measured', 'survey', 'guess']), sort: 'shuffle' };
  let votes = store.get('aop.votes', {});
  const sent = new Set(store.get('aop.sent', []));

  /* ───── Remote community votes (optional) ───── */
  const REMOTE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  const remoteBase = REMOTE ? String(CFG.supabaseUrl).replace(/\/+$/, '') : '';
  const remoteHeaders = REMOTE ? {
    apikey: CFG.supabaseAnonKey,
    Authorization: 'Bearer ' + CFG.supabaseAnonKey,
    'Content-Type': 'application/json'
  } : {};
  const community = {};

  async function pullCommunity() {
    if (!REMOTE || document.visibilityState === 'hidden') return;
    try {
      const res = await fetch(remoteBase + '/rest/v1/vote_counts?select=topic_id,a,b', { headers: remoteHeaders });
      if (!res.ok) return;
      const rows = await res.json();
      rows.forEach((r) => { community[r.topic_id] = { a: Number(r.a) || 0, b: Number(r.b) || 0 }; });
      cards.forEach((el, id) => paintCommunity(el, byId[id]));
    } catch (e) { /* offline: keep last known counts */ }
  }

  function pushVote(id, side) {
    if (!REMOTE || sent.has(id)) return;
    sent.add(id);
    store.set('aop.sent', [...sent]);
    const c = community[id] || (community[id] = { a: 0, b: 0 });
    c[side] += 1;
    fetch(remoteBase + '/rest/v1/rpc/cast_vote', {
      method: 'POST',
      headers: remoteHeaders,
      body: JSON.stringify({ p_topic: id, p_side: side })
    }).catch(() => {});
  }

  /* ───── Cards ───── */
  const grid = $('#grid');
  const cards = new Map();

  function cardHTML(t) {
    const tier = TIERS[t.tier] || TIERS.guess;
    const pa = fmtPct(t.pct);
    const pb = fmtPct(100 - t.pct);
    let src;
    if (t.src) {
      src = t.url
        ? `Source: <a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.src)}</a>`
        : `Source: ${esc(t.src)}`;
    } else {
      src = 'No reliable data found — this is our best guess.';
    }
    if (t.raw) src += ' · among people who picked a side';
    const note = t.note ? `<span class="note">${esc(t.note)}</span>` : '';

    return `
      <div class="card-top">
        <button class="cat-tag" type="button" data-cat="${esc(t.cat)}">${t.catInfo.emoji} ${esc(t.catInfo.label)}</button>
        <span class="tier tier-${esc(t.tier)}" title="${esc(tier.tip)}">${esc(tier.label)}</span>
      </div>
      <h3>${t.title}</h3>
      <div class="big"><span class="big-num">0</span><span class="big-of">say “${esc(t.la)}”</span></div>
      <div class="bar" role="img" aria-label="${esc(pa)}% ${esc(t.la)}, ${esc(pb)}% ${esc(t.lb)}"><i class="fa"></i><i class="fb"></i></div>
      <div class="bar-labels">
        <span><i class="dot dot-a"></i> <em>${esc(t.la)}</em> <b>${pa}%</b></span>
        <span><i class="dot dot-b"></i> <b>${pb}%</b> <em>${esc(t.lb)}</em></span>
      </div>
      <p class="people" title="Share × estimated live world population. An extrapolation, not a headcount.">
        <span><i class="live-dot"></i>≈ <span class="live">—</span> people</span><span>if all of Earth answered like this</span>
      </p>
      <div class="vote" role="group" aria-label="Pick a side">
        <button class="va" type="button" data-side="a" aria-pressed="false">${esc(t.la)}</button>
        <button class="vb" type="button" data-side="b" aria-pressed="false">${esc(t.lb)}</button>
      </div>
      <p class="verdict" hidden></p>
      <div class="community" hidden><div class="mini"><i></i></div><span class="community-text"></span></div>
      <div class="card-foot">
        <span class="src">${src}${note}</span>
        <button class="share" type="button" title="Copy link to this opinion" aria-label="Copy link">🔗</button>
      </div>`;
  }

  function buildCards() {
    const frag = document.createDocumentFragment();
    topics.forEach((t) => {
      const el = document.createElement('article');
      el.className = 'card';
      el.id = 't-' + t.id;
      el.dataset.id = t.id;
      el.style.setProperty('--p', t.pct);
      el.innerHTML = cardHTML(t);
      cards.set(t.id, el);
      paintVote(el, t);
      paintCommunity(el, t);
      frag.appendChild(el);
    });
    grid.appendChild(frag);
  }

  function verdictText(t, side) {
    const share = side === 'a' ? t.pct : 100 - t.pct;
    const s = fmtPct(share) + '%';
    let msg;
    if (Math.abs(share - 50) < 0.05) msg = 'Perfect split. Humanity is exactly 50/50 on this one.';
    else if (share >= 85) msg = `Extremely normal. ${s} of people agree with you.`;
    else if (share >= 60) msg = `You’re with the majority: ${s} agree.`;
    else if (share >= 50) msg = `Barely the majority: ${s} agree. Stay alert.`;
    else if (share >= 35) msg = `Slight minority. ${s} are on your side.`;
    else if (share >= 15) msg = `Hot take! Only ${s} agree with you.`;
    else msg = `Absurd opinion detected. Only ${s} of people agree with you.`;
    if (t.tier === 'guess') msg += ' (Based on a guess, so maybe you’re right.)';
    return msg;
  }

  function paintVote(el, t) {
    const side = votes[t.id];
    el.classList.toggle('voted', !!side);
    el.querySelectorAll('.vote button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === side)));
    const v = $('.verdict', el);
    if (side) {
      v.textContent = verdictText(t, side);
      v.hidden = false;
    } else {
      v.hidden = true;
    }
  }

  function paintCommunity(el, t) {
    const box = $('.community', el);
    if (!REMOTE) { box.hidden = true; return; }
    const c = community[t.id] || { a: 0, b: 0 };
    const total = c.a + c.b;
    box.hidden = false;
    if (!total) {
      $('.mini i', el).style.width = '50%';
      $('.community-text', el).textContent = 'Visitors here: no votes yet. Be the first.';
      return;
    }
    const pa = (c.a / total) * 100;
    $('.mini i', el).style.width = pa + '%';
    $('.community-text', el).textContent =
      `Visitors here: ${fmtPct(pa)}% ${t.la} · ${nf.format(total)} vote${total === 1 ? '' : 's'}`;
  }

  /* ───── Count-up + live counters ───── */
  const visible = new Set();
  const counted = new Set();
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function countUp(el, t) {
    if (counted.has(t.id)) return;
    counted.add(t.id);
    const num = $('.big-num', el);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { num.textContent = fmtPct(t.pct); return; }
    const start = performance.now();
    const dur = 1100;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      num.textContent = k < 1 ? String(Math.round(t.pct * easeOut(k))) : fmtPct(t.pct);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const id = e.target.dataset.id;
      if (e.isIntersecting) {
        e.target.classList.add('in');
        visible.add(id);
        countUp(e.target, byId[id]);
        tickCard(id, worldPop());
      } else {
        visible.delete(id);
      }
    });
  }, { rootMargin: '80px 0px' }) : null;

  function tickCard(id, pop) {
    const el = cards.get(id);
    if (!el) return;
    $('.live', el).textContent = nf.format(Math.round((pop * byId[id].pct) / 100));
  }

  const popEl = $('#pop-now');
  function tick() {
    if (document.visibilityState === 'hidden') return;
    const pop = worldPop();
    popEl.textContent = nf.format(Math.round(pop));
    visible.forEach((id) => tickCard(id, pop));
  }

  /* ───── Normie score ───── */
  function paintNormie() {
    const ids = Object.keys(votes).filter((id) => byId[id]);
    const numEl = $('#normie');
    const labelEl = $('#normie-label');
    if (!ids.length) {
      numEl.textContent = '—';
      labelEl.textContent = 'your normie score (vote!)';
      return;
    }
    const majority = ids.filter((id) => {
      const t = byId[id];
      return (votes[id] === 'a' ? t.pct : 100 - t.pct) >= 50;
    }).length;
    const score = Math.round((majority / ids.length) * 100);
    let label;
    if (score >= 85) label = 'Certified normie';
    else if (score >= 65) label = 'Mostly normal';
    else if (score >= 45) label = 'Delightfully balanced';
    else if (score >= 25) label = 'Contrarian';
    else label = 'Absolute chaos agent';
    numEl.textContent = score + '%';
    labelEl.textContent = `${label} · ${ids.length} vote${ids.length === 1 ? '' : 's'}`;
  }

  /* ───── Filters, search, sort ───── */
  const catsEl = $('#cats');
  const tiersEl = $('#tiers');

  function buildChips() {
    const counts = {};
    topics.forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    const chip = (key, label, count) =>
      `<button class="chip" type="button" data-cat="${esc(key)}" aria-pressed="${state.cat === key}">${label}<span class="count">${count}</span></button>`;
    catsEl.innerHTML = chip('all', '✨ All', topics.length) +
      Object.keys(CATS).filter((k) => counts[k])
        .map((k) => chip(k, `${CATS[k].emoji} ${esc(CATS[k].label)}`, counts[k])).join('');

    const tierCounts = {};
    topics.forEach((t) => { tierCounts[t.tier] = (tierCounts[t.tier] || 0) + 1; });
    tiersEl.innerHTML = '<span class="tiers-label">Data:</span>' + Object.keys(TIERS).map((k) =>
      `<button class="chip" type="button" data-tier="${k}" aria-pressed="${state.tiers.has(k)}" title="${esc(TIERS[k].tip)}">${TIERS[k].label}<span class="count">${tierCounts[k] || 0}</span></button>`
    ).join('');
  }

  function sorter(a, b) {
    switch (state.sort) {
      case 'divisive': return Math.abs(a.pct - 50) - Math.abs(b.pct - 50);
      case 'lopsided': return Math.abs(b.pct - 50) - Math.abs(a.pct - 50);
      case 'real': return (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) || (shuffleRank[a.id] - shuffleRank[b.id]);
      case 'az': return a.plain.localeCompare(b.plain);
      default: return shuffleRank[a.id] - shuffleRank[b.id];
    }
  }

  function currentList() {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return topics
      .filter((t) => (state.cat === 'all' || t.cat === state.cat) &&
        state.tiers.has(t.tier) &&
        words.every((w) => t.haystack.includes(w)))
      .sort(sorter);
  }

  function apply() {
    const list = currentList();
    const show = new Set(list.map((t) => t.id));
    cards.forEach((el, id) => { el.hidden = !show.has(id); });
    list.forEach((t) => grid.appendChild(cards.get(t.id)));
    $('#empty').hidden = list.length > 0;
    $('#result-count').textContent = list.length === topics.length
      ? `Showing all ${topics.length} opinions`
      : `Showing ${list.length} of ${topics.length} opinions`;
    catsEl.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === state.cat)));
    tiersEl.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(state.tiers.has(c.dataset.tier))));
    return list;
  }

  /* ───── UI helpers ───── */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function focusCard(id) {
    const el = cards.get(id);
    if (!el) return;
    if (el.hidden) {
      state.q = ''; state.cat = 'all'; state.tiers = new Set(Object.keys(TIERS));
      $('#search').value = '';
      apply();
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  async function copyLink(id) {
    const url = location.origin + location.pathname + '#t-' + id;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch (e) {
      history.replaceState(null, '', '#t-' + id);
      toast('Link is in the address bar');
    }
  }

  /* ───── Events ───── */
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const t = byId[card.dataset.id];

    const voteBtn = e.target.closest('.vote button');
    if (voteBtn) {
      const side = voteBtn.dataset.side;
      votes[t.id] = side;
      store.set('aop.votes', votes);
      paintVote(card, t);
      pushVote(t.id, side);
      paintCommunity(card, t);
      paintNormie();
      return;
    }
    if (e.target.closest('.share')) { copyLink(t.id); return; }
    const catBtn = e.target.closest('.cat-tag');
    if (catBtn) {
      state.cat = catBtn.dataset.cat;
      apply();
      $('#toolbar').scrollIntoView({ behavior: 'smooth' });
    }
  });

  catsEl.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    state.cat = c.dataset.cat;
    apply();
  });

  tiersEl.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const k = c.dataset.tier;
    if (state.tiers.has(k)) state.tiers.delete(k); else state.tiers.add(k);
    apply();
  });

  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = e.target.value.trim(); apply(); }, 90);
  });

  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; apply(); });

  $('#random').addEventListener('click', () => {
    let list = currentList();
    if (!list.length) list = topics;
    const unvoted = list.filter((t) => !votes[t.id]);
    const pool = unvoted.length ? unvoted : list;
    focusCard(pool[Math.floor(Math.random() * pool.length)].id);
  });

  $('#reset-votes').addEventListener('click', () => {
    votes = {};
    store.set('aop.votes', votes);
    cards.forEach((el, id) => paintVote(el, byId[id]));
    paintNormie();
    toast('Your votes are forgotten');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== $('#search')) {
      e.preventDefault();
      $('#search').focus();
    } else if (e.key === 'Escape' && document.activeElement === $('#search')) {
      $('#search').value = '';
      state.q = '';
      apply();
      $('#search').blur();
    }
  });

  // Toolbar border once it sticks
  const toolbar = $('#toolbar');
  const sentinel = document.createElement('div');
  toolbar.before(sentinel);
  if (io) {
    new IntersectionObserver(([e]) => toolbar.classList.toggle('stuck', !e.isIntersecting)).observe(sentinel);
  }

  /* ───── Boot ───── */
  buildChips();
  buildCards();
  $('#topic-count').textContent = nf.format(topics.length);
  $('#search').placeholder = `Search ${topics.length} opinions…  ( / )`;
  apply();
  paintNormie();

  if (io) {
    cards.forEach((el) => io.observe(el));
  } else {
    cards.forEach((el, id) => { el.classList.add('in'); visible.add(id); countUp(el, byId[id]); });
  }

  tick();
  setInterval(tick, 250);

  if (REMOTE) {
    pullCommunity();
    setInterval(pullCommunity, Math.max(5, Number(CFG.pollSeconds) || 15) * 1000);
    document.addEventListener('visibilitychange', pullCommunity);
  }

  function focusFromHash() {
    const id = decodeURIComponent(location.hash.replace(/^#t-/, ''));
    if (id && byId[id]) setTimeout(() => focusCard(id), 300);
  }
  window.addEventListener('hashchange', focusFromHash);
  focusFromHash();
})();
