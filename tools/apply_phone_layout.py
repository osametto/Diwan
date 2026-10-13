#!/usr/bin/env python3
"""Add the phone-only layout to the already wrapped Android Studio assets."""
import base64,gzip,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def replace_once(s,a,b):
    if s.count(a)!=1:raise ValueError('Unrecognized source hook: '+a[:80])
    return s.replace(a,b,1)
mobile=r'''
  function phoneTransactionsHtml(list){
    let previous='';return list.map(r=>{const date=String(r.TRANSDATE||'').slice(0,10),heading=date!==previous?`<div class="phone-date">${h(date)}${date>localDate()?' · Future':''}</div>`:'';previous=date;return heading+phoneTransactionRow(r);}).join('');
  }
  function phoneTransactionRow(r){
    const incoming=r.TRANSCODE==='Transfer'&&transactionFilters.account&&n(transactionFilters.account)===n(r.TOACCOUNTID);
    const amount=incoming?n(r.TOTRANSAMOUNT??r.TRANSAMOUNT):n(r.TRANSAMOUNT);
    const flow=r.TRANSCODE==='Deposit'||incoming?'deposit':r.TRANSCODE==='Withdrawal'?'withdrawal':'';
    const category=n(r.SPLIT_COUNT)>0?`${r.SPLIT_COUNT} splits`:(r.CATEGORY_PATH||'No category');
    const type=r.TRANSCODE==='Deposit'?'income':r.TRANSCODE==='Transfer'?'transfer':'expense';
    const destination=r.TRANSCODE==='Transfer'?accounts.find(a=>n(a.ACCOUNTID)===n(r.TOACCOUNTID))?.ACCOUNTNAME:'';
    return `<article class="transaction-card phone-tx ${n(r.TRANSID)===n(inspectedTransactionId)?'selected-row':''}" data-id="${r.TRANSID}" tabindex="0" onclick="mmex.inspectTransaction(${r.TRANSID})" onkeydown="if(event.key==='Enter')mmex.inspectTransaction(${r.TRANSID})"><div class="phone-tx-icon ${type}" aria-label="${h(r.TRANSCODE)}">${type==='income'?'+':type==='transfer'?'↔':'−'}</div><div class="phone-tx-main"><strong dir="auto">${h(r.PAYEENAME||(type==='transfer'?'Transfer':'No payee'))}</strong><div class="phone-tx-category" dir="auto">${h(category)}</div>${r.NOTES?`<div class="phone-tx-note" dir="auto">${h(r.NOTES)}</div>`:''}${r.TAG_NAMES?.length?`<div class="phone-tx-tags" dir="auto">${r.TAG_NAMES.map(h).join(' · ')}</div>`:''}</div><div class="phone-tx-money"><strong class="amount ${flow}">${flowAmount(amount,flow==='deposit'?'in':(r.TRANSCODE==='Withdrawal'||(r.TRANSCODE==='Transfer'&&transactionFilters.account))?'out':'')}</strong><small dir="auto">${h(r.ACCOUNTNAME)}${destination?' → '+h(destination):''}</small>${transactionFilters.account?`<small>Balance ${runningBalanceText(r)}</small>`:''}<input class="checkbox" type="checkbox" aria-label="Select transaction ${r.TRANSID}" ${selected.has(n(r.TRANSID))?'checked':''} onclick="event.stopPropagation()" onchange="mmex.toggleSelect(${r.TRANSID},this.checked)"></div></article>`;
  }
'''
def patch(match):
    js=gzip.decompress(base64.b64decode(match.group(1))).decode()
    if 'function renderTransactions()' not in js:return match.group(0)
    js=replace_once(js,'const mobileCards = list.map(transactionCard).join("");','const mobileCards = window.MMEXPhone?.active()?phoneTransactionsHtml(list):list.map(transactionCard).join("");')
    js=replace_once(js,'  function transactionCard(r) {',mobile+'\n  function transactionCard(r) {')
    js=replace_once(js,'window.mmex = {','window.mmex = {\n    phoneState:()=>({view:currentView,fileName,loaded:!!db,dirtyCount}),phoneRerender:()=>render(),')
    js=replace_once(js,'enhanceDropdowns(true);prepareListLayout();','enhanceDropdowns(true);prepareListLayout();if(window.MMEXPhone)MMEXPhone.refresh();')
    return '<script type="application/x-mmex-gzip">'+base64.b64encode(gzip.compress(js.encode(),mtime=0)).decode()+'</script>'
p=ROOT/'app/src/main/assets/index.html'
s=p.read_text()
if 'phone.css' in s:raise SystemExit('Phone layout is already applied.')
s=re.sub(r'<script type="application/x-mmex-gzip">([^<]+)</script>',patch,s)
s=replace_once(s,'<head>','<head>\n  <script defer src="phone.js"></script>')
s=replace_once(s,'</head>','  <link rel="stylesheet" href="phone.css">\n</head>')
p.write_text(s)
print('Phone layout applied without changing database or companion logic.')
