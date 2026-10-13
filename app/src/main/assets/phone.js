/* Layout and navigation only. Reads the existing rendered values and calls Studio actions. */
(() => {
  'use strict';
  const media = matchMedia('(max-width:760px)');
  const icons = {
    menu:'M4 6h16M4 12h16M4 18h16',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0',
    more:'M5 12h.01M12 12h.01M19 12h.01'
  };
  const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]}"></path></svg>`;
  const tabs = [['overview','Main'],['transactions','Transactions'],['planner','Reminders'],['accounts','Accounts'],['budget','Budget'],['reports','Reports'],['sms','SMS']];
  const tools = [['categories','Categories'],['payees','Payees'],['tags','Tags'],['currency','Currency'],['audit','Audit'],['settings','Settings']];
  const state = () => window.mmex?.phoneState?.() || {view:'overview',fileName:'',loaded:false,dirtyCount:0};
  let header, fab, queued = false, monthIndex = 0, budgetStart = '', lastView = '';
  const text = (node, value) => { if(node && node.textContent !== value) node.textContent = value; };
  function mount() {
    if(header) return;
    header = document.createElement('header'); header.className = 'phone-header';
    header.innerHTML = `<div class="phone-appbar"><button class="phone-icon" aria-label="Open navigation" data-phone="menu">${svg('menu')}</button><div><strong id="phone-title">Diwan</strong><small id="phone-filename">Offline · select your working folder</small></div><button class="phone-icon" aria-label="Search transactions" data-phone="search">${svg('search')}</button><button class="phone-save" aria-label="Save MMB changes" data-phone="save">Save</button><button class="phone-icon" aria-label="File actions" data-phone="files">${svg('more')}</button></div><nav class="phone-tabs" aria-label="Views">${tabs.map(([id,label])=>`<button class="phone-tab" data-view="${id}">${label}</button>`).join('')}</nav>`;
    document.getElementById('app').prepend(header);
    header.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>window.mmex?.setView(button.dataset.view));
    header.querySelector('[data-phone=menu]').onclick=()=>menu(false);
    header.querySelector('[data-phone=files]').onclick=()=>menu(true);
    header.querySelector('[data-phone=save]').onclick=()=>document.getElementById('save-button').click();
    header.querySelector('[data-phone=search]').onclick=()=>{
      if(!state().loaded)return;
      if(state().view!=='transactions')mmex.setView('transactions');
      requestAnimationFrame(()=>{const d=document.querySelector('.phone-filter-box');if(d)d.open=true;document.getElementById('tx-search')?.focus();});
    };
    fab=document.createElement('button');fab.className='phone-fab';fab.type='button';fab.textContent='+';fab.setAttribute('aria-label','Add transaction');fab.onclick=()=>window.mmex?.openTransaction();document.body.append(fab);
  }
  function menu(files) {
    if(!window.mmex)return;
    let dialog=document.getElementById('phone-menu');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='phone-menu';dialog.className='phone-sheet';document.body.append(dialog);}
    dialog.replaceChildren();
    const title=document.createElement('h2');title.textContent=files?'File actions':'Diwan';dialog.append(title);
    if(!files && state().loaded){
      const grid=document.createElement('div');grid.className='phone-sheet-grid';
      for(const [id,label] of [...tabs,...tools]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{dialog.close();mmex.setView(id);};grid.append(b);}dialog.append(grid);
    }
    for(const id of ['open-mmb-button','working-folder-button',...(state().loaded?['save-button','download-button','discard-button']:[])]){
      const original=document.getElementById(id);if(!original||original.classList.contains('hidden'))continue;
      const button=document.createElement('button');button.textContent=original.textContent.trim();button.onclick=()=>{dialog.close();original.click();};dialog.append(button);
    }
    if(state().loaded){
      const status=document.createElement('p');status.style.cssText='font-size:12px;color:#74717d;overflow-wrap:anywhere';
      status.textContent=(document.getElementById('change-count')?.textContent||'')+' · '+(document.getElementById('companion-save-status')?.textContent||'');dialog.append(status);
      const retry=document.createElement('button');retry.textContent='Companion autosave status / retry';retry.onclick=()=>{dialog.close();mmex.reconnectCompanion();};dialog.append(retry);
    }
    const close=document.createElement('button');close.className='phone-sheet-close';close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(close);dialog.showModal();
  }
  function collapseTools(element,label,cls) {
    if(!element || element.closest('.'+cls))return;
    const details=document.createElement('details');details.className=cls;
    const summary=document.createElement('summary');summary.textContent=label;details.append(summary);
    element.before(details);details.append(element);
  }
  function budget() {
    const cards=[...document.querySelectorAll('#view-content .actual-month-card')];
    const table=document.querySelector('#view-content .actual-table');if(!table||!cards.length)return;
    const first=cards[0].dataset.budgetMonth;
    if(first!==budgetStart){budgetStart=first;monthIndex=0;}
    monthIndex=Math.min(monthIndex,cards.length-1);
    let switcher=document.querySelector('.phone-budget-switch');
    if(!switcher){switcher=document.createElement('div');switcher.className='phone-budget-switch';table.closest('.actual-budget-scroll').before(switcher);
      cards.forEach((card,i)=>{const b=document.createElement('button');b.textContent=card.dataset.budgetMonth;b.onclick=()=>{monthIndex=i;budget();};switcher.append(b);});}
    switcher.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===monthIndex));
    cards.forEach((card,i)=>card.classList.toggle('phone-month-hidden',i!==monthIndex));
    for(const row of table.querySelectorAll('tbody tr')){
      const cells=[...row.children];
      if(cells.length<4)continue;
      cells.slice(1).forEach((cell,i)=>{
        cell.classList.toggle('phone-month-hidden',Math.floor(i/3)!==monthIndex);
        cell.dataset.phoneLabel=['Budgeted','Spent','Balance'][i%3];
      });
    }
  }
  function editor() {
    const select=document.getElementById('tx-type');if(!select)return;
    const label=select.closest('label');label.classList.add('phone-type-label');
    document.getElementById('tx-amount').closest('label').classList.add('phone-amount-label');
    let types=label.querySelector('.phone-type-buttons');
    if(!types){types=document.createElement('div');types.className='phone-type-buttons';types.setAttribute('role','tablist');types.setAttribute('aria-label','Transaction type');
      for(const [value,name] of [['Withdrawal','Expense'],['Deposit','Income'],['Transfer','Transfer']]){
        const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.type=value;b.setAttribute('role','tab');
        b.onclick=()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));update();};types.append(b);
      }label.append(types);select.addEventListener('change',update);
    }
    function update(){types.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.type===select.value)));}
    update();
  }
  function refresh() {
    queued=false;mount();document.body.classList.toggle('phone-layout',media.matches);
    if(!media.matches)return;
    const s=state();text(header.querySelector('#phone-title'),s.loaded?(tabs.concat(tools).find(([id])=>id===s.view)?.[1]||'Diwan'):'Diwan');
    text(header.querySelector('#phone-filename'),s.loaded?s.fileName+(s.dirtyCount?' · '+s.dirtyCount+' unsaved':''):'Offline · select your working folder');
    header.querySelector('.phone-tabs').hidden=!s.loaded;fab.hidden=!s.loaded;
    const save=header.querySelector('.phone-save');save.hidden=!s.loaded;save.classList.toggle('is-dirty',!!s.dirtyCount);
    for(const b of header.querySelectorAll('.phone-tab')){b.classList.toggle('active',b.dataset.view===s.view);if(b.dataset.view===s.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
    if(lastView!==s.view){lastView=s.view;const selected=header.querySelector('.phone-tab.active');if(selected)selected.scrollIntoView({block:'nearest',inline:'nearest'});}
    const view=document.getElementById('view-content');
    if(s.view==='transactions'){
      collapseTools(view.querySelector('.toolbar'),'Search & filters','phone-filter-box');
      for(const b of view.querySelectorAll('.view-header .header-actions button'))if(b.textContent.includes('Add transaction'))b.style.display='none';
    }
    if(s.view==='accounts'){
      collapseTools(view.querySelector('.view-header .header-actions'),'Account display & actions','phone-tools-box');
      collapseTools(view.querySelector('.account-sort-controls'),'Sort accounts','phone-tools-box');
    }
    if(s.view==='overview')collapseTools(view.querySelector('.view-header .header-actions'),'Customize dashboard','phone-tools-box');
    if(s.view==='budget'){collapseTools(view.querySelector('.actual-budget-toolbar'),'Budget tools','phone-tools-box');budget();}
    if(['categories','payees','tags','planner','currency'].includes(s.view)){
      for(const table of view.querySelectorAll('.table-wrap>table')){
        table.classList.add('phone-record-table');
        const labels=[...table.querySelectorAll('thead tr:last-child th')].map(c=>c.textContent.trim());
        for(const row of table.querySelectorAll('tbody tr'))[...row.children].forEach((cell,i)=>cell.dataset.phoneCol=labels[i]||'');
      }
      collapseTools(view.querySelector('.toolbar'),'Search & display','phone-filter-box');
    }
    editor();
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(refresh);}}
  window.MMEXPhone={active:()=>media.matches,refresh:schedule,menu,
    handleBack(){if(media.matches&&document.getElementById('workspace')?.classList.contains('has-inspector')){mmex.closeInspector();return true;}return false;}
  };
  function start(){
    mount();new MutationObserver(schedule).observe(document.getElementById('view-content'),{childList:true,subtree:true});
    new MutationObserver(schedule).observe(document.getElementById('file-status'),{childList:true,subtree:true});
    new MutationObserver(schedule).observe(document.getElementById('transaction-dialog'),{attributes:true,attributeFilter:['open']});
    media.addEventListener('change',()=>{schedule();if(window.mmex?.phoneRerender)mmex.phoneRerender();});
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
