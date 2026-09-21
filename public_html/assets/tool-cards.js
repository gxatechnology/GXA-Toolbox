/* Shared presentation for directory, related tools and personal shortcuts.
   No routing, persistence, processing or authentication belongs in this module. */
((root) => {
  'use strict';
  const labels=Object.freeze({pdf:'PDF',image:'Image',convert:'Convert',zip:'ZIP & archives',utility:'Developer & utility',calculator:'Calculator'});
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=tool=>root.GxaToolIcons?.svg(tool.id) || `<i data-lucide="${escape(tool.icon)}" aria-hidden="true"></i>`;
  function create(tool, saved, onNavigate, onFavorite) {
    const card=document.createElement('article');
    card.className=`tool-card tool-tile cat-${tool.category}`;
    card.dataset.toolId=tool.id;
    card.innerHTML=`<a class="tool-card-link" href="/${tool.id}/" aria-label="Open ${escape(tool.name)}">
      <span class="tool-card-icon">${icon(tool)}</span>
      <div class="tool-card-copy"><h3 class="tool-card-title">${escape(tool.name)}</h3><p class="tool-card-desc">${escape(tool.desc)}</p></div>
      <div class="tool-card-footer"><span class="tool-card-category">${labels[tool.category] || escape(tool.category)}</span><span class="tool-card-launch" aria-hidden="true"><span>Open tool</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14m-5-5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
    </a><button type="button" class="favorite-button ${saved?'active':''}" data-favorite-tool="${tool.id}" aria-pressed="${saved}" aria-label="${saved?'Remove':'Add'} ${escape(tool.name)} ${saved?'from':'to'} favorites" title="${saved?'Remove from favorites':'Save to favorites'}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg></button>`;
    card.querySelector('a').addEventListener('click',onNavigate);
    card.querySelector('button').addEventListener('click',onFavorite);
    return card;
  }
  root.GxaToolCards=Object.freeze({create,icon,labels});
})(window);
