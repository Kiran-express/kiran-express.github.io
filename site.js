{
  const cfg = window.KIRAN_CONFIG || {};
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const T = {
    fr: {
      required: 'Ce champ est obligatoire.',
      email: 'Saisissez une adresse e-mail valide.',
      phone: 'Saisissez un numéro valide (chiffres uniquement).',
      url: 'Saisissez une adresse web complète (https://…).',
      consent: 'Votre accord est nécessaire pour vous recontacter.',
      sending: 'Envoi…',
      ok: 'Merci. Votre demande est bien enregistrée. Notre équipe vous répondra par e-mail ou par téléphone.',
      okInvestor: 'Merci. Notre équipe vous répondra sous 5 jours ouvrés.',
      fail: "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez.",
      limit: 'Vous avez déjà envoyé 3 demandes dans l’heure. Merci de réessayer plus tard.',
      soon: "Les formulaires ouvrent très bientôt. Revenez dans quelques jours : rien n'a été envoyé.",
      menu: 'Menu', close: 'Fermer'
    },
    en: {
      required: 'This field is required.',
      email: 'Enter a valid email address.',
      phone: 'Enter a valid number (digits only).',
      url: 'Enter a full web address (https://…).',
      consent: 'We need your consent to contact you.',
      sending: 'Sending…',
      ok: 'Thank you. Your request has been received. Our team will get back to you by email or phone.',
      okInvestor: 'Thank you. Our team will reply within 5 business days.',
      fail: 'Sending failed. Check your connection and try again.',
      limit: 'You have already sent 3 requests this hour. Please try again later.',
      soon: 'Forms open very soon. Please come back in a few days: nothing was sent.',
      menu: 'Menu', close: 'Close'
    }
  }[lang];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // remember language choice
  document.querySelectorAll('[data-setlang]').forEach(a =>
    a.addEventListener('click', () => store.set('kx-lang', a.dataset.setlang)));

  // mobile menu
  const btn = document.querySelector('.menu-btn');
  const panel = document.getElementById('mobile-menu');
  if (btn && panel) {
    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? T.close : T.menu);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      panel.classList.remove('open'); document.body.style.overflow = '';
      btn.setAttribute('aria-expanded', 'false');
    }));
  }

  // close desktop dropdown on outside click / Escape
  const dd = document.querySelector('nav.main details');
  if (dd) {
    document.addEventListener('click', e => { if (!dd.contains(e.target)) dd.removeAttribute('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') dd.removeAttribute('open'); });
  }

  // reveal on scroll
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => revealObserver.observe(el));
  } else {
    items.forEach(el => el.classList.add('in'));
  }

  // UTM capture
  const params = new URLSearchParams(location.search);
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach(k => {
    if (params.get(k)) store.set('kx-' + k, params.get(k));
  });

  // forms
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function setErr(field, msg) {
    field.classList.toggle('invalid', !!msg);
    const e = field.querySelector('.err');
    if (e) e.textContent = msg || '';
  }
  function validate(form) {
    let first = null;
    form.querySelectorAll('.field').forEach(f => {
      const el = f.querySelector('input,select,textarea');
      if (!el) return;
      let msg = '';
      const v = (el.type === 'checkbox') ? el.checked : el.value.trim();
      if (el.required && !v) msg = el.type === 'checkbox' ? T.consent : T.required;
      else if (v && el.type === 'email' && !emailRe.test(v)) msg = T.email;
      else if (v && el.dataset.kind === 'phone' && !/^[0-9 ]{6,15}$/.test(v)) msg = T.phone;
      else if (v && el.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) msg = T.url;
      setErr(f, msg);
      if (msg && !first) first = el;
    });
    if (first) first.focus();
    return !first;
  }
  function rateOk() {
    const now = Date.now();
    let list = [];
    try { list = JSON.parse(store.get('kx-sends') || '[]').filter(t => now - t < 3600000); } catch (e) {}
    return list;
  }

  document.querySelectorAll('form.lead-form').forEach(form => {
    const msg = form.querySelector('.form-msg');
    const show = (cls, text) => { msg.className = 'form-msg ' + cls; msg.textContent = text; msg.setAttribute('tabindex', '-1'); msg.focus(); };
    form.querySelectorAll('input,select,textarea').forEach(el =>
      el.addEventListener('input', () => { const f = el.closest('.field'); if (f && f.classList.contains('invalid')) setErr(f, ''); }));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (form.querySelector('.hp input').value) return; // honeypot
      if (!validate(form)) return;
      const sends = rateOk();
      if (sends.length >= 3) { show('err', T.limit); return; }
      if (!cfg.formEndpoint) { show('info', T.soon); return; }

      const data = new FormData(form);
      data.delete('website');
      const cc = data.get('phone_country'), ph = data.get('phone');
      if (ph) { data.set('phone_e164', (cc || '+234') + ph.replace(/\D/g, '').replace(/^0+/, '')); }
      data.set('language', lang);
      data.set('page', location.pathname);
      data.set('submitted_at', new Date().toISOString());
      data.set('consent_text_version', 'v1-2026-11-24');
      ['utm_source', 'utm_medium', 'utm_campaign'].forEach(k => { const v = store.get('kx-' + k); if (v) data.set(k, v); });

      const b = form.querySelector('button[type=submit]');
      const label = b.textContent; b.disabled = true; b.textContent = T.sending;
      try {
        const r = await fetch(cfg.formEndpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error('status ' + r.status);
        sends.push(Date.now()); store.set('kx-sends', JSON.stringify(sends));
        form.reset();
        show('ok', form.dataset.form === 'investor' ? T.okInvestor : T.ok);
      } catch (err) {
        show('err', T.fail);
      } finally {
        b.disabled = false; b.textContent = label;
      }
    });
  });

  // tracking placeholder
  const tf = document.getElementById('track-form');
  if (tf) tf.addEventListener('submit', e => {
    e.preventDefault();
    const out = document.getElementById('track-out');
    out.className = 'form-msg info';
    out.textContent = lang === 'fr'
      ? "Le suivi des colis ouvrira au lancement de l'application. Inscrivez-vous sur la liste d'attente pour être prévenu."
      : 'Parcel tracking opens when the app launches. Join the waitlist to be notified.';
  });
}
