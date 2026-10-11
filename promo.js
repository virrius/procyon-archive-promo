(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // картинки берутся рядом со скриптом: страница может лежать уровнем ниже (ru/)
  const ROOT = document.currentScript.src.replace(/[^/]*$/, '');
  const L = document.documentElement.lang === 'ru' ? 1 : 0;

  // подсветка раздела в боковом меню
  const nav = $('#nav'), links = $$('a', nav);
  const mark = id => {
    const a = links.find(l => l.hash === '#' + id);
    links.forEach(l => l.classList.toggle('on', l === a));
    if (a && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - nav.offsetLeft - 16, behavior: 'smooth' });
  };
  const spy = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && mark(e.target.id)),
    { rootMargin: '-30% 0px -60% 0px' });
  $$('section[id]').forEach(s => spy.observe(s));

  // шкала прочитанного
  const progress = $('.progress');
  const onScroll = () => {
    const d = document.documentElement;
    progress.style.setProperty('--p', (d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight)).toFixed(4));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // заголовок «расшифровывается» из случайных знаков
  const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%/<>+=*';
  const CYRILLIC = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789#%/<>+=*';
  const scramble = el => {
    if (still) return;
    const text = el.textContent, n = text.length, t0 = performance.now(), dur = 520 + n * 22;
    const GLYPHS = /[а-яё]/i.test(text) ? CYRILLIC : LATIN;
    el.style.minHeight = el.offsetHeight + 'px';
    const step = now => {
      const p = Math.min((now - t0) / dur, 1), k = Math.floor(p * n);
      let out = text.slice(0, k);
      for (let i = k; i < n; i++) out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = p < 1 ? out : text;
      if (p < 1) requestAnimationFrame(step); else el.style.minHeight = '';
    };
    requestAnimationFrame(step);
  };
  $$('[data-scramble]').forEach(scramble);

  // разделы проявляются при прокрутке
  const shown = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    shown.unobserve(e.target);
    const h = e.target.matches('.head') && $('h2', e.target);
    if (h) scramble(h);
  }), { rootMargin: '0px 0px -3% 0px', threshold: 0.02 });
  $$('.content > section > *, .band, .band-note').forEach(el => { el.classList.add('reveal'); shown.observe(el); });

  // плывущие ряды навстречу: вторая копия для бесшовного круга; зажатой кнопкой или пальцем тянется, отпущенный докатывается
  const SPEED = still ? 0 : 34;
  const ribbon = float => {
    const track = $('.track', float), dir = +float.dataset.dir || 1;
    [...track.children].forEach(i => { const c = i.cloneNode(); c.setAttribute('aria-hidden', 'true'); track.append(c); });
    let x = dir < 0 ? -420 : 0, half = 0, last = 0, hover = false, fling = 0, pull = null, dragged = false;
    new ResizeObserver(() => { half = track.scrollWidth / 2; }).observe(track);
    const frame = t => {
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
      last = t;
      if (!pull) {
        if (Math.abs(fling) > 8) { x += fling * dt; fling *= Math.pow(0.03, dt); }
        else { fling = 0; if (!hover) x -= dir * SPEED * dt; }
      }
      if (half) x = -((((-x) % half) + half) % half);
      track.style.transform = `translateX(${x}px)`;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    float.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    float.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hover = false; });
    float.addEventListener('dragstart', e => e.preventDefault());
    float.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      dragged = false; fling = 0;
      pull = { id: e.pointerId, x0: e.clientX, from: x, lx: e.clientX, lt: e.timeStamp, v: 0 };
    });
    float.addEventListener('pointermove', e => {
      if (!pull || e.pointerId !== pull.id) return;
      const dx = e.clientX - pull.x0;
      if (!dragged && Math.abs(dx) > 5) { dragged = true; float.classList.add('drag'); float.setPointerCapture(e.pointerId); }
      if (!dragged) return;
      const dt = e.timeStamp - pull.lt;
      if (dt > 0) { pull.v = 0.7 * pull.v + 0.3 * (e.clientX - pull.lx) / dt * 1000; pull.lx = e.clientX; pull.lt = e.timeStamp; }
      x = pull.from + dx;
    });
    const release = e => {
      if (!pull || e.pointerId !== pull.id) return;
      if (dragged) fling = e.timeStamp - pull.lt < 80 ? pull.v : 0;
      pull = null; float.classList.remove('drag');
    };
    float.addEventListener('pointerup', release);
    float.addEventListener('pointercancel', release);
    // после протяжки клик картинку не открывает
    float.addEventListener('click', e => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  };
  $$('.float').forEach(ribbon);

  // протяжка мышью для окон с прокруткой; клик после протяжки гасится, без протяжки — проходит
  const panify = (el, active = () => true) => {
    let pan = null, moved = false, swallow = false;
    el.addEventListener('dragstart', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !active()) return;
      pan = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop }; moved = false;
    });
    addEventListener('pointermove', e => {
      if (!pan) return;
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!moved && Math.hypot(dx, dy) > 5) { moved = true; el.classList.add('drag'); }
      if (moved) { el.scrollLeft = pan.l - dx; el.scrollTop = pan.t - dy; }
    });
    addEventListener('pointerup', () => {
      if (!pan) return;
      if (moved) { swallow = true; setTimeout(() => { swallow = false; }); }
      pan = null; el.classList.remove('drag');
    });
    el.addEventListener('click', e => { if (swallow) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  };

  // панорама доски: стартует со сводки (data-start — доля ширины), подсказка гаснет после первой прокрутки руками
  const startPano = root => $$('.pano[data-start]', root).forEach(p => {
    if (p.dataset.started || !p.scrollWidth) return;
    p.scrollLeft = p.scrollWidth * +p.dataset.start;
    p.dataset.started = '1';
  });
  $$('.pano').forEach(p => {
    panify(p);
    const moved = () => p.closest('.pano-fig').classList.add('moved');
    for (const ev of ['pointerdown', 'wheel', 'touchstart']) p.addEventListener(ev, moved, { once: true, passive: true });
  });

  // вьюер: вкладки слева, кадр справа, деления над кадром заполняются по мере листания.
  // data-mode="snap" — лента кадров со свайпом; иначе панели сменяются с фейдом, чтобы не спорить со вложенными скроллами
  const pad = n => String(n).padStart(2, '0');
  $$('.viewer').forEach(v => {
    const slides = $('.slides', v), panes = [...slides.children], tabs = $$('.tabs button', v);
    const ticks = $('.ticks', v), count = $('.count', v), snap = v.dataset.mode === 'snap', total = panes.length;
    panes.forEach(() => ticks.append(document.createElement('i')));
    let k = 0;
    const paint = () => {
      count.textContent = `${pad(k + 1)} / ${pad(total)}`;
      tabs.forEach((b, i) => { b.classList.toggle('on', i === k); b.setAttribute('aria-selected', i === k); });
      [...ticks.children].forEach((t, i) => t.classList.toggle('on', i <= k));
    };
    const go = i => {
      i = (i + total) % total;
      if (snap) { slides.scrollTo({ left: i * slides.clientWidth }); return; }
      k = i;
      panes.forEach((p, j) => p.classList.toggle('on', j === k));
      startPano(panes[k]);
      paint();
    };
    tabs.forEach((b, i) => b.addEventListener('click', () => go(i)));
    $$('[data-step]', v).forEach(b => b.addEventListener('click', () => go(k + +b.dataset.step)));
    if (snap) {
      slides.addEventListener('scroll', () => { k = Math.round(slides.scrollLeft / slides.clientWidth); paint(); }, { passive: true });
      paint();
    } else go(0);
  });

  // образы фракций: одни и те же трое в разной одежде; подписи [en, ru]
  const LOOKS = [
    ['guild_light', ['Guild — light', 'Гильдия — светлая'], [
      'long tailored coat of pearl-white technical fabric with a high stand collar and hidden seams; pale grey fitted trousers; white gloves; slim gold guild sigil pin at the collar; polished pale grey boots',
      'длинное приталенное пальто из жемчужно-белой технической ткани с высоким воротником-стойкой и скрытыми швами; узкие светло-серые брюки; белые перчатки; тонкий золотой значок гильдии на воротнике; начищенные светло-серые сапоги']],
    ['guild_dark', ['Guild — dark', 'Гильдия — тёмная'], [
      'long tailored coat of matte charcoal technical fabric with a high stand collar and hidden seams; black fitted trousers; black gloves; slim silver guild sigil pin at the collar; polished black boots',
      'длинное приталенное пальто из матовой угольно-серой технической ткани с высоким воротником-стойкой и скрытыми швами; узкие чёрные брюки; чёрные перчатки; тонкий серебряный значок гильдии на воротнике; начищенные чёрные сапоги']],
    ['operative', ['Operatives', 'Оперативники'], [
      'fitted dark grey tactical jacket with armoured shoulder panels; black high-collar undersuit; utility harness across the chest; cargo trousers with knee plates; soft-soled black boots; fingerless gloves',
      'приталенная тёмно-серая тактическая куртка с бронепластинами на плечах; чёрный облегающий комбинезон с высоким воротом; разгрузка на груди; брюки-карго с наколенниками; чёрные ботинки на мягкой подошве; перчатки без пальцев']],
    ['soldier', ['Soldiers', 'Солдаты'], [
      'matte black powered armour of smooth angular plates with sealed joints; high armoured collar; thin glowing crimson rank strip across the left shoulder plate; integrated display panel on the left forearm; heavy magnetic boots',
      'матовая чёрная силовая броня из гладких угловатых пластин с герметичными сочленениями; высокий бронированный воротник; тонкая светящаяся алая полоска звания на левом наплечнике; встроенный дисплей на левом предплечье; тяжёлые магнитные ботинки']],
    ['aristocrat', ['Aristocrats', 'Аристократы'], [
      'asymmetric long coat of iridescent plum smart-fabric with angular shoulder plates of polished white ceramic; high collar with a translucent visor band; luminous filament embroidery in circuit-like patterns; fitted pale grey undersuit',
      'асимметричное длинное пальто из переливчатой сливовой смарт-ткани с угловатыми наплечниками из полированной белой керамики; высокий воротник с полупрозрачной полосой-визором; светящаяся вышивка нитью узором микросхемы; облегающий светло-серый комбинезон']],
    ['scavenger', ['Scavengers', 'Старьёвщики'], [
      'patched long duster of mismatched canvas and plastic sheeting; scarf wrapped over the lower face; welding goggles pushed up on the forehead; cracked salvaged chest plate over layered rags; heavy boots wrapped in tape',
      'латаный длинный плащ из разномастного брезента и плёнки; шарф, намотанный на нижнюю часть лица; сварочные очки, сдвинутые на лоб; треснувшая подобранная нагрудная пластина поверх слоёв тряпья; тяжёлые ботинки, обмотанные изолентой']],
  ];
  const WHO = [
    ['A man in his forties, scarred', 'Мужчина за сорок со шрамами'],
    ['A young woman', 'Молодая женщина'],
    ['An elderly tortoise-kin xenos', 'Пожилой ксенос из черепахоподобных'],
  ];
  const lookTabs = $('#look-tabs'), lookLine = $('#look-line');
  const lookImgs = WHO.map(w => {
    const i = new Image();
    i.alt = w[L]; i.loading = 'lazy'; i.dataset.zoom = '';
    $('#look-trio').append(i);
    return i;
  });
  const wear = k => {
    const [key, , text] = LOOKS[k];
    $$('button', lookTabs).forEach((b, n) => { b.classList.toggle('on', n === k); b.setAttribute('aria-selected', n === k); });
    lookImgs.forEach((i, n) => {
      const src = `${ROOT}art/look_${key}_${'abc'[n]}.webp`;
      if (!i.getAttribute('src')) { i.src = src; return; }
      i.classList.add('fade');
      const pre = new Image();
      pre.onload = () => { i.src = src; i.classList.remove('fade'); };
      pre.src = src;
    });
    lookLine.textContent = text[L];
  };
  LOOKS.forEach(([, title], k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = title[L];
    b.addEventListener('click', () => wear(k));
    lookTabs.append(b);
  });
  wear(0);

  // просмотр крупно: листает картинки своего раздела; data-zoom="full" — в натуральную величину
  const lb = $('#lb'), lbImg = $('img', lb);
  let items = [], at = 0;
  const show = k => { at = (k + items.length) % items.length; lbImg.src = items[at]; };
  const close = () => { lb.classList.remove('on', 'full'); lbImg.removeAttribute('src'); document.body.style.overflow = ''; };
  panify(lb, () => lb.classList.contains('full'));
  document.addEventListener('click', e => {
    const pic = e.target.closest('[data-zoom]');
    if (!pic || lb.contains(pic)) return;
    const full = pic.dataset.zoom === 'full';
    const scope = full ? pic.parentNode : pic.closest('section, .band') || document;
    items = [...new Set($$('[data-zoom]', scope).map(i => i.currentSrc || i.src))];
    show(items.indexOf(pic.currentSrc || pic.src));
    lb.classList.toggle('full', full);
    lb.scrollTo(0, 0);
    lb.classList.add('on');
    document.body.style.overflow = 'hidden';
  });
  $('.x', lb).addEventListener('click', close);
  $('.pv', lb).addEventListener('click', e => { e.stopPropagation(); show(at - 1); });
  $('.nx', lb).addEventListener('click', e => { e.stopPropagation(); show(at + 1); });
  lb.addEventListener('click', e => { if (e.target === lb || e.target === lbImg) close(); });
  addEventListener('keydown', e => {
    if (!lb.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(at - 1);
    if (e.key === 'ArrowRight') show(at + 1);
  });
})();
