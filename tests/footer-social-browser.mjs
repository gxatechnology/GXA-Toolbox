import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createQaServer } from './browser-qa-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GXA_PLAYWRIGHT_MODULE || 'playwright');
const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.GXA_BROWSER_EXECUTABLE ? { executablePath: process.env.GXA_BROWSER_EXECUTABLE } : {})
});

const viewports = [
  [320, 568], [360, 800], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1280, 720], [1440, 900], [1920, 1080]
];
const expectedColors = {
  reddit: 'rgb(255, 69, 0)',
  x: 'rgb(17, 17, 17)',
  facebook: 'rgb(24, 119, 242)',
  instagram: 'rgb(228, 64, 95)',
  linkedin: 'rgb(10, 102, 194)'
};

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function inspectFooter(page, route, socialSelector, feedbackExpected) {
  const response = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `${route} must load directly`);
  await page.waitForSelector(`${socialSelector} [data-platform="linkedin"]`);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);

  return page.evaluate(({ socialSelector, feedbackExpected }) => {
    const links = [...document.querySelectorAll(`${socialSelector} [data-platform]`)];
    const feedback = document.querySelector('.feedback-fab');
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      links: links.map(link => {
        const box = link.getBoundingClientRect();
        return {
          platform: link.getAttribute('data-platform'),
          color: getComputedStyle(link).color,
          width: box.width,
          height: box.height,
          box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
          target: link.getAttribute('target'),
          rel: link.getAttribute('rel'),
          tooltip: link.getAttribute('data-tooltip')
        };
      }),
      feedbackExpected,
      feedbackBox: feedback ? (() => {
        const box = feedback.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
          display: getComputedStyle(feedback).display
        };
      })() : null
    };
  }, { socialSelector, feedbackExpected });
}

try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 768 });
    await context.route('**/*', route => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.protocol === 'http:' && requestUrl.origin !== origin) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    for (const route of ['/', '/compress-image/']) {
      const state = await inspectFooter(page, route, '.footer-socials', true);
      assert.ok(state.overflow <= 1, `${route} must not overflow at ${width}px`);
      assert.equal(state.links.length, 5, `${route} must show all social links at ${width}px`);
      assert.ok(state.feedbackBox, `${route} must keep Feedback reachable at ${width}px`);
      assert.notEqual(state.feedbackBox.display, 'none', `${route} must keep Feedback visible at ${width}px`);
      assert.ok(state.feedbackBox.width >= 40 && state.feedbackBox.height >= 40, `${route} must keep a usable Feedback target at ${width}px`);
      for (const link of state.links) {
        assert.equal(link.color, expectedColors[link.platform], `${link.platform} must use its brand color`);
        assert.ok(link.width >= 44 && link.height >= 44, `${link.platform} must retain a 44px touch target`);
        assert.equal(link.target, '_blank');
        assert.match(link.rel || '', /noopener/);
        assert.match(link.rel || '', /noreferrer/);
        assert.ok(link.tooltip, `${link.platform} tooltip must remain available`);
        assert.equal(overlaps(link.box, state.feedbackBox), false, `${link.platform} must not overlap Feedback at ${width}px`);
      }
      if (route === '/' && width === 1440) {
        const reddit = page.locator('.footer-social-link[data-platform="reddit"]');
        await reddit.hover();
        await page.waitForTimeout(220);
        const hoverState = await reddit.evaluate(link => ({
          transform: getComputedStyle(link).transform,
          background: getComputedStyle(link).backgroundColor
        }));
        assert.notEqual(hoverState.transform, 'none', 'Social hover must apply the subtle lift');
        assert.notEqual(hoverState.background, 'rgb(248, 250, 252)', 'Social hover must apply a brand tint');
        await reddit.focus();
        const focusState = await reddit.evaluate(link => ({
          outlineStyle: getComputedStyle(link).outlineStyle,
          outlineWidth: getComputedStyle(link).outlineWidth
        }));
        assert.equal(focusState.outlineStyle, 'solid', 'Social keyboard focus must remain visible');
        assert.notEqual(focusState.outlineWidth, '0px', 'Social keyboard focus must have a visible outline');
      }
    }

    const backgroundState = await inspectFooter(page, '/background-remover/', '.gxa-site-footer-socials', false);
    assert.ok(backgroundState.overflow <= 1, `Background Remover must not overflow at ${width}px`);
    assert.equal(backgroundState.links.length, 5, `Background Remover must show all social links at ${width}px`);
    for (const link of backgroundState.links) {
      assert.equal(link.color, expectedColors[link.platform], `Background Remover ${link.platform} must use its brand color`);
      assert.ok(link.width >= 44 && link.height >= 44, `Background Remover ${link.platform} must retain a 44px touch target`);
      assert.equal(link.target, '_blank');
      assert.match(link.rel || '', /noopener/);
      assert.match(link.rel || '', /noreferrer/);
      assert.ok(link.tooltip, `Background Remover ${link.platform} tooltip must remain available`);
    }

    await context.close();
  }

  console.log(`Footer social browser QA passed at ${viewports.length} requested viewports across home, tool, and Background Remover footers.`);
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
