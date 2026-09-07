import { load } from 'cheerio';
import path from 'path';
import { ConfigSchema, ObsidianConfig } from '../types/Config';
import { ProcessedFile, GeneratedPage } from '../types/ParsedContent';
import { FileSystem } from '../utils/FileSystem';
import { PathResolver } from '../utils/PathResolver';

export const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]!));
export const json = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');
export function dateValue(value: unknown): number {
  const date = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(date) ? date : 0;
}

export class Publishing {
  readonly options;
  readonly entries;
  constructor(private config: ObsidianConfig, private files: ProcessedFile[]) {
    this.options = ConfigSchema.shape.publishing.parse(config.publishing || {})!;
    this.entries = files.map(file => {
      const $ = load(file.html);
      $('script, style').remove();
      const text = $.root().text().replace(/\s+/g, ' ').trim();
      const created = dateValue(file.frontmatter.created) || dateValue(file.frontmatter.modified);
      return {
        title: file.title, url: this.url(file.outputPath), text,
        description: String(file.frontmatter.description || text.slice(0, 180)),
        tags: file.frontmatter.tags || [], created,
        modified: dateValue(file.frontmatter.modified),
        status: String(file.frontmatter.status || ''),
        series: String(file.frontmatter.series || ''),
        order: Number(file.frontmatter.seriesOrder) || 0,
      };
    }).sort((a, b) => b.created - a.created || b.modified - a.modified || a.url.localeCompare(b.url));
  }

  t(en: string, ko: string): string { return this.options.language === 'ko' ? ko : en; }
  url(outputPath: string): string {
    return PathResolver.toUrlPath(outputPath, this.config.output, this.config.basePath);
  }
  absolute(url: string): string | undefined {
    if (!this.config.site.url) return undefined;
    const root = this.config.site.url.replace(/\/$/, '') + '/';
    return new URL(url.slice(this.config.basePath.length), root).href;
  }
  cards(entries = this.entries): string {
    return entries.map(entry => `<li class="garden-card" data-url="${escape(entry.url)}">
      <a href="${escape(entry.url)}">${escape(entry.title)}</a>
      <p>${escape(entry.description)}</p><small>${entry.created ? new Date(entry.created).toISOString().slice(0, 10) : ''}
      ${escape(entry.tags.map(tag => '#' + tag).join(' '))} ${escape(this.status(entry.status))}</small></li>`).join('');
  }
  status(value: string): string {
    const labels: Record<string, string> = {
      seedling: this.t('Seedling', '초기 메모'), budding: this.t('Budding', '정리 중'),
      evergreen: this.t('Evergreen', '완성'),
    };
    return labels[value] || value;
  }

  enhance(page: GeneratedPage): GeneratedPage {
    const $ = load(page.content);
    const base = this.config.basePath;
    if (!this.config.features.generateIndex) $('.site-title, .back-link').attr('href', base + 'archive.html');
    const entry = this.entries.find(item => item.url === this.url(page.outputPath));
    $('html').attr('lang', this.options.language);
    if (this.options.language === 'ko') {
      const labels: Record<string, string> = { Properties: '속성', Tags: '태그', Links: '연결한 글', Backlinks: '이 글을 연결한 글' };
      $('.sidebar-title').each((_, node) => { const label = labels[$(node).text().trim()]; if (label) $(node).text(label); });
      $('#search-input').attr('placeholder', '그래프에서 글 찾기');
      $('#tag-filter option[value=""]').text('모든 태그');
      $('#reset-graph').text('그래프 초기화');
      const orphan = $('#show-orphans-only').parent();
      if (orphan.length) orphan.contents().filter((_, node) => node.type === 'text').remove();
      orphan.append(' 연결 없는 글만');
      $('.back-link').text(this.config.features.generateIndex ? '← 홈' : '← 전체 글');
      $('.tag-page-count').each((_, node) => { $(node).text($(node).text().replace('documents', '개 글')); });
    }
    $('head').append(`<link rel="stylesheet" href="${escape(base)}assets/styles/publishing.css">`);
    const canonical = this.absolute(this.url(page.outputPath));
    if (canonical) $('head').append(`<link rel="canonical" href="${escape(canonical)}"><meta property="og:url" content="${escape(canonical)}">`);
    $('head').append(`<meta property="og:title" content="${escape(page.title)}"><meta property="og:type" content="${entry ? 'article' : 'website'}"><meta property="og:description" content="${escape(entry?.description || this.config.site.description)}"><meta property="og:site_name" content="${escape(this.config.site.title)}">`);
    if (entry && !$('meta[name="description"]').length) $('head').append(`<meta name="description" content="${escape(entry.description)}">`);
    if (this.options.rss && this.config.site.url) $('head').append(`<link rel="alternate" type="application/rss+xml" title="RSS" href="${escape(base)}feed.xml">`);
    const navigation = `<div class="garden-nav">${this.options.search ? `<button type="button" data-open-search>${this.t('Search', '검색')} <kbd>⌘/Ctrl K</kbd></button>` : ''}<a href="${escape(base)}archive.html">${this.t('All posts', '전체 글')}</a>${this.options.rss && this.config.site.url ? `<a href="${escape(base)}feed.xml">RSS</a>` : ''}</div>`;
    if ($('.nav-inner').length) $('.nav-inner').append(navigation);
    else $('body').prepend(navigation);
    if (this.options.search) $('body').append(`<dialog id="garden-search" aria-label="${this.t('Search posts', '글 검색')}"><form method="dialog"><button>${this.t('Close', '닫기')}</button></form><label>${this.t('Title, content or #tag', '제목, 본문 또는 #태그')}<input id="garden-query" type="search" autocomplete="off"></label><p id="garden-search-status" role="status"></p><ol id="garden-results"></ol></dialog>`);
    $('body').append(`<script id="publishing-settings" type="application/json">${json({ base, ...this.options })}</script><script defer src="${escape(base)}assets/scripts/publishing.js"></script>`);

    if (entry) {
      const first = $('.content').children().first();
      if (first.is('h1') && first.text().trim() === page.title.trim()) first.remove();
      const used = new Set<string>();
      $('[id]').each((_, node) => { const id = $(node).attr('id'); if (id) used.add(id); });
      const headings: { id: string; title: string }[] = [];
      $('.content h1, .content h2, .content h3').each((_, node) => {
        const heading = $(node);
        const title = heading.text();
        let id = heading.attr('id');
        if (!id) {
          const stem = title.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-') || 'section';
          id = stem;
          let suffix = 2;
          while (used.has(id)) id = `${stem}-${suffix++}`;
          used.add(id);
          heading.attr('id', id);
        }
        headings.push({ id, title });
        heading.append(` <a class="heading-link" href="#${escape(encodeURIComponent(id))}" aria-label="${this.t('Copy section link', '제목 링크 복사')}" data-copy-heading>#</a>`);
      });
      const toc = `<ol>${headings.map(h => `<li><a href="#${escape(encodeURIComponent(h.id))}">${escape(h.title)}</a></li>`).join('')}</ol>`;
      // Replace the old runtime TOC; anchors must also exist without JavaScript.
      $('script:not([src])').each((_, node) => { if ($(node).text().includes('// TOC generation')) $(node).remove(); });
      $('.page-toc').html(headings.length ? `<strong>${this.t('Contents', '목차')}</strong>${toc}` : '');
      if (headings.length) $('.content').before(`<details class="mobile-toc"><summary>${this.t('Contents', '목차')}</summary>${toc}</details>`);
      $('article > h1').after(`<p class="garden-meta">${this.t('Created', '작성')} ${entry.created ? new Date(entry.created).toISOString().slice(0, 10) : '—'}${entry.modified ? ` · ${this.t('Updated', '수정')} ${new Date(entry.modified).toISOString().slice(0, 10)}` : ''} <span>${escape(this.status(entry.status))}</span></p>`);
      if (entry.series) {
        const series = this.entries.filter(item => item.series === entry.series).sort((a, b) => a.order - b.order || a.created - b.created || a.url.localeCompare(b.url));
        const index = series.indexOf(entry);
        const ref = (item: typeof entry | undefined, label: string) => item ? `<a href="${escape(item.url)}">${label}: ${escape(item.title)}</a>` : '';
        $('article').append(`<nav class="garden-series" aria-label="${this.t('Series', '시리즈')}"><h2>${escape(entry.series)}</h2><ol>${series.map(item => `<li><a href="${escape(item.url)}" ${item === entry ? 'aria-current="page"' : ''}>${escape(item.title)}</a></li>`).join('')}</ol><div>${ref(series[index - 1], this.t('Previous', '이전 글'))} ${ref(series[index + 1], this.t('Next', '다음 글'))}</div></nav>`);
      }
      if (this.options.localGraph) {
        const neighbors = new Map<string, string>();
        $('.sidebar-link').each((_, node) => { const href = $(node).attr('href'); if (href && href !== entry.url) neighbors.set(href, $(node).text()); });
        const points = Array.from(neighbors).map(([url, title], i) => {
          const angle = 2 * Math.PI * i / neighbors.size;
          return { url, title, x: 150 + 104 * Math.cos(angle), y: 125 + 90 * Math.sin(angle) };
        });
        const graph = `<svg viewBox="0 0 300 250" role="img" aria-label="${this.t('Related posts', '연결된 글')}">${points.map(p => `<line x1="150" y1="125" x2="${p.x}" y2="${p.y}" stroke="currentColor" opacity="0.3"/>`).join('')}<circle cx="150" cy="125" r="10" fill="currentColor"><title>${escape(entry.title)}</title></circle>${points.map(p => `<a href="${escape(p.url)}" aria-label="${escape(p.title)}"><circle cx="${p.x}" cy="${p.y}" r="8" fill="currentColor"/><text x="${p.x}" y="${p.y + 20}" text-anchor="middle" fill="currentColor" font-size="9">${escape(p.title.slice(0, 12))}</text><title>${escape(p.title)}</title></a>`).join('')}</svg>`;
        $('.page-sidebar').append(`<section class="garden-local"><h3>${this.t('Nearby notes', '연결된 글')}</h3>${points.length ? graph : `<p>${this.t('No connected posts yet.', '아직 연결된 글이 없습니다.')}</p>`}</section>`);
      }
    }
    return { ...page, content: $.html() };
  }

  home(page: GeneratedPage): GeneratedPage {
    const $ = load(page.content);
    // Home listings are rendered at build time, not reconstructed from inline JS.
    $('script:not([src])').each((_, node) => { if ($(node).text().includes('// Collect flat tag list')) $(node).remove(); });
    const graph = $('.graph-section').remove();
    const tags = [...new Set(this.entries.flatMap(entry => entry.tags))].sort();
    const sections = {
      intro: `<header class="garden-intro"><h1>${escape(this.config.site.title)}</h1><p>${escape(this.config.site.description)}</p></header>`,
      recent: `<section><h2>${this.t('Recent uploads', '최근 글')}</h2><ol class="garden-cards">${this.cards(this.entries.slice(0, 10))}</ol><a href="${escape(this.config.basePath)}archive.html">${this.t('View all posts', '전체 글 보기')} →</a></section>`,
      topics: `<section><h2>${this.t('Topics', '주제')}</h2><div class="garden-topics">${tags.map(tag => `<a href="${escape(this.config.basePath)}tags/${escape(tag)}/">#${escape(tag)} (${this.entries.filter(entry => entry.tags.includes(tag)).length})</a>`).join('')}</div></section>`,
      graph: `<section class="garden-global"><h2>${this.t('Explore the graph', '글 연결 그래프')}</h2>${$.html(graph)}</section>`,
    };
    $('.index-layout').html(`<main class="garden-home">${[...new Set(this.options.homeOrder)].map(key => sections[key]).join('')}</main>`);
    return { ...page, content: $.html() };
  }

  archive(): GeneratedPage {
    const title = this.t('All posts', '전체 글');
    const tags = [...new Set(this.entries.flatMap(entry => entry.tags))].sort();
    return {
      title, frontmatter: {}, outputPath: path.join(this.config.output, 'archive.html'),
      content: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} - ${escape(this.config.site.title)}</title><link rel="stylesheet" href="${escape(this.config.basePath)}assets/styles/main.css"></head><body><nav class="top-nav"><div class="nav-inner"><a class="site-title" href="${escape(this.config.basePath)}">${escape(this.config.site.title)}</a></div></nav><main class="garden-home"><h1>${title}</h1><div class="archive-controls"><label>${this.t('Order', '정렬')}<select id="archive-sort"><option value="date">${this.t('Newest', '최신순')}</option><option value="title">${this.t('Title', '제목순')}</option></select></label><label>${this.t('Tag', '태그')}<select id="archive-tag"><option value="">${this.t('All', '전체')}</option>${tags.map(tag => `<option>${escape(tag)}</option>`).join('')}</select></label></div><p id="archive-count" role="status">${this.entries.length}</p><ol id="archive-list" class="garden-cards">${this.cards()}</ol></main></body></html>`,
    };
  }

  async emit(): Promise<void> {
    await FileSystem.writeFile(path.join(this.config.output, 'assets/search-index.json'), json(this.entries));
    for (const [source, target] of [['publishing.js', 'scripts/publishing.js'], ['publishing.css', 'styles/publishing.css']]) {
      await FileSystem.copyFile(path.join(__dirname, '../../templates/default', source), path.join(this.config.output, 'assets', target));
    }
    if (this.options.rss && this.config.site.url) {
      const items = this.entries.slice(0, 50).map(entry => `<item><title>${escape(entry.title)}</title><link>${escape(this.absolute(entry.url))}</link><guid isPermaLink="true">${escape(this.absolute(entry.url))}</guid><description>${escape(entry.description)}</description>${entry.created ? `<pubDate>${new Date(entry.created).toUTCString()}</pubDate>` : ''}</item>`).join('');
      await FileSystem.writeFile(path.join(this.config.output, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escape(this.config.site.title)}</title><link>${escape(this.config.site.url)}</link><description>${escape(this.config.site.description)}</description>${items}</channel></rss>`);
    }
  }
}
