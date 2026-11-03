/* KVK v2 — theme toggle, scroll reveal, gantt, estimator, enquiry form */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* theme */
  var root = document.documentElement, tb = $('#themebtn');
  function paint() { if (tb) tb.textContent = root.dataset.theme === 'dark' ? '☀' : '☾'; }
  paint();
  if (tb) tb.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('kvk-theme', root.dataset.theme); } catch (e) {}
    paint();
  });

  /* scroll reveal + gantt */
  $$('.service,.step,.value,.toolcard,.toolresult,.aboutcopy,.contactinfo').forEach(function (el, i) {
    el.classList.add('rv'); el.style.transitionDelay = (i % 3) * 0.08 + 's';
  });
  var targets = $$('.rv,.gantt');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    targets.forEach(function (t) { io.observe(t); });
  } else targets.forEach(function (t) { t.classList.add('in'); });

  /* estimator */
  var type = $('#estType'), area = $('#estArea'), floors = $('#estFloors'), out = $('#estOut'), sub = $('#estSub'), use = $('#estUse');
  var estText = '';
  function calc() {
    if (!type) return;
    var o = type.options[type.selectedIndex], a = parseFloat(area.value), f = parseInt(floors.value, 10) || 1;
    if (!(a > 0)) { out.textContent = '—'; sub.textContent = 'Enter a floor / footprint area to see an indicative range.'; estText = ''; return; }
    var lo = a * f * +o.dataset.lo / 1000, hi = a * f * +o.dataset.hi / 1000;
    var fmt = function (n) { return n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1); };
    out.textContent = fmt(lo) + ' – ' + fmt(hi) + ' t';
    sub.textContent = 'Based on ' + o.dataset.lo + '–' + o.dataset.hi + ' kg/m² of structural steel for ' + o.value.toLowerCase() + ', ' + a.toLocaleString() + ' m² × ' + f + ' level(s).';
    estText = 'Indicative steel estimate (planning tool): ' + fmt(lo) + '–' + fmt(hi) + ' tonnes — ' + o.value + ', ' + a + ' m² x ' + f + ' level(s).';
  }
  [type, area, floors].forEach(function (el) { if (el) { el.addEventListener('input', calc); el.addEventListener('change', calc); } });
  calc();

  /* estimator -> message prefill */
  if (use) use.addEventListener('click', function () {
    if (!estText) { area.focus(); return; }
    var m = $('#message');
    if (m && !m.value.trim()) m.value = estText + '\n';
    location.hash = '#contact';
    setTimeout(function () { if (m) m.focus({ preventScroll: true }); }, 500);
  });

  /* ---------- enquiry form ---------- */
  var form = $('#quoteform');
  if (form) {
    var btn = $('#enqSubmit'), lbl = $('.lbl', btn), status = $('#formStatus'), busy = false;
    var openedAt = Date.now(), token = '';
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // optional Cloudflare Turnstile (only when a site key is set in <meta name="turnstile-sitekey">)
    var sk = (document.querySelector('meta[name="turnstile-sitekey"]') || {}).content;
    if (sk) {
      var sc = document.createElement('script');
      sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true;
      sc.onload = function () {
        window.turnstile.render('#turnstileBox', { sitekey: sk, callback: function (t) { token = t; }, 'expired-callback': function () { token = ''; } });
      };
      document.head.appendChild(sc);
    }

    function setErr(name, msg) {
      var f = form.elements[name], e = $('.ferr[data-for="' + name + '"]', form);
      if (e) e.textContent = msg || '';
      if (f) { f.classList.toggle('invalid', !!msg); f.setAttribute('aria-invalid', msg ? 'true' : 'false'); }
    }
    function clientCheck() {
      var v = {}, bad = {};
      ['name', 'email', 'phone', 'company', 'message'].forEach(function (k) { v[k] = (form.elements[k].value || '').trim(); });
      var digits = v.phone.replace(/\D/g, '');
      if (v.name.length < 2) bad.name = 'Please enter your full name.';
      if (!v.email) bad.email = 'Please enter your email address.';
      else if (!EMAIL.test(v.email)) bad.email = 'Please enter a valid email address.';
      if (!v.phone) bad.phone = 'Please enter your phone number.';
      else if (!/^\+?[\d\s\-().]+$/.test(v.phone) || digits.length < 8 || digits.length > 15) bad.phone = 'Please enter a valid phone number (8–15 digits).';
      if (v.message.length < 10) bad.message = 'Please enter at least 10 characters in your message.';
      ['name', 'email', 'phone', 'company', 'message'].forEach(function (k) { setErr(k, bad[k]); });
      return { v: v, bad: bad };
    }
    function say(type, msg) {
      status.className = 'formstatus ' + type; status.textContent = msg;
      if (type === 'error') status.setAttribute('role', 'alert'); else status.setAttribute('role', 'status');
    }
    function setBusy(b) {
      busy = b; btn.disabled = b; btn.setAttribute('aria-busy', b ? 'true' : 'false');
      lbl.textContent = b ? 'Sending…' : 'Send Enquiry';
    }
    ['name', 'email', 'phone', 'message'].forEach(function (k) {
      form.elements[k].addEventListener('input', function () { if (this.classList.contains('invalid')) setErr(k, ''); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;                       // block duplicate submissions
      say('', '');
      var r = clientCheck();
      var first = Object.keys(r.bad)[0];
      if (first) { form.elements[first].focus(); say('error', 'Please correct the highlighted fields.'); return; }
      if (sk && !token) { say('error', 'Please complete the spam check and try again.'); return; }

      setBusy(true);
      var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 20000);
      fetch('/api/enquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ name: r.v.name, email: r.v.email, phone: r.v.phone, company: r.v.company, message: r.v.message,
          website: form.elements.hp_url.value, ts: openedAt, token: token })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (d) { return { res: res, d: d }; });
      }).then(function (o) {
        if (o.res.ok && o.d.ok === true) {     // only a confirmed server success resets the form
          form.reset(); openedAt = Date.now();
          ['name', 'email', 'phone', 'company', 'message'].forEach(function (k) { setErr(k, ''); });
          if (sk && window.turnstile) { token = ''; window.turnstile.reset(); }
          say('success', o.d.message || 'Thank you! Your enquiry has been sent.');
        } else {
          if (o.d.fields) Object.keys(o.d.fields).forEach(function (k) { setErr(k, o.d.fields[k]); });
          if (sk && window.turnstile) { token = ''; window.turnstile.reset(); }
          say('error', o.d.error || 'Something went wrong while sending your enquiry. Please try again or contact us directly.');
        }
      }).catch(function (err) {
        say('error', err && err.name === 'AbortError'
          ? 'The request timed out. Please check your connection and try again.'
          : 'We could not reach the server. Please check your connection and try again, or email jayachandar1j@gmail.com.');
      }).then(function () { clearTimeout(timer); setBusy(false); status.focus({ preventScroll: false }); });
    });
  }
})();
