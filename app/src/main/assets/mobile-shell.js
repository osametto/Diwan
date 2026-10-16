/* DIWAN's Android-only presentation. The 1.2.12 engine owns data and writes. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    activity:'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
    accounts:'M3 6h18v14H3zM3 6V3h14M16 11h5v5h-5z',budget:'M4 4h16v16H4zM4 10h16M9 14v2m6-2v2',
    more:'M5 12h.01M12 12h.01M19 12h.01',plus:'M12 5v14M5 12h14',back:'M20 12H4m7-7-7 7 7 7',
    search:'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',filter:'M4 6h16M7 12h10M10 18h4',
    chevron:'m9 5 7 7-7 7',down:'m6 9 6 6 6-6',save:'M5 3h12l4 4v14H3V3h2M7 3v6h10V3M7 21v-8h10v8',
    file:'M6 3h8l5 5v13H5V3h1M14 3v6h5',folder:'M3 6h7l2 3h9v12H3z',edit:'m4 16 12-12 4 4L8 20H4zM14 6l4 4',
    expense:'M7 7l10 10M7 17h10V7',income:'M17 17 7 7m0 10V7h10',calendar:'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
    category:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',people:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
    tag:'M3 3h8l10 10-8 8L3 11zM7 7h.01',reports:'M4 3v18h17M8 16v-5m5 5V7m5 9V4',settings:'M4 7h16M4 17h16M8 4v6m8 4v6',
    currency:'M12 2v20M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',
    copy:'M8 8h13v13H8zM16 8V3H3v13h5',shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z',moon:'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12',
    audit:'M5 3h14v18H5zM8 9l2 2 5-5M8 16h8',message:'M3 4h18v13H8l-5 4zM7 8h10M7 12h6'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
  const button = (action,label,glyph,extra='') => `<button type="button" class="m-icon" data-action="${action}" aria-label="${escape(label)}" ${extra}>${icon(glyph)}</button>`;
  const amount = (value,code,tone='') => `<span class="m-money ${tone}">${escape(value)}<small>${escape(code)}</small></span>`;
  const state = {route:'activity',month:new Date().toLocaleDateString('en-CA').slice(0,7),account:'',type:'',search:'',offset:0,detail:null,tool:null,searching:false};
  let snapshot, root, queued=false, lastLoaded=false, searchTimer, editorSnapshot;
  const labels={activity:'Transactions',home:'Overview',accounts:'Accounts',budget:'Budget',more:'More'};
  const localeDate = value => new Date(value+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'long',year:'numeric'});
  const monthLabel = value => value ? new Date(value+'-15T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}) : 'All dates';
  function monthOffset(value,offset) { const d=new Date(value+'-15T12:00:00');d.setMonth(d.getMonth()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  function empty(title,body,action='add',label='Add transaction') {
    return `<section class="m-empty"><span class="m-empty-icon">${icon(action==='open'?'folder':'activity')}</span><h2>${escape(title)}</h2><p>${escape(body)}</p><button class="m-filled" data-action="${action}">${escape(label)}</button></section>`;
  }
  function navigate(route) {
    state.detail=null;state.tool=null;state.route=route;state.offset=0;if(route==='budget'&&!state.month)state.month=snapshot.today.slice(0,7);
    refreshNow();$('#m-scroll').scrollTop=0;
  }
  function header() {
    const account=snapshot?.accounts?.find(a=>String(a.ACCOUNTID)===String(state.account));
    const detail=state.detail!==null;
    $('#m-header').innerHTML=`${detail||state.tool ? button('back','Back','back') : `<span class="m-monogram" aria-label="DIWAN">D<span></span></span>`}
      <div class="m-heading"><h1>${escape(detail?'Transaction':state.tool?state.tool.label:labels[state.route])}</h1><button class="m-file-name" data-action="files">${escape(snapshot?.loaded?snapshot.fileName:'DIWAN · Your money, on your device')}${snapshot?.loaded?icon('down'):''}</button></div>
      ${snapshot?.loaded?button('save',snapshot.dirty?'Save unsaved changes':'Save file','save',`data-unsaved="${!!snapshot.dirty}"`):''}
      ${snapshot?.loaded&&!detail&&!state.tool?button(state.route==='activity'?'search':'files',state.route==='activity'?'Search transactions':'File actions',state.route==='activity'?'search':'more'):''}`;
    $('#m-nav').hidden=!snapshot?.loaded;
    $('#m-nav').innerHTML=Object.entries(labels).map(([id,label])=>`<button data-route="${id}" ${state.route===id&&!detail&&!state.tool?'aria-current="page"':''}>${icon(id)}<span>${label==='Transactions'?'Activity':label}</span></button>`).join('');
    $('#m-fab').hidden=!snapshot?.loaded||detail||!!state.tool||!['activity','home'].includes(state.route);
    $('#m-fab').innerHTML=icon('plus')+'<span>Add</span>';
    $('#m-save-state').hidden=!snapshot?.loaded||!snapshot.dirty;
    $('#m-save-state').innerHTML=`<span>${snapshot?.dirty || 0} unsaved change${snapshot?.dirty===1?'':'s'}</span><button data-action="save">Save file ${icon('save')}</button>`;
    root.dataset.route=detail?'detail':state.tool?'tool':state.route;
    if(account && state.route==='activity' && !detail && !state.tool) $('#m-header h1').textContent=account.ACCOUNTNAME;
  }
  function activityRows(items) {
    let date='';return items.map(row=>{
      const heading=row.date!==date?`<h2 class="m-date">${escape(localeDate(row.date))}</h2>`:'';date=row.date;
      const transfer=row.TRANSCODE==='Transfer',income=row.TRANSCODE==='Deposit'||row.incoming;
      const tone=transfer?'transfer':income?'income':'expense';
      const payee=transfer?`${row.ACCOUNTNAME} → ${row.destination}`:row.PAYEENAME||(income?'Income':'Expense');
      return heading+`<button class="m-transaction" data-detail="${row.TRANSID}"><span class="m-type-icon ${tone}">${icon(transfer?'activity':income?'income':'expense')}</span>
        <span class="m-tx-label"><strong dir="auto">${escape(payee)}</strong><span dir="auto">${escape(row.SPLIT_COUNT?`${row.SPLIT_COUNT} splits`:row.CATEGORY_PATH||'No category')}</span>${row.NOTES?`<em dir="auto">${escape(row.NOTES)}</em>`:''}</span>
        <span class="m-tx-value">${amount((transfer?'':income?'+':'−')+row.amount,row.code,tone)}<span dir="auto">${escape(transfer?row.destinationAmount+' '+row.destinationCode:row.ACCOUNTNAME)}</span>${row.STATUS==='F'?'<small class="m-status">Follow up</small>':row.STATUS==='R'?`<small class="m-status m-reconciled">${icon('check')} Reconciled</small>`:row.STATUS==='V'?'<small class="m-status">Void</small>':''}</span></button>`;
    }).join('');
  }
  function activity() {
    const data=mmex.mobileTransactions(state),account=snapshot.accounts.find(a=>String(a.ACCOUNTID)===String(state.account));
    return `<div class="m-filters">${state.searching?`<label class="m-search">${icon('search')}<input id="m-search-input" type="search" value="${escape(state.search)}" placeholder="Payee, category, note or amount" aria-label="Search transactions">${button('clear-search','Clear search','close')}</label>`:''}
      <div class="m-filter-row"><button class="m-chip" data-action="accounts">${icon('accounts')}<span>${escape(account?.ACCOUNTNAME||'All accounts')}</span>${icon('down')}</button><button class="m-chip" data-action="period">${icon('calendar')}<span>${escape(monthLabel(state.month))}</span>${icon('down')}</button></div>
      <div class="m-type-tabs" role="group" aria-label="Transaction type">${[['','All'],['Withdrawal','Expenses'],['Deposit','Income'],['Transfer','Transfers']].map(([type,label])=>`<button data-type="${type}" aria-pressed="${state.type===type}">${label}</button>`).join('')}</div></div>
      ${account?`<div class="m-register-balance"><span>Current balance <small>Excludes future transactions</small></span>${amount(account.amount,account.code,account.BALANCE<0?'expense':'')}</div>`:''}
      ${data.items.length?`<div class="m-ledger">${activityRows(data.items)}</div><div class="m-pagination"><button data-action="previous" ${state.offset===0?'disabled':''}>Previous</button><span>${state.offset+1}–${state.offset+data.items.length} of ${data.total}</span><button data-action="next" ${state.offset+50>=data.total?'disabled':''}>Next</button></div>`:empty('No transactions here',state.search?'Try a different search or remove a filter.':'Choose another period, or record your first transaction.',state.month?'all-dates':'add',state.month?'Show all dates':'Add transaction')}`;
  }
  function accounts() {
    return `<section class="m-networth"><div><span>Total balance</span><p>Converted using stored exchange rates</p></div>${snapshot.total===null?'<strong>Rate unavailable</strong>':amount(snapshot.total,snapshot.code)}</section>
      <div class="m-section-line"><h2>Your accounts</h2><button class="m-text" data-action="add-account">${icon('plus')} Add account</button></div>
      ${snapshot.groups.length?snapshot.groups.map(group=>`<section class="m-account-group"><h3>${escape(group.name)}</h3>${group.items.map(a=>`<div class="m-account"><button data-account="${a.ACCOUNTID}"><span class="m-account-icon">${icon('accounts')}</span><span class="m-account-title"><strong dir="auto">${escape(a.ACCOUNTNAME)}</strong><small>${escape(a.code)}${String(a.STATUS).toLowerCase()==='closed'?' · Closed':''}</small></span>${amount(a.amount,a.code,a.BALANCE<0?'expense':'')}${icon('chevron')}</button><button class="m-account-edit" data-edit-account="${a.ACCOUNTID}" aria-label="Edit ${escape(a.ACCOUNTNAME)}">${icon('edit')}</button></div>`).join('')}</section>`).join(''):empty('Add your first account','Set an opening balance, then start recording transactions.','add-account','Add account')}
      <p class="m-footnote">Balances use each account’s own currency. The total uses your base currency and excludes future transactions.</p>`;
  }
  function overview() {
    const data=snapshot.overview;if(!data)return '';
    const money=v=>Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    return `<div class="m-section-line"><h2>${escape(monthLabel(data.today.slice(0,7)))}</h2><span class="m-muted">Through today</span></div>
      <section class="m-cashflow"><div><span>${icon('income')} Income</span>${amount(data.missingRates?'Unavailable':money(data.mtd.income),snapshot.code,'income')}</div><div><span>${icon('expense')} Expenses</span>${amount(data.missingRates?'Unavailable':money(data.mtd.expenses),snapshot.code,'expense')}</div></section>
      <div class="m-net-line"><span>Net earnings</span><strong class="m-money">${data.missingRates?'Rate unavailable':escape(money(data.mtd.income-data.mtd.expenses))+' '+escape(snapshot.code)}</strong></div>
      <section class="m-overview-list"><div class="m-section-line"><h2>Account balances</h2><button class="m-text" data-route="accounts">View all</button></div>${snapshot.accounts.slice(0,5).map(a=>`<button data-account="${a.ACCOUNTID}"><span dir="auto">${escape(a.ACCOUNTNAME)}</span>${amount(a.amount,a.code,a.BALANCE<0?'expense':'')}</button>`).join('')}</section>
      <div class="m-section-line"><h2>Recent activity</h2><button class="m-text" data-route="activity">View all</button></div>${activityRows(mmex.mobileTransactions({offset:0,through:snapshot.today}).items.slice(0,5))}
      <button class="m-list-action" data-tool="planner">${icon('calendar')}<span>Scheduled transactions<small>${data.bills.length} upcoming expense or transfer schedules</small></span>${icon('chevron')}</button>`;
  }
  function budget() {
    const month=state.month||snapshot.today.slice(0,7);let data;
    try{data=mmex.mobileBudget(month);}catch(error){return empty('Budget needs attention',error.message,'budget-settings','Review budget setup');}
    return `<div class="m-month-step">${button('month-before','Previous month','back')}<button data-action="period">${escape(monthLabel(month))}${icon('down')}</button>${button('month-after','Next month','chevron')}</div>
      <section class="m-budget-total"><span>${data.availableValue<0?'Overbudgeted':'Available to budget'}</span>${amount(data.available,data.code,data.availableValue<0?'expense':'')}<small>Budgeted ${escape(data.allocated)} ${escape(data.code)}</small></section>
      <div class="m-section-line"><h2>Budget groups</h2><button class="m-text" data-action="budget-settings">Manage</button></div>
      ${data.groups.map(g=>`<button class="m-envelope" data-allocate="${escape(g.id)}"><div><strong dir="auto">${escape(g.name)}</strong><span class="m-money ${g.balance<0?'expense':''}">${escape(g.balanceText)} <small>left</small></span></div><div class="m-budget-track" role="meter" aria-label="${escape(g.name)} budget used" aria-valuenow="${Math.round(g.ratio*100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${g.ratio*100}%" class="${g.balance<0?'overspent':''}"></span></div><div class="m-envelope-meta"><span>Spent ${escape(g.spent)}</span><span>Budgeted ${escape(g.allocatedText)} ${escape(data.code)}</span></div></button>`).join('')}
      <div class="m-budget-actions"><button class="m-outline" data-action="budget-move">Move money</button><button class="m-outline" data-action="budget-add">Add group</button></div><p class="m-footnote">Tap a group to adjust its allocation. Positive balances carry into the next month using your existing budget rules.</p>`;
  }
  const tools=[['planner','Scheduled transactions','calendar'],['reports','Reports','reports'],['categories','Categories','category'],['payees','Payees','people'],['tags','Tags','tag'],['currency','Currencies & rates','currency'],['sms','SMS staging','message'],['audit','Database audit','audit'],['settings','File preferences','settings']];
  function more() {
    return `<div class="m-section-line"><h2>Your file</h2><span class="m-muted">DIWAN 1.2.12 · Mobile 2</span></div>
      <button class="m-list-action" data-action="files">${icon('file')}<span>${escape(snapshot.fileName)}<small>${snapshot.dirty?'Changes need saving':'No unsaved document changes'}</small></span>${icon('chevron')}</button>
      <div class="m-section-line"><h2>Tools & preferences</h2></div>${tools.map(([id,label,glyph])=>`<button class="m-list-action" data-tool="${id}">${icon(glyph)}<span>${label}</span>${icon('chevron')}</button>`).join('')}
      <button class="m-list-action" data-action="theme">${icon('moon')}<span>Appearance<small>${escape(localStorage.getItem('diwan-mobile-theme')||'System')}</small></span>${icon('chevron')}</button>
      <p class="m-privacy">${icon('shield')} Your records stay on this device.<br>Only .diwan and .mmb finance files open in this app.</p>`;
  }
  function detail() {
    const row=mmex.mobileDetail(state.detail);if(!row){state.detail=null;return activity();}
    const transfer=row.TRANSCODE==='Transfer',income=row.TRANSCODE==='Deposit',tone=transfer?'transfer':income?'income':'expense';
    const field=(label,value)=>`<div class="m-detail-field"><dt>${label}</dt><dd dir="auto">${escape(value||'—')}</dd></div>`;
    return `<section class="m-detail-amount ${tone}"><span class="m-type-icon ${tone}">${icon(transfer?'activity':income?'income':'expense')}</span><span>${transfer?'Transfer':income?'Income':'Expense'}</span>${amount((income?'+':transfer?'':'−')+row.amount,row.code,tone)}<h2 dir="auto">${escape(row.PAYEENAME||(transfer?'Between accounts':'No payee'))}</h2></section>
      <dl class="m-detail-fields">${field('Date',localeDate(row.date))}${field(transfer?'From account':'Account',row.ACCOUNTNAME)}${transfer?field('To account',row.destination)+field('Received',row.destinationAmount+' '+row.destinationCode):''}${field('Category',row.splits.length?`${row.splits.length} splits`:row.CATEGORY_PATH)}${field('Status',({R:'Reconciled',V:'Void',F:'Follow up',D:'Duplicate'})[row.STATUS]||'Unreconciled')}${row.NOTES?field('Notes',row.NOTES):''}${row.tags.length?field('Tags',row.tags.join(' · ')):''}</dl>
      ${row.splits.length?`<section class="m-detail-splits"><h3>Splits</h3>${row.splits.map(s=>`<div><span dir="auto">${escape(s.name)}</span><strong class="m-money">${escape(s.amount)} ${escape(row.code)}</strong></div>`).join('')}</section>`:''}
      <div class="m-detail-actions"><button class="m-outline" data-action="duplicate">${icon('copy')} Duplicate</button><button class="m-filled" data-action="edit">${icon('edit')} Edit transaction</button></div>`;
  }
  function welcome() {
    return `<section class="m-welcome"><div class="m-welcome-brand">${icon('accounts')}<strong>DIWAN<span lang="ar">ديوان</span></strong></div><h2>A clear view of<br>your everyday money.</h2><p>Keep your accounts together. Record an expense in a few taps. Pick up where your file left off.</p><div class="m-welcome-actions"><button class="m-filled" data-action="open">${icon('folder')} Open finance file</button><button class="m-outline" data-action="folder">Choose working folder</button></div><p class="m-welcome-support">Opens .diwan and .mmb files</p><div class="m-welcome-note">${icon('shield')}<p><strong>Your file. Your device.</strong><br>No account or server is needed. Choose a folder to save changes and keep preferences beside your file.</p></div><p id="m-loading" class="m-muted" role="status">Preparing your workspace…</p></section>`;
  }
  function showTool(id) {
    const found=tools.find(t=>t[0]===id)||['budget','Budget setup'];
    state.detail=null;state.tool={id,label:found[1]};mmex.setView(id);refreshNow();$('#m-scroll').scrollTop=0;
  }
  function refreshNow() {
    if(!root||!window.mmex?.mobileSnapshot)return;
    const active=document.activeElement?.id,selection=active==='m-search-input'?document.activeElement.selectionStart:null;
    try {
      snapshot=mmex.mobileSnapshot(state.route==='home');
      if(snapshot.loaded&&!lastLoaded){state.route='activity';state.month=snapshot.today.slice(0,7);}
      lastLoaded=snapshot.loaded;header();
      $('#m-tools').hidden=!state.tool||!snapshot.loaded;$('#m-content').hidden=!!state.tool&&snapshot.loaded;
      if(!snapshot.loaded)$('#m-content').innerHTML=welcome();
      else if(!state.tool)$('#m-content').innerHTML=state.detail!==null?detail():({activity,accounts,home:overview,budget,more})[state.route]();
      if(active==='m-search-input'&&$('#m-search-input')){$('#m-search-input').focus({preventScroll:true});$('#m-search-input').setSelectionRange(selection,selection);}
      const ready=$('#m-loading');if(ready)ready.textContent=window.mmex?'Ready when you are.':'';
    } catch(error) {
      $('#m-content').innerHTML=empty('This view could not load',error.message,'retry','Try again');
      console.error(error);
    }
  }
  function refresh() {if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refreshNow();});}
  function sheet(title,body) {
    const dialog=$('#m-sheet');$('#m-sheet-title').textContent=title;$('#m-sheet-body').innerHTML=body;
    if(!dialog.open)dialog.showModal();
  }
  function closeSheet() {$('#m-sheet').close();}
  function editor(id=null) {
    closeSheet();mmex.openTransaction(id);if(id===null&&state.account){$('#tx-account').value=state.account;$('#tx-account').dispatchEvent(new Event('change',{bubbles:true}));}
    syncEditor();editorSnapshot=JSON.stringify([...$('#transaction-form').querySelectorAll('input,select,textarea')].map(i=>[i.id,i.value,i.checked]));
  }
  function syncEditor() {
    const type=$('#tx-type').value;
    document.querySelectorAll('[data-entry-type]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.entryType===type));
    $('#transaction-dialog').dataset.type=type;
    const currency=$('#m-entry-currency');if(currency){const a=mmex.mobileSnapshot().accounts.find(a=>String(a.ACCOUNTID)===$('#tx-account').value);currency.textContent=a?.code||'';}
    $('#transaction-title').textContent=$('#tx-id').value?'Edit transaction':'New transaction';
  }
  const actions={
    open:()=>mmex.openWithWriteAccess(),folder:()=>mmex.selectWorkingFolder(),retry:refresh,
    add:()=>editor(),edit:()=>editor(state.detail),duplicate:()=>{mmex.duplicateTransaction(state.detail);syncEditor();editorSnapshot=JSON.stringify([...$('#transaction-form').querySelectorAll('input,select,textarea')].map(i=>[i.id,i.value,i.checked]));},
    save:()=>snapshot.canSave?mmex.saveInPlace():mmex.downloadDatabase(),
    files:()=>sheet('Finance file',`<div class="m-sheet-file">${icon('file')}<div><strong dir="auto">${escape(snapshot?.fileName||'No file open')}</strong><small>${snapshot?.dirty?'Unsaved changes':'Saved document'}</small></div></div><button class="m-list-action" data-action="open">${icon('folder')}<span>Open another file<small>.diwan or .mmb</small></span></button><button class="m-list-action" data-action="folder">${icon('folder')}<span>Choose working folder</span></button>${snapshot?.loaded?`<button class="m-list-action" data-action="save">${icon('save')}<span>Save file</span></button><button class="m-list-action" data-action="export">${icon('copy')}<span>Save a copy</span></button><button class="m-list-action" data-action="period-files">${icon('file')}<span>Manage MMB period files</span></button>`:''}`),
    export:()=>mmex.downloadDatabase(),'period-files':()=>mmex.openFilesDialog(),
    accounts:()=>sheet('Choose account',`<button class="m-account-choice" data-account-filter="">All accounts ${state.account?'':icon('check')}</button>${snapshot.groups.map(g=>`<h3 class="m-sheet-group">${escape(g.name)}</h3>${g.items.map(a=>`<button class="m-account-choice" data-account-filter="${a.ACCOUNTID}"><span dir="auto">${escape(a.ACCOUNTNAME)}<small>${escape(a.code)}</small></span>${amount(a.amount,a.code)}${String(state.account)===String(a.ACCOUNTID)?icon('check'):''}</button>`).join('')}`).join('')}`),
    period:()=>sheet('Choose period',`<div class="m-period-choices"><button data-period="${snapshot.today.slice(0,7)}">This month</button><button data-period="${monthOffset(snapshot.today.slice(0,7),-1)}">Last month</button>${state.route!=='budget'?'<button data-period="">All dates</button>':''}</div><label class="m-month-field">Choose a month<input id="m-month-input" type="month" value="${state.month||snapshot.today.slice(0,7)}"></label><button class="m-filled" data-action="apply-month">Apply month</button>`),
    'apply-month':()=>{state.month=$('#m-month-input').value;state.offset=0;closeSheet();refresh();},
    'all-dates':()=>{state.month='';state.offset=0;refresh();},
    search:()=>{state.searching=!state.searching;refreshNow();$('#m-search-input')?.focus();},
    'clear-search':()=>{state.search='';state.offset=0;refresh();},
    next:()=>{state.offset+=50;refreshNow();$('#m-scroll').scrollTop=0;},previous:()=>{state.offset=Math.max(0,state.offset-50);refreshNow();$('#m-scroll').scrollTop=0;},
    'month-before':()=>{state.month=monthOffset(state.month||snapshot.today.slice(0,7),-1);refresh();},'month-after':()=>{state.month=monthOffset(state.month||snapshot.today.slice(0,7),1);refresh();},
    'add-account':()=>mmex.openAccountEditor(null),
    'budget-settings':()=>showTool('budget'),'budget-move':()=>{mmex.budgetMonth(state.month||snapshot.today.slice(0,7));mmex.budgetMove();},'budget-add':()=>mmex.budgetGroupEditor(),
    'allocate-save':()=>{try{mmex.mobileAllocate(state.month||snapshot.today.slice(0,7),$('#m-allocation-id').value,$('#m-allocation-value').value);closeSheet();refresh();}catch(error){$('#m-allocation-error').textContent=error.message;}},
    theme:()=>{const theme=localStorage.getItem('diwan-mobile-theme')||'system';sheet('Appearance',`<div class="m-period-choices">${['system','light','dark'].map(v=>`<button data-theme="${v}">${v[0].toUpperCase()+v.slice(1)} ${v===theme?icon('check'):''}</button>`).join('')}</div>`);},
    back:()=>back(),'close-sheet':closeSheet
  };
  function back() {
    if(state.detail!==null){state.detail=null;refresh();return true;}
    if(state.tool){state.tool=null;refresh();return true;}
    if(state.route!=='activity'){navigate('activity');return true;}
    if(state.account){state.account='';refresh();return true;}
    if(state.searching){state.searching=false;state.search='';refresh();return true;}
    return false;
  }
  function mount() {
    document.documentElement.classList.add('diwan-mobile');
    document.documentElement.dataset.mobileTheme=localStorage.getItem('diwan-mobile-theme')||'system';
    root=document.createElement('div');root.id='diwan-mobile';
    root.innerHTML=`<header id="m-header" class="m-header"></header><div id="m-save-state" class="m-save-state" role="status" hidden></div><main id="m-scroll"><div id="m-content"></div><div id="m-tools" hidden></div></main><button id="m-fab" data-action="add" aria-label="Add transaction" hidden></button><nav id="m-nav" aria-label="Main navigation" hidden></nav><dialog id="m-sheet"><div class="m-sheet-head"><h2 id="m-sheet-title"></h2>${button('close-sheet','Close','close')}</div><div id="m-sheet-body"></div></dialog>`;
    document.querySelectorAll('#app dialog').forEach(dialog=>document.body.append(dialog));
    const toasts=$('#toast-region');if(toasts)document.body.append(toasts);
    document.body.append(root);$('#m-tools').append($('#view-content'));
    const entryTabs=document.createElement('div');entryTabs.className='m-entry-types';entryTabs.setAttribute('role','group');entryTabs.setAttribute('aria-label','Transaction type');
    entryTabs.innerHTML=[['Withdrawal','Expense','expense'],['Deposit','Income','income'],['Transfer','Transfer','activity']].map(([type,label,glyph])=>`<button type="button" data-entry-type="${type}">${icon(glyph)}${label}</button>`).join('');
    $('#transaction-dialog .modal-body').prepend(entryTabs);
    const amountField=$('#tx-amount').closest('label');amountField.classList.add('m-entry-amount');entryTabs.after(amountField);
    const typeField=$('#tx-type').closest('label');typeField.hidden=true;
    $('#tx-notes').rows=3;$('#tx-amount').placeholder='0.00';$('#tx-amount').insertAdjacentHTML('afterend','<span id="m-entry-currency"></span>');
    const updateCurrency=()=>{const a=mmex.mobileSnapshot().accounts.find(a=>String(a.ACCOUNTID)===$('#tx-account').value);$('#m-entry-currency').textContent=a?.code||'';};
    $('#tx-account').addEventListener('change',updateCurrency);
    $('#transaction-dialog').addEventListener('close',updateCurrency);
    $('#transaction-dialog .modal-header [data-close]').innerHTML=icon('back');$('#transaction-dialog .modal-header [data-close]').setAttribute('aria-label','Back');
    $('#transaction-dialog .modal-header .eyebrow')?.remove();
    $('#transaction-dialog .modal-body').insertAdjacentHTML('beforeend','<p class="m-entry-save-note">Saving records the change in your open file. Tap Save file on the main screen to write it to storage.</p>');
    document.addEventListener('click',event=>{
      const target=event.target.closest('button');if(!target)return;
      if(target.dataset.entryType){$('#tx-type').value=target.dataset.entryType;$('#tx-type').dispatchEvent(new Event('change',{bubbles:true}));syncEditor();return;}
      if(!root.contains(target))return;
      if(target.dataset.route){navigate(target.dataset.route);return;}
      if(target.hasAttribute('data-detail')){state.detail=Number(target.dataset.detail);refreshNow();$('#m-scroll').scrollTop=0;return;}
      if(target.hasAttribute('data-type')){state.type=target.dataset.type;state.offset=0;refresh();return;}
      if(target.hasAttribute('data-account')||target.hasAttribute('data-account-filter')){const fromAccounts=target.hasAttribute('data-account');state.account=target.dataset.account??target.dataset.accountFilter;state.offset=0;if(fromAccounts){state.route='activity';state.month='';}closeSheet();refresh();return;}
      if(target.dataset.editAccount){mmex.openAccountEditor(Number(target.dataset.editAccount));return;}
      if(target.hasAttribute('data-period')){state.month=target.dataset.period;state.offset=0;closeSheet();refresh();return;}
      if(target.dataset.theme){localStorage.setItem('diwan-mobile-theme',target.dataset.theme);document.documentElement.dataset.mobileTheme=target.dataset.theme;closeSheet();refresh();return;}
      if(target.dataset.tool){closeSheet();showTool(target.dataset.tool);return;}
      if(target.dataset.allocate){const month=state.month||snapshot.today.slice(0,7),group=mmex.mobileBudget(month).groups.find(g=>g.id===target.dataset.allocate);sheet('Allocate to '+group.name,`<input id="m-allocation-id" type="hidden" value="${escape(group.id)}"><label class="m-month-field">Budgeted amount · ${escape(snapshot.code)}<input id="m-allocation-value" type="number" step="0.01" inputmode="decimal" value="${group.allocated}"></label><p id="m-allocation-error" class="m-error" role="alert"></p><button class="m-filled" data-action="allocate-save">Save allocation</button>`);return;}
      const action=target.dataset.action;if(actions[action]){if(!['files','accounts','period','theme','allocate-save','apply-month','close-sheet'].includes(action))closeSheet();Promise.resolve().then(actions[action]).catch(error=>{console.error(error);sheet('Could not complete action',`<p>${escape(error.message)}</p><button class="m-filled" data-action="close-sheet">Close</button>`);});}
    });
    root.addEventListener('input',event=>{if(event.target.id==='m-search-input'){state.search=event.target.value;state.offset=0;clearTimeout(searchTimer);searchTimer=setTimeout(refresh,180);}});
    const confirmDiscard=()=>!window.DiwanMobile?.editorDirty() || window.confirm('Discard this transaction draft? Your recorded transactions will stay unchanged.');
    document.addEventListener('click',event=>{if(event.target.closest('[data-close="transaction-dialog"]') && !confirmDiscard()){event.preventDefault();event.stopImmediatePropagation();}},true);
    $('#transaction-dialog').addEventListener('cancel',event=>{if(!confirmDiscard())event.preventDefault();});
    $('#transaction-dialog').addEventListener('close',()=>{editorSnapshot=null;refresh();});
    $('#tx-type').addEventListener('change',syncEditor);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){if(back())event.preventDefault();}});
    window.DiwanMobile={refresh,back,state,editorDirty:()=>!!editorSnapshot&&editorSnapshot!==JSON.stringify([...$('#transaction-form').querySelectorAll('input,select,textarea')].map(i=>[i.id,i.value,i.checked]))};
    refreshNow();
  }
  let attempts=0;
  const ready=setInterval(()=>{if(window.mmex?.mobileSnapshot){clearInterval(ready);mount();}else if(++attempts>300){clearInterval(ready);document.body.insertAdjacentHTML('afterbegin','<p role="alert">DIWAN could not start. Update Android System WebView and reopen the app.</p>');}},50);
})();
