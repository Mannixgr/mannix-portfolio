// Network background behind the hero: nodes drift and link up when close.
// Stays still for reduced-motion users and pauses while the hero is off-screen.
(function () {
  var canvas = document.querySelector('.hero-net');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var hero = canvas.parentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RGB = '155, 163, 167'; // --text-muted
  var LINK_DIST = 130;
  var w, h, nodes = [], running = false, visible = true;

  function setup() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth;
    h = hero.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = Math.min(55, Math.round(w * h / 14000));
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.2 + 0.8
      });
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        if (Math.abs(dx) > LINK_DIST || Math.abs(dy) > LINK_DIST) continue;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK_DIST) {
          ctx.strokeStyle = 'rgba(' + RGB + ',' + (1 - d / LINK_DIST) * 0.22 + ')';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = 'rgba(' + RGB + ', 0.55)';
    nodes.forEach(function (n) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function step() {
    if (!visible) { running = false; return; }
    nodes.forEach(function (n) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    });
    draw();
    requestAnimationFrame(step);
  }

  function start() {
    if (reduceMotion || running) return;
    running = true;
    requestAnimationFrame(step);
  }

  // Phones fire resize when the URL bar slides in and out; only a width change needs a new graph
  var resizeTimer, lastWidth = hero.clientWidth;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (hero.clientWidth === lastWidth) return;
      lastWidth = hero.clientWidth;
      setup();
    }, 150);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }).observe(hero);
  }

  setup();
  start();
})();

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
