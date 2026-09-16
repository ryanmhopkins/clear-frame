/* transitions.dev recipe orchestration, adapted for ClearFrame. Sources: MOTION.md. */
(function () {
  const bar = document.querySelector('.t-tabs');
  const pill = bar.querySelector('.t-tabs-pill');
  let positioned = false;
  function moveTab(animate = true) {
    const tab = bar.querySelector('[aria-selected="true"]');
    if (!tab || !bar.offsetWidth) { positioned = false; return; }
    const previous = pill.style.transition;
    if (!animate || !positioned) pill.style.transition = 'none';
    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
    pill.style.width = `${tab.offsetWidth}px`;
    if (!animate || !positioned) { void pill.offsetWidth; pill.style.transition = previous; }
    positioned = true;
  }
  window.addEventListener('resize', () => moveTab(false));
  if (window.ResizeObserver) new ResizeObserver(() => moveTab(false)).observe(bar);
  if (document.fonts?.ready) document.fonts.ready.then(() => moveTab(false));

  // Enhance native disclosures: without JS, the original <details> still works.
  document.querySelectorAll('.faq > details, .optional-panel, .photo-inspector').forEach((details, index) => {
    const summary = details.querySelector(':scope > summary');
    const item = document.createElement('div');
    item.className = details.className + ' t-acc';
    const head = document.createElement('button');
    head.type = 'button'; head.className = summary.className + ' t-acc-head';
    head.innerHTML = summary.innerHTML;
    head.querySelectorAll('h3').forEach(heading => {
      const title = document.createElement('span'); title.className = 'accordion-title';
      title.textContent = heading.textContent; heading.replaceWith(title);
    });
    const chevron = document.createElement('span'); chevron.className = 't-acc-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 6L8 10L12 6"/></svg>';
    head.append(chevron);
    const panel = document.createElement('div'); panel.className = 't-acc-panel'; panel.id = `disclosure-${index}`;
    const inner = document.createElement('div'); inner.className = 't-acc-panel-inner';
    for (const child of [...details.childNodes]) if (child !== summary) inner.append(child);
    panel.append(inner); item.append(head, panel);
    head.setAttribute('aria-controls', panel.id);
    function setOpen(open) {
      item.dataset.open = String(open); head.setAttribute('aria-expanded', String(open));
      panel.inert = !open; panel.setAttribute('aria-hidden', String(!open));
    }
    setOpen(details.open);
    head.addEventListener('click', () => setOpen(item.dataset.open !== 'true'));
    details.replaceWith(item);
  });
  window.ClearFrameMotion = {moveTab};
})();
