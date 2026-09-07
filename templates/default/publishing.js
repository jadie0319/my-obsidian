(() => {
  'use strict';
  const settings = JSON.parse(document.getElementById('publishing-settings').textContent);
  const t = (en, ko) => settings.language === 'ko' ? ko : en;
  let catalog;
  const entries = () => {
    if (!catalog) catalog = fetch(settings.base + 'assets/search-index.json').then(response => {
      if (!response.ok) throw new Error('Search index unavailable');
      return response.json();
    }).catch(error => { catalog = null; throw error; });
    return catalog;
  };
  const element = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const dialog = document.getElementById('garden-search');
  if (dialog) {
    const input = document.getElementById('garden-query');
    const results = document.getElementById('garden-results');
    const status = document.getElementById('garden-search-status');
    let generation = 0;
    const search = async () => {
      const current = ++generation;
      const query = input.value.trim().toLocaleLowerCase().normalize('NFC');
      results.replaceChildren();
      if (!query) { status.textContent = t('Type to search.', '검색어를 입력하세요.'); return; }
      status.textContent = t('Searching…', '검색 중…');
      try {
        const data = await entries();
        if (current !== generation) return;
        const terms = query.split(/\s+/);
        const matches = data.map(entry => {
          const title = entry.title.toLocaleLowerCase().normalize('NFC');
          const text = entry.text.toLocaleLowerCase().normalize('NFC');
          const tags = entry.tags.map(tag => tag.toLocaleLowerCase().normalize('NFC'));
          let score = 0;
          for (const term of terms) {
            if (term.startsWith('#')) { if (!tags.some(tag => tag.includes(term.slice(1)))) return null; score += 2; }
            else if (title.includes(term)) score += 5;
            else if (tags.some(tag => tag.includes(term))) score += 2;
            else if (text.includes(term)) score += 1;
            else return null;
          }
          return { entry, score };
        }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 20);
        status.textContent = matches.length ? t(`${matches.length} results (up to 20)`, `검색 결과 ${matches.length}개 (최대 20개)`) : t('No matching posts.', '검색 결과가 없습니다.');
        for (const { entry } of matches) {
          const li = element('li');
          const link = element('a', entry.title); link.href = entry.url;
          const term = terms.find(term => !term.startsWith('#')) || '';
          const at = term ? entry.text.toLocaleLowerCase().indexOf(term) : 0;
          const excerpt = entry.text.slice(Math.max(0, at - 45), Math.max(0, at - 45) + 180);
          const p = element('p');
          const hit = term ? excerpt.toLocaleLowerCase().indexOf(term) : -1;
          if (hit >= 0) p.append(document.createTextNode(excerpt.slice(0, hit)), element('mark', excerpt.slice(hit, hit + term.length)), document.createTextNode(excerpt.slice(hit + term.length)));
          else p.textContent = excerpt;
          li.append(link, p); results.append(li);
        }
      } catch { if (current === generation) status.textContent = t('Could not load search. Try again.', '검색을 불러오지 못했습니다. 다시 시도하세요.'); }
    };
    const open = () => { if (!dialog.open) dialog.showModal(); input.focus(); search(); };
    document.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', open));
    document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); } });
    input.addEventListener('input', search);
    dialog.addEventListener('keydown', event => {
      const links = [...results.querySelectorAll('a')];
      if (['ArrowDown', 'ArrowUp'].includes(event.key) && links.length) {
        event.preventDefault();
        const index = links.indexOf(document.activeElement);
        links[(index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
      } else if (event.key === 'Enter' && document.activeElement === input && links.length) { event.preventDefault(); links[0].click(); }
    });
  }

  const archive = document.getElementById('archive-list');
  if (archive) {
    const sort = document.getElementById('archive-sort');
    const tag = document.getElementById('archive-tag');
    const count = document.getElementById('archive-count');
    let generation = 0;
    const update = async () => {
      const current = ++generation;
      try {
        const data = await entries();
        if (generation !== current) return;
        const items = data.filter(entry => !tag.value || entry.tags.includes(tag.value));
        if (sort.value === 'title') items.sort((a, b) => a.title.localeCompare(b.title, settings.language));
        const cards = new Map([...archive.children].map(node => [node.dataset.url, node]));
        cards.forEach(node => { node.hidden = true; });
        for (const item of items) { const node = cards.get(item.url); if (node) { node.hidden = false; archive.append(node); } }
        count.textContent = t(`${items.length} posts`, `${items.length}개 글`);
      } catch { count.textContent = t('Filters unavailable. All posts remain below.', '필터를 불러오지 못했습니다. 전체 글을 표시합니다.'); }
    };
    sort.addEventListener('change', update); tag.addEventListener('change', update);
  }

  document.querySelectorAll('[data-copy-heading]').forEach(link => link.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link.href); link.textContent = '✓'; setTimeout(() => { link.textContent = '#'; }, 1500); }
    catch { /* The normal anchor still navigates when clipboard access is unavailable. */ }
  }));

  if (settings.previews) {
    const preview = element('aside'); preview.className = 'garden-preview'; preview.hidden = true;
    preview.setAttribute('role', 'tooltip'); preview.id = 'garden-preview'; document.body.append(preview);
    let active;
    const hide = () => { active?.removeAttribute('aria-describedby'); active = null; preview.hidden = true; };
    const show = async link => {
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      active = link;
      try {
        const data = await entries();
        if (active !== link) return;
        const entry = data.find(item => new URL(item.url, location.origin).pathname === url.pathname);
        if (!entry) return;
        preview.replaceChildren(element('strong', entry.title), element('p', entry.description));
        preview.hidden = false; link.setAttribute('aria-describedby', preview.id);
        const rect = link.getBoundingClientRect();
        preview.style.left = Math.max(8, Math.min(rect.left, innerWidth - preview.offsetWidth - 8)) + 'px';
        preview.style.top = Math.max(8, Math.min(rect.bottom + 8, innerHeight - preview.offsetHeight - 8)) + 'px';
      } catch { hide(); }
    };
    document.querySelectorAll('.content a, .sidebar-link').forEach(link => {
      link.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) show(link); });
      link.addEventListener('mouseleave', hide);
      link.addEventListener('focus', () => show(link)); link.addEventListener('blur', hide);
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, { passive: true });
  }
  document.querySelector('.garden-global')?.addEventListener('toggle', () => window.dispatchEvent(new Event('resize')));
})();
