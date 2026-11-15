/* Search enhancement only. The site is fully readable without this file. */
(function () {
  'use strict';
  var form = document.querySelector('.search-form');
  if (!form) return;
  var input = document.getElementById('q');
  var list = document.getElementById('results');
  var count = document.getElementById('result-count');
  var index = null;
  var loading = false;
  var LIMIT = 200;

  function load() {
    if (index || loading) return Promise.resolve(index);
    loading = true;
    var url = (location.pathname.indexOf('/search/') !== -1 ? '../' : '') + 'data/search-index.json';
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        index = data.map(function (o) {
          o._s = (o.title + ' ' + o.subtitle + ' ' + (o.keywords || '')).toLowerCase();
          return o;
        });
        return index;
      })
      .catch(function (e) {
        count.textContent = 'Could not load the index (' + e.message + '). Open data/search-index.json directly.';
        return null;
      });
  }

  function render() {
    var q = input.value.trim().toLowerCase();
    list.textContent = '';
    if (q.length < 2) {
      count.textContent = 'Type at least 2 characters.';
      return;
    }
    if (!index) {
      count.textContent = 'Loading index…';
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
    count.textContent = hits.length + (hits.length === 1 ? ' result' : ' results') + (hits.length === LIMIT ? ' (limited)' : '') + ' for “' + q + '”';
    var frag = document.createDocumentFragment();
    hits.forEach(function (o) {
      var li = document.createElement('li');
      var kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = o.kind;
      var a = document.createElement('a');
      a.href = '../' + o.url;
      a.textContent = o.title;
      var sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = o.subtitle || '';
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
  if (q) { input.value = q; render(); }
})();
