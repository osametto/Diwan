/* Visual/layout fixtures use sample values only; no MMB is opened or changed. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets');
const html=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const payload=[...html.matchAll(/<script type="application\/x-mmex-gzip">([^<]+)<\/script>/g)].map(m=>zlib.gunzipSync(Buffer.from(m[1],'base64')).toString()).find(s=>s.includes('function phoneTransactionsHtml'));
const functions=payload.slice(payload.indexOf('  function phoneTransactionsHtml'),payload.indexOf('  function transactionCard'));
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context={h,n:v=>Number(v)||0,localDate:()=> '2026-10-12',transactionFilters:{account:''},accounts:[{ACCOUNTID:2,ACCOUNTNAME:'Savings'}],selected:new Set(),inspectedTransactionId:null,flowAmount:(n,flow)=>(flow==='in'?'+':flow==='out'?'−':'')+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),runningBalanceText:()=> '8,240.50'};
vm.createContext(context);vm.runInContext(functions,context);
const fixture=[
 {TRANSID:1,TRANSDATE:'2026-10-12',TRANSCODE:'Withdrawal',TRANSAMOUNT:124.75,PAYEENAME:'Local supermarket',CATEGORY_PATH:'Household › Groceries',ACCOUNTNAME:'Current account',NOTES:'Weekly groceries',TAG_NAMES:['Family']},
 {TRANSID:2,TRANSDATE:'2026-10-12',TRANSCODE:'Transfer',TRANSAMOUNT:1500,PAYEENAME:'Savings transfer',CATEGORY_PATH:'Transfer',ACCOUNTNAME:'Current account',TOACCOUNTID:2,NOTES:'Monthly savings'},
 {TRANSID:3,TRANSDATE:'2026-10-11',TRANSCODE:'Deposit',TRANSAMOUNT:12500,PAYEENAME:'Salary',CATEGORY_PATH:'Income › Salary',ACCOUNTNAME:'Current account',NOTES:'Monthly salary'},
 {TRANSID:4,TRANSDATE:'2026-10-10',TRANSCODE:'Withdrawal',TRANSAMOUNT:985.5,PAYEENAME:'متجر المستلزمات المنزلية',CATEGORY_PATH:'المصاريف المنزلية › مستلزمات',ACCOUNTNAME:'الحساب الجاري',NOTES:'هذا نص عربي طويل للتحقق من التفاف النص وعدم خروج المحتوى من الشاشة.'},
 {TRANSID:5,TRANSDATE:'2026-10-09',TRANSCODE:'Withdrawal',TRANSAMOUNT:34.5,PAYEENAME:'Coffee shop with a deliberately longer payee name',CATEGORY_PATH:'Food › Coffee',ACCOUNTNAME:'Wallet',NOTES:'Sample data for checking the mobile layout.'},
];
const rows=context.phoneTransactionsHtml(fixture);
const previews=path.resolve(process.env.PHONE_PREVIEW_DIR||path.join(root,'previews'));fs.mkdirSync(previews,{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-zygote','--single-process','--in-process-gpu']});
 const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://studio.test/**',route=>{const p=path.join(assets,new URL(route.request().url()).pathname.slice(1));if(fs.existsSync(p))route.fulfill({path:p,contentType:p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html'});else route.fulfill({status:404,body:''});});
 try{
  await page.goto('https://studio.test/index.html');await page.waitForFunction(()=>window.mmex&&window.MMEXPhone);
  await page.evaluate(rows=>{
   window.layoutSampleView='transactions';mmex.phoneState=()=>({view:layoutSampleView,fileName:'Sample data · layout check',loaded:true,dirtyCount:0});
   document.getElementById('welcome-view').classList.add('hidden');document.getElementById('workspace').classList.remove('hidden');
   document.getElementById('view-content').innerHTML=`<header class="view-header"><h1>Transactions</h1></header><div class="toolbar"><div class="search-wrap"><input id="tx-search" placeholder="Search transactions"></div><select><option>All accounts</option></select><button class="button">Apply filters</button></div><section class="data-panel"><div class="table-wrap"><table><tr><td>Desktop only</td></tr></table></div><div class="mobile-cards">${rows}</div></section>`;
   MMEXPhone.refresh();
  },rows);
  await page.waitForTimeout(120);
  const widths=[320,360,412,600,740],checks=[];
  for(const width of widths){await page.setViewportSize({width,height:915});await page.waitForTimeout(80);const dimensions=await page.evaluate(()=>({screen:innerWidth,page:document.documentElement.scrollWidth}));assert(dimensions.page<=width+1,JSON.stringify(dimensions));checks.push(`Transaction screen fits ${width}px viewport without page-level horizontal overflow.`);}
  await page.setViewportSize({width:412,height:915});await page.screenshot({path:path.join(previews,'Transactions.png')});
  assert.equal(await page.locator('.phone-date').count(),4);checks.push('Transaction rows are grouped under four date headings.');
  assert.equal(await page.locator('.phone-tx').count(),5);checks.push('All five sample rows, including Arabic and long payee names, remain present.');
  await page.locator('.phone-filter-box>summary').click();assert.equal(await page.locator('#tx-search').isVisible(),true);checks.push('Search/filter disclosure opens to reachable controls.');
  await page.evaluate(()=>{
   window.layoutSampleView='budget';document.getElementById('view-content').innerHTML=`<div class="actual-budget-toolbar"><h1>Budget</h1><button class="button">Budget tools</button></div><div class="actual-month-navigation"><button>‹</button><input type="month" value="2026-10"><button>›</button></div><div class="actual-budget-scroll"><div><div class="actual-budget-grid"><div></div><article class="actual-month-card" data-budget-month="2026-10"><div class="actual-month-title">October 2026</div><div class="actual-month-totals"><span>4,250.00</span><span>Available funds</span></div><div class="actual-to-budget">To budget <strong>1,400.00</strong></div></article><article class="actual-month-card" data-budget-month="2026-11"><div class="actual-month-title">November 2026</div></article></div><table class="actual-table"><thead><tr><th>Category</th></tr></thead><tbody>${['Household','Transport','Food','Utilities'].map((name,i)=>`<tr class="actual-group-row"><td><div class="actual-group-name"><button>${name}</button><button>⋮</button></div></td><td class="budget-cell"><button>${1200-i*200}.00</button></td><td>${320-i*50}.00</td><td>${880-i*150}.00</td><td>1100.00</td><td>0.00</td><td>1100.00</td></tr>`).join('')}</tbody></table></div></div>`;MMEXPhone.refresh();
  });await page.waitForTimeout(100);
  await page.evaluate(()=>document.querySelector('.actual-budget-scroll>div').style.setProperty('--month-count','2'));
  assert.equal(await page.locator('.actual-month-card:visible').count(),1);checks.push('Budget shows one selected month without discarding other month data.');
  await page.locator('.phone-budget-switch button').nth(1).click();assert.equal(await page.locator('.actual-month-card:visible').getAttribute('data-budget-month'),'2026-11');checks.push('Month tabs switch the budget columns and summary together.');
  await page.locator('.phone-budget-switch button').first().click();
  for(const width of [320,360,412]){await page.setViewportSize({width,height:915});await page.waitForTimeout(60);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push(`Budget screen fits ${width}px without page-level horizontal overflow.`);}
  await page.setViewportSize({width:412,height:915});await page.screenshot({path:path.join(previews,'Budget.png')});
  await page.evaluate(()=>{document.getElementById('tx-amount').value='124.75';document.getElementById('tx-notes').value='Sample transaction';document.getElementById('transaction-title').textContent='Add transaction';document.getElementById('transaction-dialog').showModal();});
  await page.waitForTimeout(100);assert.equal(await page.locator('.phone-type-buttons button').count(),3);await page.locator('.phone-type-buttons button').nth(2).click();assert.equal(await page.locator('#tx-type').inputValue(),'Transfer');checks.push('Expense/Income/Transfer buttons update the original form type.');
  await page.locator('.phone-type-buttons button').first().click();
  const bounds=await page.locator('#transaction-dialog').boundingBox();assert(Math.abs(bounds.width-412)<2&&Math.abs(bounds.height-915)<2);checks.push('Transaction editor occupies the phone viewport.');
  await page.screenshot({path:path.join(previews,'Editor.png')});
  assert.deepEqual(errors,[]);checks.push('No JavaScript errors during startup and tested phone interactions.');
  const result={passed:checks.length,checks,limitations:['Layout uses sample render fixtures, not a live MMB.', 'Chromium headless checks do not exercise Android SAF, physical keyboards, or device-specific WebView behavior.']};fs.writeFileSync(path.join(root,'PHONE-LAYOUT-TEST-RESULTS.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
