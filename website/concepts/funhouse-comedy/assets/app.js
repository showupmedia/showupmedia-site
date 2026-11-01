/* Funhouse concept v2: hide past shows, town filter, booking picker, click-to-play video, carousel arrows. No libraries. */
(function () {
  var d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  $$('[data-date]').forEach(function (el) { if (el.dataset.date < today) el.remove(); });

  // show list: month headers, town chips, show more
  var list = $('#rows'), more = $('#showmore'), town = 'all', expanded = false, LIMIT = 10;
  function apply() {
    if (!list) return;
    var n = 0, kids = $$('#rows > li');
    kids.forEach(function (li) {
      if (li.classList.contains('mh')) return;
      var ok = town === 'all' || li.dataset.town === town;
      if (ok) n++;
      li.hidden = !ok || (town === 'all' && !expanded && n > LIMIT);
    });
    kids.forEach(function (li, i) {
      if (!li.classList.contains('mh')) return;
      var vis = false;
      for (var j = i + 1; j < kids.length && !kids[j].classList.contains('mh'); j++) if (!kids[j].hidden) { vis = true; break; }
      li.hidden = !vis;
    });
    if (more) { more.hidden = !(town === 'all' && !expanded && n > LIMIT); more.textContent = 'Show all ' + n + ' shows'; }
  }
  $$('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('.chip').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
      c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); town = c.dataset.town; apply();
    });
  });
  if (more) more.addEventListener('click', function () { expanded = true; apply(); });
  apply();

  // booking picker: town -> its next dates -> Book (straight to the real ticket link)
  var pk = $('#picker');
  if (pk && pk.showModal) {
    var s1 = $('#pk-1'), s2 = $('#pk-2'), back = $('#pk-back'), h = $('#pk-h'), out = $('#pk-rows'), vlink = $('#pk-venue');
    function step1() { s1.hidden = false; s2.hidden = true; back.hidden = true; h.textContent = 'Where are you?'; }
    $$('[data-picker]').forEach(function (b) { b.addEventListener('click', function (ev) { ev.preventDefault(); step1(); pk.showModal(); }); });
    // hide towns whose shows have all passed
    $$('.ptown', pk).forEach(function (b) { if (list && !list.querySelector('.row[data-town="' + b.dataset.town + '"]')) b.remove(); });
    $$('.ptown', pk).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.dataset.town; out.innerHTML = '';
        var rows = $$('#rows .row').filter(function (r) { return r.dataset.town === t; });
        rows.forEach(function (r) { var c = r.cloneNode(true); c.hidden = false; out.appendChild(c); });
        var a = rows[0] && rows[0].querySelector('.rw a');
        var slugs = rows.map(function (r) { var x = r.querySelector('.rw a'); return x && x.getAttribute('href'); });
        vlink.hidden = !a || slugs.some(function (s) { return s !== slugs[0]; });
        if (a) vlink.href = a.getAttribute('href');
        h.textContent = t; s1.hidden = true; s2.hidden = false; back.hidden = false; pk.querySelector('.pkbody').scrollTop = 0;
        var first = out.querySelector('.btn'); if (first) first.focus();
      });
    });
    back.addEventListener('click', step1);
  }

  // click-to-play YouTube in a modal (no third-party code until the visitor taps)
  var pl = $('#player');
  function closePlayer() { if (pl.open) pl.close(); }
  if (pl) {
    pl.addEventListener('close', function () { $('.pframe', pl).innerHTML = ''; });
    pl.addEventListener('click', function (ev) { if (ev.target === pl) closePlayer(); });
    $$('[data-yt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&playsinline=1&rel=0';
        f.title = b.dataset.title || 'Video'; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
        pl.classList.toggle('land', b.dataset.v === '0');
        $('.pframe', pl).appendChild(f);
        if (pl.showModal) pl.showModal(); else window.open('https://www.youtube.com/watch?v=' + b.dataset.yt);
      });
    });
  }
  $$('dialog [data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });

  // carousel arrows (desktop)
  var hcs = $('#hcs');
  $$('.cbtn').forEach(function (b) { b.addEventListener('click', function () { hcs.scrollBy({ left: +b.dataset.dir * hcs.clientWidth * 0.8, behavior: 'smooth' }); }); });

  // venue map: load Google Maps only when asked
  $$('[data-map]').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = b.parentNode, f = document.createElement('iframe');
      f.src = m.dataset.src; f.title = 'Map'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
      m.appendChild(f); b.remove();
    });
  });
})();
