/* Funhouse preview: hide past shows, filter list, click-to-load clips. No libraries. */
(function () {
  var d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  var gigs = [].slice.call(document.querySelectorAll('.gig'));
  gigs.forEach(function (g) { if (g.dataset.date < today) { g.remove(); } });
  gigs = [].slice.call(document.querySelectorAll('.gig'));
  document.querySelectorAll('.month').forEach(function (m) { if (!m.querySelector('.gig')) m.remove(); });

  // hero "next show": if the baked-in one has passed, swap in the first upcoming card
  var next = document.getElementById('next');
  if (next && gigs.length) {
    var first = gigs.find ? gigs.find(function (g) { return !g.classList.contains('is-x'); }) : gigs[0];
    var nd = next.querySelector('.date');
    if (first && nd && first.dataset.date !== next.dataset.date && next.dataset.date && next.dataset.date < today) {
      nd.innerHTML = first.querySelector('.date').innerHTML;
      next.querySelector('.where').innerHTML = first.querySelector('.where').innerHTML;
      next.querySelector('h2').innerHTML = first.querySelector('h3').innerHTML;
      var b = first.querySelector('.gbuy .btn'), nb = next.querySelector('.nextcta .btn');
      if (b && nb) nb.href = b.href;
    }
  }

  var chips = document.querySelectorAll('.chip'), sel = document.getElementById('fvenue'), q = document.getElementById('fq'),
      count = document.getElementById('count'), empty = document.getElementById('empty'), area = 'all',
      more = document.getElementById('showmore'), expanded = false, LIMIT = 12;
  function apply() {
    var v = sel ? sel.value : 'all', t = q ? q.value.trim().toLowerCase() : '', n = 0;
    var unfiltered = area === 'all' && v === 'all' && !t;
    gigs.forEach(function (g) {
      var ok = (area === 'all' || g.dataset.area === area) && (v === 'all' || g.dataset.venue === v) && (!t || g.dataset.search.indexOf(t) > -1);
      if (ok) n++;
      g.hidden = !ok || (unfiltered && !expanded && n > LIMIT);
    });
    if (more) { more.hidden = !(unfiltered && !expanded && n > LIMIT); more.textContent = 'Show all ' + n + ' dates'; }
    document.querySelectorAll('.month').forEach(function (m) { m.hidden = !m.querySelector('.gig:not([hidden])'); });
    if (count) count.textContent = n + ' upcoming show' + (n === 1 ? '' : 's');
    if (empty) empty.hidden = n > 0;
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
      c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); area = c.dataset.area; apply();
    });
  });
  if (sel) sel.addEventListener('change', apply);
  if (q) q.addEventListener('input', apply);
  if (more) more.addEventListener('click', function () { expanded = true; apply(); });
  if (count) apply();

  // click-to-play YouTube (no third-party JS until the visitor asks for it)
  document.querySelectorAll('.clip.yt').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&playsinline=1';
      f.title = b.dataset.title; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
      var w = document.createElement('div'); w.className = 'clip'; w.appendChild(f); b.replaceWith(w);
    }, { once: true });
  });
})();
// venue areas: collapsed on phones, open on larger screens
if (window.matchMedia('(max-width: 819px)').matches) document.querySelectorAll('details.area').forEach(function (d) { d.open = false; });
