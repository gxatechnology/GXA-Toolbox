(function (root) {
  'use strict';
  function uuidV4(secureCrypto = root.crypto) {
    if (typeof secureCrypto?.randomUUID === 'function') return secureCrypto.randomUUID();
    if (typeof secureCrypto?.getRandomValues !== 'function') throw new Error('Secure random generation is unavailable. Open this tool in a secure, modern browser.');
    const bytes = secureCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function textResult(mount, title, text, id = '', copy = false) {
    if (!mount) return;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;min-width:0;text-align:left;';
    const heading = document.createElement('h5');
    heading.textContent = title;
    heading.style.cssText = 'font-weight:700;margin-bottom:8px;';
    const output = document.createElement('textarea');
    output.className = 'form-input-text';
    output.style.cssText = 'height:150px;width:100%;font-family:var(--font-mono);font-size:12px;';
    output.readOnly = true;
    output.setAttribute('aria-label', title);
    if (id) output.id = id;
    output.value = String(text ?? '');
    output.addEventListener('click', () => output.select());
    wrapper.append(heading, output);
    if (copy) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost btn-sm';
      button.textContent = 'Copy result';
      button.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(output.value); button.textContent = 'Copied'; }
        catch { button.textContent = 'Select and copy the result'; output.focus(); output.select(); }
      });
      wrapper.append(button);
    }
    mount.replaceChildren(wrapper);
  }
  function pairs(mount, title, entries) {
    if (!mount) return;
    const section = document.createElement('section');
    const heading = document.createElement('h5');
    heading.textContent = title;
    section.append(heading);
    for (const [key, value] of entries) {
      const row = document.createElement('p');
      row.style.overflowWrap = 'anywhere';
      const label = document.createElement('strong');
      label.textContent = `${key}: `;
      row.append(label, document.createTextNode(String(value)));
      section.append(row);
    }
    mount.replaceChildren(section);
  }
  root.GxaToolSafety = Object.freeze({ uuidV4, textResult, pairs });
})(globalThis);
