// On the GitHub Pages backup, point back to the main site instead of to itself
if (location.hostname.endsWith('github.io')) {
  var page = location.pathname.split('/').pop();
  document.querySelector('.mirror-link').innerHTML =
    'Backup copy · <a href="https://portfolio-site.tail8c489d.ts.net/' + page + '">Go to the main site</a>';
}

// Copy buttons: put the email on the clipboard and confirm for two seconds
document.querySelectorAll('.copy-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(function () {
      btn.textContent = 'Copied ✓';
      btn.classList.add('is-copied');
      setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('is-copied'); }, 2000);
    });
  });
});

// Deploy stamp: the deploy workflow writes build.json next to the pages.
// It only exists on the homelab server, so it's only requested there.
(function () {
  var stamp = document.querySelector('.deploy-stamp');
  if (!stamp || !window.fetch || location.hostname !== 'portfolio-site.tail8c489d.ts.net') return;
  fetch('build.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (build) {
      if (!/^[0-9a-f]{40}$/.test(build.sha)) return;
      var mins = Math.max(0, Math.round((Date.now() - Date.parse(build.time)) / 60000));
      var ago = mins < 1 ? 'just now'
        : mins < 60 ? mins + ' min ago'
        : mins < 1440 ? Math.round(mins / 60) + ' h ago'
        : Math.round(mins / 1440) + ' d ago';
      var link = document.createElement('a');
      link.href = 'https://github.com/Mannixgr/mannix-portfolio/commit/' + build.sha;
      link.textContent = build.sha.slice(0, 7);
      stamp.append('Deployed ', link, ' · ' + ago + ' · served from my homelab');
      stamp.hidden = false;
    })
    .catch(function () {});
})();

// Homelab diagram draws itself the first time it scrolls into view.
// The SVG is fetched and inlined so its lines can be animated; the <img> stays if anything fails.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.fetch || !window.DOMParser || !('IntersectionObserver' in window)) return;

  document.querySelectorAll('.diagram-trace img').forEach(function (img) {
    fetch(img.getAttribute('src'))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        var parsed = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        if (parsed.nodeName !== 'svg') return;
        var svg = document.importNode(parsed, true);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', img.alt);
        svg.classList.add('traced');

        var lines = [];
        svg.querySelectorAll('rect, ellipse, text, line, path').forEach(function (el) {
          if (el.closest('defs')) return;
          if (el.hasAttribute('stroke-dasharray')) { el.classList.add('trace-late'); return; }
          if (el.nodeName === 'line') { lines.push(el); return; }
          // Unfilled paths are connectors and draw like lines; filled ones are shapes
          if (el.nodeName === 'path') {
            if (el.getAttribute('fill') === 'none') lines.push(el);
            else el.classList.add('trace-late');
            return;
          }
          if (el.parentNode === svg && el.nodeName === 'rect' && !el.hasAttribute('x')) return; // page background
          el.classList.add('trace-node');
        });
        var lateDelay = (0.4 + lines.length * 0.07 + 0.3) + 's';
        svg.querySelectorAll('.trace-late').forEach(function (el) { el.style.transitionDelay = lateDelay; });

        // Inline first: path lengths can only be measured once the SVG is in the document
        img.replaceWith(svg);

        lines.forEach(function (el, i) {
          var len = el.getTotalLength();
          el.classList.add('trace-line');
          el.style.strokeDasharray = len;
          el.style.strokeDashoffset = len;
          el.style.transitionDelay = (0.4 + i * 0.07) + 's';
          // Arrowheads wait until their line has finished drawing
          var marker = el.getAttribute('marker-end');
          if (marker) {
            el.removeAttribute('marker-end');
            el.addEventListener('transitionend', function () { el.setAttribute('marker-end', marker); }, { once: true });
          }
        });

        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          svg.classList.add('is-traced');
          lines.forEach(function (el) { el.style.strokeDashoffset = 0; });
        }, { threshold: 0.3 });
        io.observe(svg);
      })
      .catch(function () {});
  });
})();

// Diagram lightbox: a plain click opens the diagram full width on the page.
// Cmd/Ctrl/Shift-clicks and no-JS visitors still get the link to the SVG.
(function () {
  var links = document.querySelectorAll('.diagram a');
  if (!links.length || !window.HTMLDialogElement) return;
  var box = document.createElement('dialog');
  box.className = 'lightbox';
  box.setAttribute('aria-label', 'Diagram');
  box.innerHTML = '<img alt=""><div class="lightbox-bar"><a target="_blank" rel="noopener">Open full size <span class="ext" aria-hidden="true">\u2197</span></a><button type="button" class="btn">Close</button></div>';
  document.body.appendChild(box);
  var big = box.querySelector('img');
  var full = box.querySelector('a');
  box.querySelector('button').addEventListener('click', function () { box.close(); });
  // Clicks on the dialog itself (its padding or the backdrop), not its content, close it
  box.addEventListener('click', function (e) { if (e.target === box) box.close(); });

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      // The traced diagrams replace their <img> with inline SVG, so read the label from either
      var img = a.querySelector('img');
      var svg = a.querySelector('svg');
      big.src = a.getAttribute('href');
      big.alt = img ? img.alt : (svg && svg.getAttribute('aria-label')) || '';
      full.href = a.getAttribute('href');
      box.showModal();
    });
  });
})();
