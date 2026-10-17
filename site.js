// Network background behind the hero: nodes drift and link up when close.
// Stays still for reduced-motion users and pauses while the hero is off-screen.
(function () {
  var canvas = document.querySelector('.hero-net');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var hero = canvas.parentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RGB = '142, 182, 155'; // --text-muted
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

// Project picker: one card at a time, arrow keys move between tabs (WAI-ARIA tabs pattern)
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.work-picker [role="tab"]'));
  if (!tabs.length) return;
  var panels = tabs.map(function (tab) {
    var panel = document.getElementById(tab.getAttribute('aria-controls'));
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    return panel;
  });

  function select(index, focus) {
    tabs.forEach(function (tab, i) {
      var on = i === index;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[index].focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(i); });
    tab.addEventListener('keydown', function (e) {
      var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select((next + tabs.length) % tabs.length, true);
    });
  });

  select(0);
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
          if (el.nodeName === 'path') { el.classList.add('trace-late'); return; }
          if (el.parentNode === svg && el.nodeName === 'rect' && !el.hasAttribute('x')) return; // page background
          el.classList.add('trace-node');
        });

        lines.forEach(function (el, i) {
          var dx = el.x2.baseVal.value - el.x1.baseVal.value;
          var dy = el.y2.baseVal.value - el.y1.baseVal.value;
          var len = Math.sqrt(dx * dx + dy * dy);
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
        var lateDelay = (0.4 + lines.length * 0.07 + 0.3) + 's';
        svg.querySelectorAll('.trace-late').forEach(function (el) { el.style.transitionDelay = lateDelay; });

        img.replaceWith(svg);

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

(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(function (el) { io.observe(el); });
})();
