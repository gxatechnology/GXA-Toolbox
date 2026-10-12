/* Edit PDF only: selectable text targets, explicit visual replacement, optional OCR. */
(function (root) {
  'use strict';
  function mount(host, api) {
    const panel = document.createElement('section'); panel.className = 'pdf-text-panel'; panel.hidden = true;
    host.querySelector('.pdf-edit-properties').prepend(panel);
    const layer = document.createElement('div'); layer.className = 'pdf-text-targets'; layer.hidden = true;
    host.querySelector('.pdf-edit-page').append(layer);
    let enabled = false, revision = 0, selected = null, worker = null, stopped = false, recognizing = false;
    let renderedPdf = null, renderedPage = null, cancelRecognition = null;
    let regions = [], ocrRegions = null, ocrPage = null, ocrSource = null, baseKey = '', baseBytes = null;
    const abort = new AbortController();
    const on = (element, type, fn) => element.addEventListener(type, fn, { signal: abort.signal });
    const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
    const state = () => api.state();
    function stopWorker() { recognizing=false;const cancel=cancelRecognition;cancelRecognition=null;cancel?.();const active=worker;worker=null;if(active) active.terminate().catch(()=>{}); }
    function message(text, error = false) { api.status(text, error); }
    function cancel() { selected = null; showPanel(); const button=layer.querySelector('[aria-pressed="true"]');button?.setAttribute('aria-pressed','false');button?.focus(); }
    function showPanel() {
      panel.hidden = !enabled;
      if (!enabled) return;
      if (!selected) {
        panel.innerHTML = `<h2>Edit existing text</h2><p>Choose a highlighted text region on this page. Native edits are offered only for supported text objects.</p><p>${regions.length ? `${regions.length} regions detected.` : 'No usable text regions detected on this page.'}</p>${regions.length ? `<label for="pdf-text-region-picker">Text region (keyboard/touch alternative)</label><select id="pdf-text-region-picker"><option value="">Choose text region…</option>${regions.map((region,index)=>`<option value="${index}">${index+1}. ${escape(region.text)}</option>`).join('')}</select>` : ''}<button type="button" data-text-action="ocr">Recognize text (OCR)</button><p>English OCR downloads its worker/model on demand. Review every recognized word. OCR replacement is visual, not native text editing.</p>`;
        return;
      }
      const current = state().data.nativeEdits?.find(edit => edit.pageIndex === state().pageIndex && edit.key === selected.native?.key);
      panel.innerHTML = `<h2>${selected.ocr ? 'Edit OCR text' : 'Edit selected text'}</h2>
        <p>${selected.native ? 'Native replacement available: original font, size, color and rotation are retained. Text does not reflow; inspect longer replacements for overlap. This is not secure redaction.' : 'This text object cannot be safely rewritten with its original font/structure.'}</p>
        <label for="pdf-text-mode">Replacement mode</label><select id="pdf-text-mode">${selected.native ? '<option value="native">Native text replacement</option>' : ''}<option value="visual">Replace visually${selected.ocr ? ' (OCR)' : ''}</option></select>
        <label for="pdf-text-value">Replacement text</label><textarea id="pdf-text-value" rows="3" maxlength="5000" autocomplete="off" spellcheck="false">${escape(current?.text ?? selected.text)}</textarea>
        <div class="pdf-text-visual-options"${selected.native ? ' hidden' : ''}>
          <p>Visual replacement covers the region; original text/image remains recoverable underneath. This is NOT redaction. This mode uses a standard substitute font, not the original embedded typography. Rotated/complex typography may need manual adjustment.</p>
          <label for="pdf-text-size">Font size (pt)</label><input id="pdf-text-size" type="number" min="6" max="144" step="0.5" value="${Math.min(144,Math.max(6,Math.round(selected.fontSize)))}">
          <label for="pdf-text-color">Text color</label><input id="pdf-text-color" type="color" value="#172554">
          <label for="pdf-text-mask-color">Cover color</label><input id="pdf-text-mask-color" type="color" value="#ffffff">
          <p>After Apply, Selected element controls adjust position, width, height, alignment, font and bold/italic. Delete removes both the replacement and its cover.</p>
        </div>
        <div class="pdf-text-actions"><button type="button" data-text-action="apply">Apply text</button><button type="button" data-text-action="cancel">Cancel</button>${current ? '<button type="button" data-text-action="restore">Restore original text</button>' : ''}</div>
        <p>Enter applies; Shift+Enter inserts a line break for visual replacement. Escape cancels.</p>`;
    }
    function select(region, button) {
      if (state().busy || state().preview || recognizing) return;
      selected = region;
      layer.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
      showPanel(); panel.querySelector('textarea').focus();
      if (innerWidth < 768) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function targets() {
      const { scale } = state(); layer.replaceChildren();
      for (const region of regions) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'pdf-text-region';
        button.setAttribute('aria-label', `${region.ocr ? 'OCR' : 'PDF'} text: ${region.text}`); button.setAttribute('aria-pressed', String(region===selected));
        button.title = region.text; button.dataset.native = String(Boolean(region.native));
        Object.assign(button.style, { left:`${region.x*scale}px`, top:`${region.y*scale}px`, width:`${Math.max(8,region.width*scale)}px`, height:`${Math.max(8,region.height*scale)}px` });
        button.addEventListener('click',event => { event.stopPropagation(); select(region,button); });
        button.addEventListener('dblclick',event => { event.stopPropagation(); select(region,button); });
        layer.append(button);
      }
    }
    async function refresh() {
      const s = state(); layer.hidden = !enabled || s.preview || !s.info;
      if (!enabled || s.preview || !s.info) { panel.hidden = true;++revision;stopWorker();renderedPdf=null;return; }
      // Zoom/viewport changes must not discard a user's draft or restart OCR.
      if(renderedPdf===s.pdf && renderedPage===s.pageIndex){if(!recognizing)targets();return;}
      stopWorker();renderedPdf=s.pdf;renderedPage=s.pageIndex;
      const token = ++revision; selected = null; panel.hidden = false;
      panel.textContent = 'Detecting text regions…'; layer.replaceChildren();
      try {
        const page = await s.pdf.getPage(s.pageIndex + 1);
        const content = await page.getTextContent();
        if(stopped||token!==revision)return;
        const key = JSON.stringify(s.data.pagePlan);
        if (baseKey !== key || ocrSource !== s.source || !baseBytes) {
          const bytes = await root.GxaPdfEditCore.exportPdf(s.source, { pagePlan:s.data.pagePlan }, root.PDFLib);
          if(stopped||token!==revision)return;
          baseBytes=bytes;
          baseKey = key; ocrRegions = null; ocrSource = s.source;
        }
        const native = await root.GxaPdfTextCore.inspect(baseBytes, root.PDFLib, s.pageIndex);
        if (stopped || token !== revision || s.source !== state().source) return;
        const view = page.getViewport({ scale:1 });
        regions = content.items.filter(item => item.str?.trim()).slice(0,1500).map(item => {
          const m = root.pdfjsLib.Util.transform(view.transform,item.transform);
          const size = Math.hypot(m[2],m[3]), len = Math.hypot(m[0],m[1]) || 1;
          const fontStyle = content.styles[item.fontName] || {};
          const ascent = fontStyle.ascent ?? .85, descent = fontStyle.descent ?? -.2;
          const ux=m[0]/len, uy=m[1]/len, vx=m[2]/(size||1), vy=m[3]/(size||1);
          const points = [0,item.width].flatMap(w => [ascent,descent].map(h => [m[4]+ux*w+vx*size*h,m[5]+uy*w+vy*size*h]));
          const x=Math.max(0,Math.min(...points.map(p=>p[0]))-1), y=Math.max(0,Math.min(...points.map(p=>p[1]))-1);
          const width=Math.min(view.width-x,Math.max(...points.map(p=>p[0]))-x+1), height=Math.min(view.height-y,Math.max(...points.map(p=>p[1]))-y+1);
          const matches=native.filter(run=>{
            const edit=s.data.nativeEdits?.find(e=>e.pageIndex===s.pageIndex&&e.key===run.key);
            const baseline=root.GxaPdfEditCore.pdfToVisual(s.info.pages[s.pageIndex],run.matrix[4],run.matrix[5]);
            return (edit?.text ?? run.text)===item.str && Math.hypot(baseline[0]-m[4],baseline[1]-m[5])<1 && Math.abs(run.fontSize-size)<1;
          });
          return { text:item.str,x,y,width,height,fontSize:size,native:matches.length===1?matches[0]:null };
        }).filter(r=>r.width>=1&&r.height>=1&&Number.isFinite(r.x+r.y+r.width+r.height+r.fontSize));
        if (ocrRegions && ocrPage===s.data.pagePlan?.[s.pageIndex]?.id) regions=ocrRegions;
        targets(); showPanel(); message(`${regions.length} text regions. Choose one to edit; unsupported text uses explicit visual replacement.`);
      } catch { if(token===revision) { regions=[];showPanel();message('Text regions could not be read. You can try OCR on this page.',true); } }
    }
    async function apply(restore = false) {
      const s=state(), region=selected;
      if (!region || s.busy || s.preview) return;
      const value=panel.querySelector('#pdf-text-value').value;
      try {
        if (restore || panel.querySelector('#pdf-text-mode').value==='native') {
          if (!region.native) return;
          if(!restore && /[^\x20-\x7e]/.test(value))throw new Error('Native replacement supports printable ASCII text without line breaks. Use Replace visually for other supported Latin text.');
          const edits=(s.data.nativeEdits || []).filter(e=>e.pageIndex!==s.pageIndex||e.key!==region.native.key);
          if (!restore && value!==region.native.text) edits.push({pageIndex:s.pageIndex,key:region.native.key,original:region.native.text,text:value});
          await api.native(edits);
        } else {
          const size=Number(panel.querySelector('#pdf-text-size').value);
          if (!Number.isFinite(size)||size<6||size>144) throw new Error('Choose a font size from 6 to 144 points.');
          const page=s.info.pages[s.pageIndex];
          const overlay={id:`overlay-${crypto.randomUUID()}`,type:'text',pageIndex:s.pageIndex,x:region.x,y:region.y,width:Math.min(page.visualWidth-region.x,Math.max(80,region.width)),height:Math.min(page.visualHeight-region.y,Math.max(size*2.5,region.height)),text:value,font:'Helvetica',fontSize:size,color:panel.querySelector('#pdf-text-color').value,align:'left',replacementSource:region.ocr?'ocr':'pdf',mask:{x:region.x,y:region.y,width:region.width,height:region.height,color:panel.querySelector('#pdf-text-mask-color').value}};
          const layout=await root.GxaPdfEditCore.layoutText(value,overlay,root.PDFLib);
          if(layout.overflow) throw new Error('Replacement is too long for this region. Shorten it or reduce the font size, then resize the added replacement if needed.');
          api.visual(overlay);
        }
        selected=null;
      } catch(error) { message(error.message || 'The text replacement could not be applied.',true); }
    }
    async function recognize() {
      const s=state(); if(s.busy||recognizing||!s.info)return;
      recognizing=true;
      const token=++revision;selected=null;layer.replaceChildren();
      panel.innerHTML='<h2>Recognizing text</h2><p>Reading this page with the English OCR model…</p><button type="button" data-text-action="stop-ocr">Cancel OCR</button>';
      let canvas, ownedWorker, timeout, ocrRender, rejectCancellation;
      const cancelled=new Promise((_,reject)=>{rejectCancellation=reject;});
      const cancel=()=>rejectCancellation(new Error('OCR cancelled'));
      cancelRecognition=cancel;
      try {
        await Promise.race([root.GxaWorkspace.loadScriptOnce('/assets/vendor/tesseract/tesseract.min.js','Tesseract'),cancelled]);
        if(stopped||token!==revision)return;
        let rejectInitialization;
        const initializationError=new Promise((_,reject)=>{rejectInitialization=reject;});
        const creating=root.Tesseract.createWorker('eng',1,{workerPath:'/assets/vendor/tesseract/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',cacheMethod:'none',errorHandler:()=>rejectInitialization(new Error('OCR resources unavailable'))});
        // Tesseract exposes terminate only after initialization. A late worker
        // is terminated before receiving any page pixels after cancel/navigation.
        creating.then(created=>{if(stopped||token!==revision)created.terminate().catch(()=>{});},()=>{});
        const created=await Promise.race([creating,initializationError,cancelled,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('OCR initialization timeout')),180000);})]);
        clearTimeout(timeout);
        ownedWorker=created;
        if(stopped||token!==revision){await created.terminate();return;} worker=created;
        const page=await s.pdf.getPage(s.pageIndex+1), base=page.getViewport({scale:1});
        const factor=Math.min(2,Math.sqrt(8_000_000/(base.width*base.height)));
        const view=page.getViewport({scale:factor});canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
        ocrRender=page.render({canvasContext:canvas.getContext('2d'),viewport:view,annotationMode:root.pdfjsLib.AnnotationMode.DISABLE});
        await Promise.race([ocrRender.promise,cancelled]);
        if(stopped||token!==revision)return;
        const result=await Promise.race([created.recognize(canvas,{}, {text:true,blocks:true}),cancelled,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('OCR timeout')),180000);})]);
        if(stopped||token!==revision||s.source!==state().source)return;
        ocrRegions=(result.data.blocks||[]).flatMap(block=>block.paragraphs||[]).flatMap(p=>p.lines||[]).filter(line=>line.text?.trim()).slice(0,1000).map(line=>{
          const x=Math.max(0,line.bbox.x0/factor-1),y=Math.max(0,line.bbox.y0/factor-1);
          return {text:line.text.trim(),x,y,width:Math.min(base.width-x,(line.bbox.x1-line.bbox.x0)/factor+2),height:Math.min(base.height-y,(line.bbox.y1-line.bbox.y0)/factor+2),fontSize:Math.max(6,(line.bbox.y1-line.bbox.y0)/factor),ocr:true,native:null};
        }).filter(r=>r.width>0&&r.height>0);
        ocrPage=s.data.pagePlan?.[s.pageIndex]?.id;ocrSource=s.source;regions=ocrRegions;targets();showPanel();
        message(regions.length?`${regions.length} OCR regions detected. Verify the recognized text before visual replacement.`:'OCR found no usable text. Try a clearer, upright scan.');
      } catch { if(token===revision){++revision;recognizing=false;targets();showPanel();message('OCR could not finish. Check the model download connection or try a smaller, clearer page.',true);} }
      finally { clearTimeout(timeout);ocrRender?.cancel();if(cancelRecognition===cancel)cancelRecognition=null;if(token===revision)recognizing=false;if(canvas){canvas.width=1;canvas.height=1;}if(worker===ownedWorker)worker=null;if(ownedWorker)await ownedWorker.terminate().catch(()=>{}); }
    }
    on(panel,'click',event=>{const name=event.target.closest('[data-text-action]')?.dataset.textAction;if(!name)return;event.stopPropagation();if(name==='cancel')cancel();if(name==='apply'||name==='restore')apply(name==='restore');if(name==='ocr')recognize();if(name==='stop-ocr'){++revision;stopWorker();targets();showPanel();message('OCR cancelled.');}});
    on(panel,'change',event=>{if(event.target.id==='pdf-text-mode')panel.querySelector('.pdf-text-visual-options').hidden=event.target.value==='native';if(event.target.id==='pdf-text-region-picker'&&event.target.value!==''){const index=Number(event.target.value);if(regions[index])select(regions[index],layer.children[index]);}});
    on(panel,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}else if(event.key==='Enter'&&!event.shiftKey&&event.target.id==='pdf-text-value'){event.preventDefault();apply();}});
    return {activate(){enabled=true;renderedPdf=null;refresh();},deactivate(){enabled=false;++revision;selected=null;panel.hidden=true;layer.hidden=true;stopWorker();},refresh,reset(){this.deactivate();baseBytes=null;baseKey='';ocrSource=null;ocrPage=null;renderedPdf=null;regions=[];ocrRegions=null;layer.replaceChildren();panel.replaceChildren();},destroy(){stopped=true;this.reset();abort.abort();panel.remove();layer.remove();}};
  }
  root.GxaPdfTextEditor=Object.freeze({mount});
})(window);
