/* ============================================================
   ForgeMaster — скрипти промо-сторінки

   Без залежностей і без збірки: файл кладеться поруч і працює.

   Про безпеку. Тут ніде немає innerHTML, insertAdjacentHTML,
   eval чи new Function — увесь текст ставиться через textContent,
   а вузли створюються через createElement. Тому сторінка живе
   під суворим CSP без 'unsafe-inline', і навіть якщо в підпис
   слайда колись потрапить чужий рядок, він лишиться текстом,
   а не розміткою.
   ============================================================ */

'use strict';

(function () {

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── Скріншоти, яких ще немає ─────────────────────────────
     Поки в assets/shots/ порожньо, кожен <img> впаде з помилкою.
     Замість поламаної іконки показуємо підпис у рамці телефона —
     розмітка й розміри лишаються ті самі, тож нічого не стрибає. */

  function markEmpty(img) {
    var screen = img.closest('.phone-screen');
    if (!screen) return;

    screen.classList.add('is-empty');
    screen.setAttribute('data-empty', 'Скріншот\n' + (img.dataset.shot || ''));
    img.remove();
  }

  Array.prototype.forEach.call(
    document.querySelectorAll('.phone-screen img'),
    function (img) {
      img.addEventListener('error', function () { markEmpty(img); });
      // Картинка могла не дійти ще до того, як навісився обробник
      if (img.complete && img.naturalWidth === 0) markEmpty(img);
    }
  );

  /* ── Карусель екранів ─────────────────────────────────────
     Прокрутка лишається рідна (свайп і колесо працюють самі),
     а кнопки й точки лише керують нею. Автопрокрутки навмисно
     немає: вона заважає читати підписи й потребує паузи на
     наведення, фокус і reduced-motion. */

  var carousel = document.querySelector('[data-carousel]');

  if (carousel) {
    var track  = carousel.querySelector('[data-track]');
    var slides = Array.prototype.slice.call(carousel.querySelectorAll('[data-slide]'));
    var dotsBox = carousel.querySelector('[data-dots]');
    var prevBtn = carousel.querySelector('[data-prev]');
    var nextBtn = carousel.querySelector('[data-next]');
    var current = 0;

    /* Точки будуються з самих слайдів — підпис береться з <h3>,
       щоб мітка для читача екрана не розходилася з видимим текстом. */
    var dots = slides.map(function (slide, i) {
      var heading = slide.querySelector('h3');
      var label = heading ? heading.textContent.trim() : 'Екран ' + (i + 1);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', label);
      dot.setAttribute('aria-controls', slide.id);
      dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');

      dot.addEventListener('click', function () { goTo(i); });
      dotsBox.appendChild(dot);
      return dot;
    });

    function setCurrent(i) {
      current = i;
      dots.forEach(function (dot, k) {
        dot.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
      if (prevBtn) prevBtn.disabled = (i === 0);
      if (nextBtn) nextBtn.disabled = (i === slides.length - 1);
    }

    function goTo(i) {
      i = Math.max(0, Math.min(i, slides.length - 1));
      var slide = slides[i];

      track.scrollTo({
        left: slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2,
        behavior: reduceMotion.matches ? 'auto' : 'smooth'
      });
      setCurrent(i);
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });

    /* Стрілками теж — але тільки коли фокус усередині каруселі,
       інакше ми б відібрали стрілки в усієї сторінки. */
    carousel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
    });

    /* Свайп пальцем оминає goTo, тож активний слайд визначаємо
       спостерігачем — так точки не брешуть після ручної прокрутки. */
    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setCurrent(slides.indexOf(entry.target));
          }
        });
      }, { root: track, threshold: [0.6] });

      slides.forEach(function (slide) { spy.observe(slide); });
    }

    setCurrent(0);
  }

  /* ── Поява блоків при прокрутці ───────────────────────────
     Рух тут декоративний, тому при reduced-motion нічого не
     ховаємо взагалі — інакше людина з вимкненою анімацією
     ризикує лишитись перед порожнім екраном. */

  var revealables = document.querySelectorAll('.loop-step, .card, .shot, .get-inner');

  if (!reduceMotion.matches && 'IntersectionObserver' in window) {
    Array.prototype.forEach.call(revealables, function (el) {
      el.classList.add('reveal');
    });

    var reveal = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);        // показали — більше не стежимо
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    Array.prototype.forEach.call(revealables, function (el) { reveal.observe(el); });
  }

  /* ── Плавний перехід до якоря з поправкою на липку шапку ── */

  var head = document.querySelector('.site-head');

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;

    var id = link.getAttribute('href');
    if (id === '#' || id.length < 2) return;

    var target = document.querySelector(id);
    if (!target) return;

    e.preventDefault();

    var offset = head ? head.offsetHeight + 12 : 0;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({ top: top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });

    /* Прокрутка сама по собі не переносить фокус — для клавіатури
       й читача екрана переносимо руками, інакше Tab поїде далі
       зі старого місця. */
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

})();
