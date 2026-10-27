(() => {
  'use strict';

  const mounted = new WeakSet();
  const endpoint = '/api/tool-ratings';

  const placeholder = (toolId, mode = 'workspace') => `
    <section class="tool-rating" data-tool-rating data-tool-id="${String(toolId).replace(/[^a-z0-9-]/g, '')}" data-rating-mode="${mode}" aria-label="Rate this tool" hidden></section>`;

  const starsText = average => average === null ? 'No ratings yet' : `${average.toFixed(1)} out of 5`;

  function updateStructuredData(toolId, aggregate) {
    const count = Number(aggregate?.count) || 0;
    if (!count) return;
    const node = document.getElementById('gxa-structured-data');
    if (!node) return;
    try {
      const data = JSON.parse(node.textContent);
      const graph = Array.isArray(data?.['@graph']) ? data['@graph'] : [];
      const application = graph.find(item => ['WebApplication', 'SoftwareApplication'].includes(item?.['@type']));
      if (!application || !String(application.url || '').includes(`/${toolId}/`)) return;
      application.aggregateRating = {
        '@type': 'AggregateRating', ratingValue: Number(aggregate.average).toFixed(2),
        ratingCount: count, bestRating: 5, worstRating: 1
      };
      node.textContent = JSON.stringify(data);
    } catch { /* Static JSON-LD validation remains part of the SEO contract. */ }
  }

  async function request(url, options) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options?.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options
    });
    let body = {};
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) {
      const error = new Error(body.message || 'Ratings are temporarily unavailable.');
      error.status = response.status;
      error.available = body.available;
      throw error;
    }
    return body;
  }

  function renderAggregate(root, aggregate) {
    const average = aggregate?.average === null || aggregate?.average === undefined ? null : Number(aggregate.average);
    const count = Number(aggregate?.count) || 0;
    const output = root.querySelector('[data-rating-summary]');
    if (!output) return;
    output.textContent = count
      ? `${starsText(average)} · ${count.toLocaleString()} ${count === 1 ? 'rating' : 'ratings'}`
      : 'Be the first to rate this tool';
  }

  function selectRating(root, value) {
    root.dataset.selectedRating = String(value);
    root.querySelectorAll('[data-rating-value]').forEach(button => {
      const selected = Number(button.dataset.ratingValue) === value;
      button.setAttribute('aria-checked', String(selected));
      button.classList.toggle('selected', selected);
    });
    root.querySelector('[data-rating-details]').hidden = false;
    root.querySelector('[data-rating-status]').textContent = `${value} star${value === 1 ? '' : 's'} selected.`;
  }

  function formMarkup() {
    return `<div class="tool-rating__heading"><div><span class="tool-category-label">Your feedback</span><h3>Rate this tool</h3></div><output class="tool-rating__summary" data-rating-summary aria-live="polite"></output></div>
      <div class="tool-rating__stars" role="radiogroup" aria-label="Rating from 1 to 5 stars">
        ${[1, 2, 3, 4, 5].map(value => `<button type="button" role="radio" aria-checked="false" aria-label="${value} star${value === 1 ? '' : 's'}" data-rating-value="${value}"><span aria-hidden="true">★</span></button>`).join('')}
      </div>
      <p class="sr-only" data-rating-status aria-live="polite"></p>
      <form class="tool-rating__form" data-rating-details hidden novalidate>
        <label><span>Optional review</span><textarea name="review" maxlength="1000" rows="3" placeholder="Share what worked or what could be improved (optional)"></textarea></label>
        <div class="tool-rating__actions"><span class="tool-rating__message" data-rating-message role="status" aria-live="polite"></span><button type="submit" class="btn btn-primary">Submit Rating</button></div>
      </form>`;
  }

  function resultReady(root) {
    if (root.dataset.ratingMode !== 'result') return true;
    return Boolean(root.closest(
      '[data-result-ready="true"], #tool-complete-mount:not(.hidden), .crop-result-panel:not(.hidden), .image-converter__result:not([hidden]), .gps-studio__result:not([hidden])'
    ));
  }

  function reveal(root) {
    if (root.dataset.ratingAvailable === 'true' && resultReady(root)) root.hidden = false;
  }

  async function mount(root) {
    if (mounted.has(root)) return;
    mounted.add(root);
    const toolId = root.dataset.toolId;
    if (!/^[a-z0-9-]{1,100}$/.test(toolId || '')) return;
    try {
      const body = await request(`${endpoint}?toolId=${encodeURIComponent(toolId)}`);
      if (!body.available) return;
      root.innerHTML = formMarkup();
      renderAggregate(root, body.aggregate);
      updateStructuredData(toolId, body.aggregate);
      root.dataset.ratingAvailable = 'true';
      reveal(root);
    } catch (error) {
      // A disabled or unavailable database must not create a dead public form.
      root.hidden = true;
      root.dataset.ratingState = error.status === 503 ? 'unavailable' : 'error';
      return;
    }

    root.addEventListener('click', event => {
      const button = event.target.closest('[data-rating-value]');
      if (button) selectRating(root, Number(button.dataset.ratingValue));
    });
    root.addEventListener('keydown', event => {
      const button = event.target.closest('[data-rating-value]');
      if (!button) return;
      let value = Number(button.dataset.ratingValue);
      if (['ArrowRight', 'ArrowUp'].includes(event.key)) value = value === 5 ? 1 : value + 1;
      else if (['ArrowLeft', 'ArrowDown'].includes(event.key)) value = value === 1 ? 5 : value - 1;
      else if (/^[1-5]$/.test(event.key)) value = Number(event.key);
      else return;
      event.preventDefault();
      const next = root.querySelector(`[data-rating-value="${value}"]`);
      next?.focus();
      selectRating(root, value);
    });
    root.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const rating = Number(root.dataset.selectedRating);
      const review = form.elements.review.value;
      const button = form.querySelector('button[type="submit"]');
      const message = root.querySelector('[data-rating-message]');
      if (!Number.isInteger(rating)) {
        message.textContent = 'Choose a star rating first.';
        return;
      }
      button.disabled = true;
      message.textContent = 'Submitting…';
      try {
        const body = await request(endpoint, { method: 'POST', body: JSON.stringify({ tool_id: toolId, rating, review }) });
        renderAggregate(root, body.aggregate);
        updateStructuredData(toolId, body.aggregate);
        root.querySelector('.tool-rating__stars').hidden = true;
        form.hidden = true;
        const thanks = document.createElement('p');
        thanks.className = 'tool-rating__thanks';
        thanks.setAttribute('role', 'status');
        thanks.textContent = body.message || 'Thank you for your feedback!';
        root.appendChild(thanks);
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
      }
    });
  }

  function scan(root = document) {
    root.querySelectorAll?.('[data-tool-rating]').forEach(node => { mount(node); reveal(node); });
  }

  window.GxaToolRatings = Object.freeze({ placeholder, scan });
  const start = () => {
    scan();
    new MutationObserver(records => records.forEach(record => {
      if (record.type === 'attributes') { scan(record.target.closest?.('[data-tool-rating]') || document); return; }
      record.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('[data-tool-rating]')) mount(node);
        scan(node);
      });
    })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-result-ready'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
