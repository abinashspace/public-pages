/* Progressive enhancement only. The site is fully readable without this file. */
(function () {
  'use strict';

  /* ------------------------------------------------------------ theme */

  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function activeTheme() {
    return root.dataset.theme === 'light' || root.dataset.theme === 'dark' ? root.dataset.theme : systemTheme();
  }
  function paintToggle() {
    if (!toggle) return;
    var next = activeTheme() === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    toggle.setAttribute('title', 'Switch to ' + next + ' theme');
  }
  if (toggle) {
    paintToggle();
    toggle.addEventListener('click', function () {
      var next = activeTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('gta-theme', next); } catch (e) { /* private mode */ }
      paintToggle();
    });
  }

  /* ------------------------------------------------------ table tools */

  function parseSortValue(cell) {
    var raw = cell.getAttribute('data-sort');
    if (raw === null) raw = cell.textContent.trim();
    if (raw === '' || raw === '—') return null;
    var num = Number(raw.replace(/[$,%\s]/g, ''));
    return raw !== '' && !isNaN(num) && /[0-9]/.test(raw) ? num : raw.toLowerCase();
  }

  function wireSort(table) {
    var head = table.tHead && table.tHead.rows[0];
    if (!head) return;
    var cells = Array.prototype.slice.call(head.cells).filter(function (th) {
      return th.hasAttribute('data-sort');
    });
    cells.forEach(function (th) {
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'button');
      th.setAttribute('aria-sort', 'none');
      function sort() {
        var idx = th.cellIndex;
        var asc = th.getAttribute('aria-sort') !== 'ascending';
        cells.forEach(function (h) {
          if (h !== th) h.setAttribute('aria-sort', 'none');
        });
        th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        var body = table.tBodies[0];
        var rows = Array.prototype.slice.call(body.rows).filter(function (r) {
          return !r.querySelector('td[colspan]');
        });
        rows.sort(function (a, b) {
          var av = parseSortValue(a.cells[idx]);
          var bv = parseSortValue(b.cells[idx]);
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          if (typeof av === 'number' && typeof bv === 'number') return asc ? av - bv : bv - av;
          return asc
            ? String(av).localeCompare(String(bv), 'en')
            : String(bv).localeCompare(String(av), 'en');
        });
        rows.forEach(function (r) { body.appendChild(r); });
      }
      th.addEventListener('click', sort);
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); }
      });
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('table[data-sortable]'), wireSort);

  var filter = document.getElementById('table-filter');
  var results = document.getElementById('table-results');
  if (filter && results) {
    var count = document.getElementById('table-filter-count');
    var rows = Array.prototype.slice.call(results.querySelectorAll('tbody tr')).filter(function (r) {
      return !r.querySelector('td[colspan]');
    });
    var emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="20" class="note">No records match that filter.</td>';
    emptyRow.hidden = true;
    var body = results.querySelector('tbody');
    if (body) body.appendChild(emptyRow);

    var apply = function () {
      var q = filter.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (row) {
        var hay = (row.getAttribute('data-search') || '') + ' ' + row.textContent.toLowerCase();
        var hit = !q || hay.indexOf(q) !== -1;
        row.classList.toggle('is-hidden', !hit);
        if (hit) shown++;
      });
      emptyRow.hidden = shown !== 0;
      if (count) {
        count.textContent = q
          ? shown + ' of ' + rows.length + ' shown'
          : rows.length + ' records';
      }
    };
    filter.addEventListener('input', apply);
    apply();
  }

  /* ------------------------------------------------------------ search */

  var form = document.querySelector('.search-form');
  if (form) {
    var input = document.getElementById('q');
    var list = document.getElementById('results');
    var resultCount = document.getElementById('result-count');
    var index = null;
    var pending = null;
    var loadState = 'idle';
    var LIMIT = 300;

    function load() {
      if (loadState === 'ready') return Promise.resolve(index);
      if (loadState === 'loading') return pending;
      if (loadState === 'error') return Promise.resolve(null);
      loadState = 'loading';
      var url = (location.pathname.indexOf('/search/') !== -1 ? '../' : '') + 'data/search-index.json';
      pending = fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) {
          index = data.map(function (o) {
            o._s = (o.title + ' ' + o.subtitle + ' ' + (o.keywords || '')).toLowerCase();
            return o;
          });
          loadState = 'ready';
          return index;
        })
        .catch(function (e) {
          loadState = 'error';
          resultCount.textContent = 'Could not load the index (' + e.message + '). Open data/search-index.json directly.';
          return null;
        });
      return pending;
    }

    function highlight(text, terms) {
      var frag = document.createDocumentFragment();
      if (!terms.length) {
        frag.appendChild(document.createTextNode(text));
        return frag;
      }
      var lower = text.toLowerCase();
      var at = 0;
      while (at < text.length) {
        var best = -1;
        var hitLen = 0;
        for (var i = 0; i < terms.length; i++) {
          var pos = lower.indexOf(terms[i], at);
          if (pos !== -1 && (best === -1 || pos < best)) { best = pos; hitLen = terms[i].length; }
        }
        if (best === -1) {
          frag.appendChild(document.createTextNode(text.slice(at)));
          break;
        }
        if (best > at) frag.appendChild(document.createTextNode(text.slice(at, best)));
        var mark = document.createElement('mark');
        mark.textContent = text.slice(best, best + hitLen);
        frag.appendChild(mark);
        at = best + hitLen;
      }
      return frag;
    }

    function render() {
      var q = input.value.trim().toLowerCase();
      list.textContent = '';
      if (q.length < 2) {
        resultCount.textContent = 'Type at least 2 characters.';
        return;
      }
      if (!index) {
        if (loadState === 'error') return;
        resultCount.textContent = 'Loading index…';
        load().then(render);
        return;
      }
      var terms = q.split(/\s+/).filter(Boolean);
      var hits = [];
      for (var i = 0; i < index.length && hits.length < LIMIT; i++) {
        var o = index[i];
        var ok = true;
        for (var t = 0; t < terms.length; t++) {
          if (o._s.indexOf(terms[t]) === -1) { ok = false; break; }
        }
        if (ok) hits.push(o);
      }
      resultCount.textContent =
        hits.length + (hits.length === 1 ? ' result' : ' results') +
        (hits.length === LIMIT ? ' (limited)' : '') + ' for “' + q + '”';
      var frag = document.createDocumentFragment();
      hits.forEach(function (o) {
        var li = document.createElement('li');
        var kind = document.createElement('span');
        kind.className = 'kind';
        kind.textContent = o.kind;
        var a = document.createElement('a');
        a.href = '../' + o.url;
        a.appendChild(highlight(o.title, terms));
        var sub = document.createElement('span');
        sub.className = 'sub';
        sub.appendChild(highlight(o.subtitle || '', terms));
        li.appendChild(kind);
        li.appendChild(a);
        li.appendChild(sub);
        frag.appendChild(li);
      });
      list.appendChild(frag);
    }

    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(render, 120);
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); render(); });
    load();
    var q = new URLSearchParams(location.search).get('q');
    if (q) { input.value = q; }
    render();
  }

  /* ---------------------------------------------------- mobile header */

  var nav = document.querySelector('.site-head nav');
  var current = nav && nav.querySelector('a[aria-current="page"]');
  if (current && nav.scrollWidth > nav.clientWidth) {
    current.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
})();
