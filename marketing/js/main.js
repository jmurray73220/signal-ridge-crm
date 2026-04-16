// Signal Ridge Strategies — marketing site JS

(function () {
  'use strict';

  // ─── Year in footer ────────────────────────────────────────────────
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  // ─── Mobile nav toggle ────────────────────────────────────────────
  var toggle = document.querySelector('[data-nav-toggle]');
  var menu = document.querySelector('[data-nav-menu]');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close menu when a link is clicked (mobile)
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ─── Smooth scroll for on-page anchors ────────────────────────────
  document.querySelectorAll('a[data-scroll]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('#') !== 0) return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', href);
    });
  });

  // ─── Contact form submit ──────────────────────────────────────────
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    var status = form.querySelector('[data-form-status]');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        message: form.message.value.trim(),
      };

      if (!data.name || !data.email || !data.message) {
        if (status) {
          status.textContent = 'Please fill in your name, email, and a message.';
          status.className = 'form-status error';
        }
        return;
      }

      if (status) {
        status.textContent = 'Sending…';
        status.className = 'form-status';
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        var res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!res.ok) throw new Error('Request failed with status ' + res.status);

        if (status) {
          status.textContent = "Thanks for reaching out. We'll be in touch.";
          status.className = 'form-status success';
        }
        form.reset();
      } catch (err) {
        if (status) {
          status.textContent = 'Something went wrong. Please email jon@signalridgestrategies.com directly.';
          status.className = 'form-status error';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
})();
