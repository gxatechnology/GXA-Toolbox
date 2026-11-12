/* Shared, decorative guide illustrations. Step copy remains the content source of truth. */
((root) => {
  'use strict';
  const paths = Object.freeze({
    arrange: '<rect x="14" y="13" width="15" height="18" rx="3"/><rect x="35" y="13" width="15" height="18" rx="3"/><rect x="14" y="37" width="15" height="18" rx="3"/><path d="M43 38v14m-5-5 5 5 5-5"/>',
    adjust: '<path d="M14 18h36M14 32h36M14 46h36"/><circle cx="26" cy="18" r="5"/><circle cx="41" cy="32" r="5"/><circle cx="31" cy="46" r="5"/>',
    process: '<path d="M36 11 19 35h13l-4 18 18-26H33l3-16Z"/>',
    review: '<path d="M9 32c7-10 15-15 23-15s16 5 23 15c-7 10-15 15-23 15S16 42 9 32Z"/><circle cx="32" cy="32" r="7"/>',
    download: '<path d="M32 10v31m-11-11 11 11 11-11M13 46v7h38v-7"/>',
    copy: '<rect x="18" y="16" width="30" height="35" rx="5"/><path d="M14 43h-2V12a4 4 0 0 1 4-4h27"/>',
    calculate: '<rect x="17" y="8" width="30" height="48" rx="5"/><path d="M23 17h18v8H23Zm0 17h4m10 0h4m-18 9h4m10 0h4m-18 9h4m10 0h4"/>',
    input: '<rect x="10" y="19" width="44" height="30" rx="5"/><path d="M18 27h4m6 0h4m6 0h4m-24 8h4m6 0h4m6 0h4M19 42h26"/>'
  });
  const actionFor = description => {
    const value = String(description).toLowerCase();
    return /download|export|save (?:the|your|a) (?:file|copy|result|output|pdf|image)|reopen the saved/.test(value) ? 'download'
      : /reorder|arrange|organize|drag|move (?:the|a) page/.test(value) ? 'arrange'
      : /crop|resize|rotate|adjust|choose (?:the|an|a) (?:size|format|quality|setting)|set (?:the|a)|configure/.test(value) ? 'adjust'
      : /preview|review|inspect|compare|check (?:the|your|each) (?:result|output|page|image|file)/.test(value) ? 'review'
      : /copy (?:the|your)|clipboard/.test(value) ? 'copy'
      : /calculat|formula|compute|enter (?:the|your) (?:number|amount|rate)/.test(value) ? 'calculate'
      : /select|upload|enter|paste|type|choose/.test(value) ? 'input' : 'process';
  };
  const icon = (toolId, description, index) => {
    if (index === 0 && root.GxaToolIcons?.svg(toolId)) return root.GxaToolIcons.svg(toolId);
    const action = actionFor(description);
    return `<svg class="gxa-guide-action-icon" viewBox="0 0 64 64" width="64" height="64" focusable="false" aria-hidden="true" data-guide-action="${action}"><rect x="4" y="5" width="56" height="54" rx="16" fill="var(--icon-wash,#dce7ff)"/><g fill="none" stroke="var(--icon-accent,#476fd4)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths[action]}</g></svg>`;
  };
  const shortHeading = (_toolId, _description, original) => {
    const sentence = String(original).trim().replace(/[.!?]+$/, '');
    if (sentence.length <= 54) return sentence;
    const candidates = [...sentence.matchAll(/;|,\s+then\b|\s+and\s+|\s+before\s+|\s+while\s+|\s+to\s+/gi)]
      .map(match => ({ prefix: sentence.slice(0, match.index).trim(), index: match.index }))
      .filter(item => item.prefix.length >= 20 && item.prefix.length <= 54);
    if (candidates.length) return candidates[0].prefix;
    const words = sentence.match(/^.{20,54}(?=\s|$)/);
    return (words?.[0] || sentence.slice(0, 54)).trim().replace(/\s+(?:a|an|and|for|of|or|the|to|with)$/i, '');
  };
  const render = (toolId, steps, escape) => `<ol class="tool-steps tool-steps--visual" data-guide-tool="${escape(toolId)}">${steps.map((item, index) => {
    const originalTitle = String(item.title || '').trim();
    const description = String(item.description || '').trim();
    const title = shortHeading(toolId, description, originalTitle);
    const repeatsTitle = description.replace(/[.!?]+$/, '') === title.replace(/[.!?]+$/, '');
    return `<li class="tool-guide-step"><div class="tool-guide-step__art" aria-hidden="true">${icon(toolId, description, index)}</div><div class="tool-guide-step__copy"><span class="tool-guide-step__number">Step ${index + 1}</span><h3>${escape(title)}</h3>${repeatsTitle ? '' : `<p>${escape(description)}</p>`}</div></li>`;
  }).join('')}</ol>`;
  root.GxaToolGuideVisuals = Object.freeze({ icon, shortHeading, render });
})(typeof window === 'undefined' ? globalThis : window);
