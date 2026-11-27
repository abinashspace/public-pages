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
  var gallery = document.getElementById('gallery-results');
  if (filter && (results || gallery)) {
    var count = document.getElementById('table-filter-count');
    var rows = results
      ? Array.prototype.slice.call(results.querySelectorAll('tbody tr')).filter(function (r) {
          return !r.querySelector('td[colspan]');
        })
      : [];
    var cards = gallery ? Array.prototype.slice.call(gallery.querySelectorAll('.media-card')) : [];
    var totalItems = cards.length || rows.length;

    var emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="20" class="note">No entries match that filter.</td>';
    emptyRow.hidden = true;
    var body = results && results.querySelector('tbody');
    if (body) body.appendChild(emptyRow);

    var apply = function () {
      var q = filter.value.trim().toLowerCase();
      var shownRows = 0;
      rows.forEach(function (row) {
        var hay = (row.getAttribute('data-search') || '') + ' ' + row.textContent.toLowerCase();
        var hit = !q || hay.indexOf(q) !== -1;
        row.classList.toggle('is-hidden', !hit);
        if (hit) shownRows++;
      });
      var shownCards = 0;
      cards.forEach(function (card) {
        var hay = (card.getAttribute('data-search') || '') + ' ' + card.textContent.toLowerCase();
        var hit = !q || hay.indexOf(q) !== -1;
        card.classList.toggle('is-hidden', !hit);
        if (hit) shownCards++;
      });
      var shown = cards.length ? shownCards : shownRows;
      emptyRow.hidden = shownRows !== 0;
      if (count) {
        count.textContent = q
          ? shown + ' of ' + totalItems + ' shown'
          : totalItems + ' entries';
      }
    };
    filter.addEventListener('input', apply);
    apply();
  }

  var viewButtons = Array.prototype.slice.call(document.querySelectorAll('.view-toggle button[data-view]'));
  if (viewButtons.length && gallery && results) {
    viewButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        viewButtons.forEach(function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        gallery.classList.toggle('is-view-hidden', view !== 'gallery');
        results.classList.toggle('is-view-hidden', view !== 'table');
      });
    });
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
      var clearBtn = document.getElementById('q-clear');
      var browseList = document.getElementById('browse-list');
      var browseLabel = document.getElementById('browse-label');
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      if (browseList) {
        browseList.querySelectorAll('.app-browse-row').forEach(function (r) {
          var hit = !q || (r.getAttribute('data-name') || '').indexOf(q) !== -1;
          r.style.display = hit ? 'flex' : 'none';
        });
      }
      list.textContent = '';
      if (q.length < 2) {
        resultCount.textContent = '';
        if (browseLabel) browseLabel.style.display = '';
        if (browseList) browseList.style.display = '';
        return;
      }
      if (browseLabel) browseLabel.style.display = 'none';
      if (browseList) browseList.style.display = 'none';
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
    var clearBtn = document.getElementById('q-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        render();
        input.focus();
      });
    }
    load();
    var q = new URLSearchParams(location.search).get('q');
    if (q) { input.value = q; }
    render();
  }

  /* ------------------------------------------------------------ toast */

  var toastEl = document.getElementById('toast');
  var toastTimer;
  function say(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }

  /* -------------------------------------------------- home do-you-know */

  var dykDataEl = document.getElementById('dyk-data');
  var dykBtn = document.getElementById('dyk');
  var dykDetail = document.getElementById('dyk-detail');
  if (dykDataEl && dykBtn && dykDetail) {
    try {
      var dykItems = JSON.parse(dykDataEl.textContent || '[]');
      if (dykItems.length) {
        var now = new Date();
        var day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
        var item = dykItems[day % dykItems.length];
        var $id = function (id) { return document.getElementById(id); };
        $id('dyk-cat').textContent = item.c;
        $id('dyk-title').textContent = item.t;
        $id('dyk-teaser').textContent = item.s;
        $id('dyk-img').src = item.img;
        $id('dyk-img').alt = item.t;

        var dateStr = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        var openDyk = function () {
          $id('d-img').src = item.img;
          $id('d-img').alt = item.t;
          $id('d-cat').textContent = item.c;
          $id('d-title').textContent = item.t;
          $id('d-desc').textContent = item.d;
          $id('d-date').textContent = 'DO YOU KNOW · ' + dateStr;
          $id('d-link').href = item.href;
          dykDetail.classList.add('on');
          dykDetail.setAttribute('aria-hidden', 'false');
          window.scrollTo(0, 0);
        };
        var closeDyk = function () {
          dykDetail.classList.remove('on');
          dykDetail.setAttribute('aria-hidden', 'true');
        };
        dykBtn.addEventListener('click', openDyk);
        $id('dyk-back').addEventListener('click', closeDyk);
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && dykDetail.classList.contains('on')) closeDyk();
        });
      }
    } catch (e) { /* ignore malformed inline json */ }
  }

  /* ---------------------------------------------------------- profile */

  var dpBtn = document.getElementById('dp');
  if (dpBtn) {
    var $p = function (id) { return document.getElementById(id); };
    var defaultPic = $p('p-img').getAttribute('src');
    var pic = '';
    var showPic = function () {
      $p('p-img').src = pic || defaultPic;
    };
    var updateHead = function () {
      $p('p-shown').textContent = $p('p-name').value.trim();
    };
    dpBtn.addEventListener('click', function () { $p('p-file').click(); });
    $p('p-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          var s = 256, c = document.createElement('canvas');
          c.width = c.height = s;
          var m = Math.min(im.width, im.height);
          var sx = (im.width - m) / 2;
          var sy = (im.height - m) / 2;
          c.getContext('2d').drawImage(im, sx, sy, m, m, 0, 0, s, s);
          pic = c.toDataURL('image/jpeg', 0.85);
          showPic();
        };
        im.src = r.result;
      };
      r.readAsDataURL(f);
    });
    $p('p-name').addEventListener('input', updateHead);

    var saveProfile = function () {
      var d = {
        name: $p('p-name').value.trim(),
        age: $p('p-age').value,
        game: $p('p-game').value,
        pic: pic,
      };
      try {
        localStorage.setItem('gtaProfile', JSON.stringify(d));
        say('Profile saved');
      } catch (e) {
        say('Saved for this visit only');
      }
    };
    $p('p-save').addEventListener('click', saveProfile);

    var applyProfile = function (d) {
      $p('p-name').value = String(d.name || '').slice(0, 30);
      $p('p-age').value = d.age || '';
      $p('p-game').value = d.game || '';
      pic = typeof d.pic === 'string' && d.pic.indexOf('data:image/') === 0 ? d.pic : '';
      showPic();
      updateHead();
    };

    $p('p-exp').addEventListener('click', function () {
      var snap = {
        app: 'gta-guide',
        name: $p('p-name').value.trim(),
        age: $p('p-age').value,
        game: $p('p-game').value,
        pic: pic,
      };
      var t = JSON.stringify(snap);
      $p('p-box').value = t;
      $p('p-box').select();
      try {
        navigator.clipboard.writeText(t).then(
          function () { say('Copied to clipboard'); },
          function () { say('Select the text and copy it'); }
        );
      } catch (e) {
        say('Select the text and copy it');
      }
    });

    var doImport = function () {
      try {
        var d = JSON.parse($p('p-box').value);
        if (!d || typeof d !== 'object' || d.app !== 'gta-guide') {
          say('That isn’t valid profile data');
          return;
        }
        applyProfile(d);
        saveProfile();
      } catch (e) {
        say('That isn’t valid profile data');
      }
    };
    $p('p-imp').addEventListener('click', doImport);
    $p('p-impf').addEventListener('click', function () { $p('p-jf').click(); });
    $p('p-jf').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { $p('p-box').value = r.result; doImport(); };
      r.readAsText(f);
      e.target.value = '';
    });

    try {
      var saved = localStorage.getItem('gtaProfile');
      if (saved) {
        var parsed = JSON.parse(saved);
        applyProfile(parsed);
      }
    } catch (e) { /* private mode */ }
  }

  /* ---------------------------------------------------- mobile header */

  var nav = document.querySelector('.site-head nav');
  var current = nav && nav.querySelector('a[aria-current="page"]');
  if (current && nav.scrollWidth > nav.clientWidth) {
    current.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
})();
