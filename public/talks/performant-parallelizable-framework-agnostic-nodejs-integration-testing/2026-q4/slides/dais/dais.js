/*!
 * dais.js — OPTIONAL progressive enhancement for Dais decks.
 *
 * The deck is fully usable without this file (scroll, swipe, scrollbar,
 * native keyboard scrolling, pure-CSS buttons/dots/toggles). This script
 * only adds presenter conveniences:
 *
 *   - Arrow / Space / PageUp / PageDown / Home / End navigation from
 *     anywhere on the page (no need to focus the scroller first)
 *   - "o" toggles overview mode, "s" toggles speaker notes,
 *     Escape exits overview
 *   - Click a slide in overview mode to jump to it
 *   - URL hash sync while scrolling, so reloads and shared links resume
 *     on the current slide
 *   - Fills any <output class="dais-counter"> with "n / N"
 *   - Drives any <output class="dais-timer"> as a presenter clock: it starts
 *     when you first advance past the opening slide, "t" pauses/resumes, and
 *     data-dais-limit="30" turns it amber at 80% of 30 minutes, red at 100%
 *
 * No dependencies. Include with:
 *   <script src="dais.js" defer></script>
 */
(() => {
  "use strict";

  const deck = document.querySelector(".dais");
  if (!deck) return;

  const slides = [...deck.querySelectorAll(":scope > section")];
  if (slides.length === 0) return;

  // Marks that the enhancement script is live. dais.css gates step hiding on
  // this class, so a no-JS deck shows every step (its composed final state).
  deck.classList.add("dais-js");

  // Ensure every slide has an id so hash sync and deep links work.
  slides.forEach((slide, i) => {
    if (!slide.id) slide.id = `slide-${i + 1}`;
  });

  const counter = document.querySelector(".dais-counter");
  const timer = document.querySelector(".dais-timer");
  const overviewToggle = document.querySelector(".dais-overview-toggle");
  const notesToggle = document.querySelector(".dais-notes-toggle");
  const inOverview = () => Boolean(overviewToggle && overviewToggle.checked);

  const currentIndex = () => {
    // The slide whose center is nearest the scrollport center.
    const mid = deck.scrollLeft + deck.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((slide, i) => {
      const dist = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const goTo = (i) => {
    const slide = slides[Math.max(0, Math.min(slides.length - 1, i))];
    slide.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  // --- Steps (fragments) ----------------------------------------------------
  // A slide is "stepped" when it holds .step / [data-step] elements, or
  // declares data-dais-steps="N". Right/Space advances one step before moving
  // to the next section; Left reverses. Each step element has an integer order
  // (explicit data-step, else its position among the step elements); advancing
  // toggles .step-active (order <= current) and .step-current (order ==
  // current), and .step also hides until active (dais.css). Current step lives
  // on the section as --dais-step / [data-dais-step]; 0 means nothing active.
  const stepData = new Map();

  const stepItems = (root) =>
    [...root.querySelectorAll(".step, [data-step]")].map((el, i) => {
      const explicit = Number(el.dataset.step);
      const order = Number.isFinite(explicit) && explicit > 0 ? explicit : i + 1;
      return { el, order };
    });

  const setStepClasses = (items, cur) => {
    items.forEach(({ el, order }) => {
      el.classList.toggle("step-active", order <= cur);
      el.classList.toggle("step-current", order === cur);
    });
  };

  const applyStep = (section, cur) => {
    const data = stepData.get(section);
    if (!data) return;
    data.cur = cur;
    section.style.setProperty("--dais-step", cur);
    section.dataset.daisStep = cur;
    setStepClasses(data.items, cur);
  };

  slides.forEach((section) => {
    const items = stepItems(section);
    const declared = Number(section.dataset.daisSteps);
    const n = Math.max(declared > 0 ? declared : 0, ...items.map((it) => it.order), 0);
    if (n > 0) {
      stepData.set(section, { n, cur: 0, items });
      applyStep(section, 0);
    }
  });

  // --- Print & overview expansion -------------------------------------------
  // A stepped slide is a single <section>, so print and overview would show
  // only its composed final state. Before printing, and while overview is open,
  // insert one frozen clone per step so each sub-step becomes its own page /
  // thumbnail; the source is hidden (dais.css) and restored on collapse.
  let expanded = false;

  const freezeClone = (clone, cur) => {
    clone.style.setProperty("--dais-step", cur);
    clone.dataset.daisStep = cur;
    setStepClasses(stepItems(clone), cur);
  };

  const expandSteps = () => {
    if (expanded) return;
    expanded = true;
    slides.forEach((section) => {
      const data = stepData.get(section);
      if (!data) return;
      const frag = document.createDocumentFragment();
      for (let k = 1; k <= data.n; k++) {
        const clone = section.cloneNode(true);
        // Strip descendant ids to avoid collisions, but KEEP the section's own
        // id: deck step styling is scoped by slide id (e.g. `#results tr.step-
        // current`), so a clone must carry it to render. The source stays first
        // in DOM order, so getElementById() still resolves to it. Clones live
        // only while expanded (overview/print) and are removed on collapse.
        clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
        clone.dataset.cloneOf = section.id;
        clone.classList.add("dais-clone");
        freezeClone(clone, k);
        frag.appendChild(clone);
      }
      section.classList.add("dais-step-source");
      section.after(frag);
    });
  };

  const collapseSteps = () => {
    if (!expanded) return;
    expanded = false;
    deck.querySelectorAll(":scope > .dais-clone").forEach((c) => c.remove());
    slides.forEach((s) => s.classList.remove("dais-step-source"));
  };

  const setOverview = (on) => {
    if (!overviewToggle) return;
    overviewToggle.checked = on;
    if (on) expandSteps();
    else collapseSteps();
  };

  const updateCounter = () => {
    if (counter) counter.textContent = `${currentIndex() + 1} / ${slides.length}`;
  };

  // --- Presenter timer ------------------------------------------------------
  // Elapsed talk time. Accumulates in `banked` while paused so pause/resume
  // doesn't lose the clock. A reload starts over, by design.
  const limitMs = Number(timer?.dataset.daisLimit) > 0
    ? Number(timer.dataset.daisLimit) * 60_000
    : 0;
  let banked = 0;
  let startedAt = 0;
  let ticking = false;

  const drawTimer = () => {
    const ms = banked + (ticking ? performance.now() - startedAt : 0);
    const secs = Math.floor(ms / 1000);
    timer.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    timer.classList.toggle("is-over", limitMs > 0 && ms >= limitMs);
    timer.classList.toggle("is-warn", limitMs > 0 && ms >= limitMs * 0.8 && ms < limitMs);
  };

  const runTimer = (on) => {
    if (!timer || on === ticking) return;
    if (on) startedAt = performance.now();
    else banked += performance.now() - startedAt;
    ticking = on;
    drawTimer();
  };

  if (timer) {
    drawTimer();
    setInterval(drawTimer, 250);
    timer.addEventListener("click", () => runTimer(!ticking));
  }

  // Reset a slide's steps when it becomes active. Forward entry (or a manual
  // scroll/jump) opens at step 0; stepping back into a slide opens it fully
  // revealed (enterAtEnd), matching the direction you arrived from.
  let lastActive = -1;
  let enterAtEnd = -1;

  const sync = () => {
    const i = currentIndex();
    updateCounter();
    if (i !== lastActive) {
      const data = stepData.get(slides[i]);
      if (data) {
        const target = enterAtEnd === i ? data.n : 0;
        if (data.cur !== target) applyStep(slides[i], target);
      }
      enterAtEnd = -1;
      lastActive = i;
    }
    // Leaving the opening slide is the presenter starting the talk.
    if (timer && !ticking && banked === 0 && i > 0) runTimer(true);
    // Update the hash without adding history entries or re-scrolling.
    history.replaceState(null, "", `#${slides[i].id}`);
  };

  // "scrollend" fires once snapping settles; fall back to debounced "scroll".
  if ("onscrollend" in window) {
    deck.addEventListener("scrollend", sync);
  } else {
    let t;
    deck.addEventListener("scroll", () => {
      clearTimeout(t);
      t = setTimeout(sync, 120);
    }, { passive: true });
  }

  // On load: honor an incoming deep link ourselves (the browser's own
  // scroll-to-fragment can race with deferred scripts), and only update the
  // counter — writing the hash here would clobber the deep link.
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target && slides.includes(target)) {
    target.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }
  updateCounter();

  document.addEventListener("keydown", (event) => {
    // Never steal keys from form fields or editable content.
    if (event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]")) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
        if (!inOverview()) {
          event.preventDefault();
          const i = currentIndex();
          const data = stepData.get(slides[i]);
          if (data && data.cur < data.n) applyStep(slides[i], data.cur + 1);
          else goTo(i + 1);
        }
        break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        if (!inOverview()) {
          event.preventDefault();
          const i = currentIndex();
          const data = stepData.get(slides[i]);
          if (data && data.cur > 0) {
            applyStep(slides[i], data.cur - 1);
          } else {
            // Ask the previous slide to open fully revealed.
            if (i > 0 && stepData.has(slides[i - 1])) enterAtEnd = i - 1;
            goTo(i - 1);
          }
        }
        break;
      case "Home":
        event.preventDefault();
        goTo(0);
        break;
      case "End":
        event.preventDefault();
        goTo(slides.length - 1);
        break;
      case "o":
        setOverview(!inOverview());
        break;
      case "s":
        if (notesToggle) notesToggle.checked = !notesToggle.checked;
        break;
      case "t":
        runTimer(!ticking);
        break;
      case "Escape":
        setOverview(false);
        break;
    }
  });

  // Direct clicks on the overview checkbox fire "change"; a programmatic
  // setOverview() does not, so both paths keep the clones in sync.
  if (overviewToggle) {
    overviewToggle.addEventListener("change", () => {
      if (overviewToggle.checked) expandSteps();
      else collapseSteps();
    });
  }

  // Expand for print, collapse afterward.
  window.addEventListener("beforeprint", expandSteps);
  window.addEventListener("afterprint", collapseSteps);

  // In overview mode, clicking a slide (or a step clone) exits the grid and
  // jumps to the underlying section.
  deck.addEventListener("click", (event) => {
    if (!inOverview()) return;
    const el = event.target.closest(".dais > section");
    if (!el) return;
    const target = el.classList.contains("dais-clone")
      ? document.getElementById(el.dataset.cloneOf)
      : el;
    setOverview(false); // collapses the clones
    if (!target) return;
    // Wait a frame for the layout to switch back before scrolling.
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
      sync();
    });
  });
})();
