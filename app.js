/* A2Z DSA Tracker — progress in localStorage, links out to LeetCode/GFG. */
(function () {
  'use strict';

  var STORE_KEY = 'a2z-progress-v1';
  var OPEN_KEY = 'a2z-open-topics-v1';

  var PLATFORM = {
    leetcode: { label: 'LC', cls: 'badge-lc', title: 'Solve on LeetCode' },
    gfg: { label: 'GFG', cls: 'badge-gfg', title: 'Solve on GeeksforGeeks' },
    cn: { label: 'CN', cls: 'badge-cn', title: 'Solve on Coding Ninjas' },
    article: { label: 'READ', cls: 'badge-doc', title: 'Theory — read the free article' },
    search: { label: 'FIND', cls: 'badge-doc', title: 'Search for this problem' }
  };

  // ---------- state ----------
  var progress = load(STORE_KEY, {});
  var openTopics = load(OPEN_KEY, { '0': true });
  var filterDiff = 'all';
  var searchQ = '';
  var hideDone = false;

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // stable id per problem: topicIndex + slug(name)
  function pid(ci, name) {
    return ci + ':' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // ---------- flatten for stats ----------
  var ALL = [];
  A2Z_DATA.forEach(function (cat, ci) {
    cat.subs.forEach(function (sub, si) {
      sub.problems.forEach(function (p, pix) {
        ALL.push({ ci: ci, si: si, pix: pix, id: pid(ci, p.name), p: p });
      });
    });
  });

  // ---------- stats ----------
  function updateStats() {
    var total = ALL.length, done = 0;
    var d = { Easy: [0, 0], Medium: [0, 0], Hard: [0, 0] };
    ALL.forEach(function (it) {
      var diff = it.p.difficulty;
      if (!d[diff]) d[diff] = [0, 0];
      d[diff][1]++;
      if (progress[it.id]) { done++; d[diff][0]++; }
    });
    setBar('overall-bar', done, total);
    document.getElementById('overall-count').textContent = done + ' / ' + total;
    ['Easy', 'Medium', 'Hard'].forEach(function (k) {
      setBar(k.toLowerCase() + '-bar', d[k][0], d[k][1]);
      document.getElementById(k.toLowerCase() + '-count').textContent = d[k][0] + ' / ' + d[k][1];
    });
  }

  function setBar(elId, done, total) {
    var el = document.getElementById(elId);
    if (el) el.style.width = (total ? (done / total) * 100 : 0) + '%';
  }

  function topicStats(ci) {
    var t = 0, done = 0;
    var d = { Easy: [0, 0], Medium: [0, 0], Hard: [0, 0] };
    ALL.forEach(function (it) {
      if (it.ci !== ci) return;
      t++;
      if (!d[it.p.difficulty]) d[it.p.difficulty] = [0, 0];
      d[it.p.difficulty][1]++;
      if (progress[it.id]) { done++; d[it.p.difficulty][0]++; }
    });
    return { done: done, total: t, d: d };
  }

  // ---------- filtering ----------
  function visible(p) {
    if (filterDiff !== 'all' && p.difficulty !== filterDiff) return false;
    if (searchQ && p.name.toLowerCase().indexOf(searchQ) === -1) return false;
    return true;
  }

  // ---------- render ----------
  var topicsEl = document.getElementById('topics');

  function render() {
    topicsEl.innerHTML = '';
    var anyShown = false;

    A2Z_DATA.forEach(function (cat, ci) {
      var ts = topicStats(ci);
      var topicEl = document.createElement('div');
      topicEl.className = 'topic';
      var isOpen = searchQ ? true : !!openTopics[ci];

      // count visible problems under current filters
      var visCount = 0;
      cat.subs.forEach(function (sub) {
        sub.problems.forEach(function (p) {
          var id = pid(ci, p.name);
          if (visible(p) && !(hideDone && progress[id])) visCount++;
        });
      });
      if ((searchQ || filterDiff !== 'all' || hideDone) && visCount === 0) return;
      anyShown = true;
      if (isOpen) topicEl.classList.add('open');

      var pct = ts.total ? Math.round((ts.done / ts.total) * 100) : 0;
      var header = document.createElement('div');
      header.className = 'topic-header';
      header.innerHTML =
        '<div class="topic-num">' + (ci + 1) + '</div>' +
        '<div class="topic-main">' +
          '<div class="topic-title-row">' +
            '<span class="topic-name">' + esc(cat.name) + '</span>' +
            '<span class="topic-count">' + ts.done + ' / ' + ts.total + ' · ' + pct + '%</span>' +
          '</div>' +
          '<div class="bar"><div class="bar-fill fill-accent" style="width:' + pct + '%"></div></div>' +
          '<div class="topic-diffs">' +
            diffChip('Easy', ts.d) + diffChip('Medium', ts.d) + diffChip('Hard', ts.d) +
          '</div>' +
        '</div>' +
        '<span class="topic-caret">▶</span>';
      header.addEventListener('click', function () {
        openTopics[ci] = !openTopics[ci];
        save(OPEN_KEY, openTopics);
        topicEl.classList.toggle('open');
      });
      topicEl.appendChild(header);

      var body = document.createElement('div');
      body.className = 'topic-body';

      cat.subs.forEach(function (sub) {
        var rows = [];
        sub.problems.forEach(function (p) {
          var id = pid(ci, p.name);
          if (!visible(p)) return;
          if (hideDone && progress[id]) return;
          rows.push(problemRow(p, id, topicEl, ci));
        });
        if (!rows.length) return;
        if (cat.subs.length > 1) {
          var sn = document.createElement('div');
          sn.className = 'sub-name';
          sn.textContent = sub.name;
          body.appendChild(sn);
        }
        rows.forEach(function (r) { body.appendChild(r); });
      });

      topicEl.appendChild(body);
      topicsEl.appendChild(topicEl);
    });

    if (!anyShown) {
      topicsEl.innerHTML = '<div class="empty-note">No problems match — clear the search or filters.</div>';
    }
    updateStats();
  }

  function diffChip(k, d) {
    var v = d[k] || [0, 0];
    if (!v[1]) return '';
    return '<span class="d-' + k.toLowerCase() + '">' + k.charAt(0) + ' ' + v[0] + '/' + v[1] + '</span>';
  }

  function problemRow(p, id, topicEl, ci) {
    var row = document.createElement('div');
    row.className = 'problem' + (progress[id] ? ' done' : '');

    var check = document.createElement('button');
    check.className = 'p-check';
    check.setAttribute('aria-label', 'Mark solved');
    check.textContent = '✓';
    check.addEventListener('click', function () {
      if (progress[id]) delete progress[id];
      else progress[id] = 1;
      save(STORE_KEY, progress);
      row.classList.toggle('done');
      refreshTopicHeader(topicEl, ci);
      updateStats();
      if (hideDone && progress[id]) row.remove();
    });

    var plat = PLATFORM[p.platform] || PLATFORM.search;
    var link = document.createElement('a');
    link.className = 'p-name';
    link.href = p.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = plat.title;
    link.textContent = p.name;

    var badges = document.createElement('div');
    badges.className = 'p-badges';
    badges.innerHTML =
      '<span class="badge ' + plat.cls + '">' + plat.label + '</span>' +
      '<span class="badge badge-diff badge-' + p.difficulty.toLowerCase() + '">' + p.difficulty + '</span>';

    var extras = document.createElement('div');
    extras.className = 'p-links';
    if (p.yt) extras.innerHTML += '<a class="icon-link" title="Video solution" target="_blank" rel="noopener" href="' + escAttr(p.yt) + '">▶</a>';
    if (p.article && p.platform !== 'article') extras.innerHTML += '<a class="icon-link" title="Article / editorial" target="_blank" rel="noopener" href="' + escAttr(p.article) + '">📄</a>';

    row.appendChild(check);
    row.appendChild(link);
    row.appendChild(badges);
    row.appendChild(extras);
    return row;
  }

  function refreshTopicHeader(topicEl, ci) {
    var ts = topicStats(ci);
    var pct = ts.total ? Math.round((ts.done / ts.total) * 100) : 0;
    topicEl.querySelector('.topic-count').textContent = ts.done + ' / ' + ts.total + ' · ' + pct + '%';
    topicEl.querySelector('.topic-header .bar-fill').style.width = pct + '%';
    topicEl.querySelector('.topic-diffs').innerHTML =
      diffChip('Easy', ts.d) + diffChip('Medium', ts.d) + diffChip('Hard', ts.d);
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  // ---------- controls ----------
  var searchTimer;
  document.getElementById('search').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    var v = e.target.value.trim().toLowerCase();
    searchTimer = setTimeout(function () { searchQ = v; render(); }, 150);
  });

  document.getElementById('diff-chips').addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    filterDiff = btn.dataset.diff;
    document.querySelectorAll('#diff-chips .chip').forEach(function (c) {
      c.classList.toggle('active', c === btn);
    });
    render();
  });

  document.getElementById('hide-done').addEventListener('change', function (e) {
    hideDone = e.target.checked;
    render();
  });

  // export / import / reset
  document.getElementById('export-btn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ progress: progress, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'a2z-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById('import-btn').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        progress = data.progress || data;
        save(STORE_KEY, progress);
        render();
      } catch (err) { alert('Invalid progress file.'); }
    };
    reader.readAsText(f);
    e.target.value = '';
  });
  document.getElementById('reset-btn').addEventListener('click', function () {
    if (confirm('Reset ALL progress? This cannot be undone.')) {
      progress = {};
      save(STORE_KEY, progress);
      render();
    }
  });

  render();
})();
