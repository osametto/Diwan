// Runs inside the original engine's closure. Money and writes use its existing rules.
function mobileSnapshot(includeOverview = false) {
  if (!db) return { loaded: false };
  const info = accountCurrencyInfo();
  const list = accountBalances().filter(isVisibleAccount).map(account => {
    const currency = info.byId.get(n(account.CURRENCYID));
    const rate = n(account.CURRENCYID) === info.baseId ? 1 : Number(currency?.BASECONVRATE);
    return { ...account, code: currency?.CURRENCY_SYMBOL || '?', amount: formatAmount(account.BALANCE),
      baseBalance: info.base && Number.isFinite(rate) && rate > 0 ? account.BALANCE * rate : null };
  });
  const total = list.some(a => a.baseBalance === null) ? null : list.reduce((sum,a) => sum + a.baseBalance, 0);
  return { loaded: true, fileName, dirty: dirtyCount + archives.filter(a=>a.dirty).length,
    canSave: !!currentFileHandle, today: localDate(), code: info.base?.CURRENCY_SYMBOL || '',
    total: total === null ? null : formatAmount(total),
    groups: [...groupedVisibleAccounts(list)].map(([name,items])=>({name,items})),
    accounts: list, categories: categories.map(c=>({id:c.CATEGID,name:c.path})),
    overview: includeOverview ? homeData() : null };
}

function mobileTransactions(options = {}) {
  if (!db) return { items: [], total: 0 };
  const previous = transactionFilters;
  transactionFilters = { search: options.search || '', category: '', payee: '', tag: '',
    type: options.type || '', account: String(options.account || ''), date: '' };
  try {
    const query = transactionQuery(false), count = transactionQuery(true);
    const sort = query.sql.lastIndexOf(' ORDER BY ');
    let sql = query.sql.slice(0,sort), countSql = count.sql;
    const params = [...query.params];
    if (/^\d{4}-\d{2}$/.test(options.month || '')) {
      sql += ' AND substr(t.TRANSDATE,1,7)=?'; countSql += ' AND substr(t.TRANSDATE,1,7)=?';
      params.push(options.month);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(options.through || '')) {
      sql += ' AND substr(t.TRANSDATE,1,10)<=?'; countSql += ' AND substr(t.TRANSDATE,1,10)<=?'; params.push(options.through);
    }
    const total = n(scalar(countSql,params));
    const offset = Math.max(0, Math.trunc(Number(options.offset) || 0));
    const items = rows(sql + ' ORDER BY t.TRANSDATE DESC,t.TRANSID DESC LIMIT 50 OFFSET ?', [...params,offset]);
    const info = accountCurrencyInfo();
    return { total, items: items.map(row => {
      const account = accounts.find(a=>n(a.ACCOUNTID)===n(row.ACCOUNTID));
      const destination = accounts.find(a=>n(a.ACCOUNTID)===n(row.TOACCOUNTID));
      const incoming = row.TRANSCODE === 'Transfer' && n(options.account) === n(row.TOACCOUNTID);
      const currencyId = incoming ? destination?.CURRENCYID : account?.CURRENCYID;
      const amount = incoming ? n(row.TOTRANSAMOUNT ?? row.TRANSAMOUNT) : n(row.TRANSAMOUNT);
      return { ...row, date: String(row.TRANSDATE).slice(0,10), incoming,
        amount: formatAmount(amount), code: info.byId.get(n(currencyId))?.CURRENCY_SYMBOL || '?',
        destination: destination?.ACCOUNTNAME || '', destinationAmount: formatAmount(n(row.TOTRANSAMOUNT ?? row.TRANSAMOUNT)),
        destinationCode: info.byId.get(n(destination?.CURRENCYID))?.CURRENCY_SYMBOL || '?' };
    }) };
  } finally { transactionFilters = previous; }
}

function mobileDetail(id) {
  if (!db) return null;
  const row = rows(`${CATEGORY_CTE} SELECT t.*,p.PAYEENAME,c.path AS CATEGORY_PATH,a.ACCOUNTNAME,a.CURRENCYID
    FROM CHECKINGACCOUNT_V1 t LEFT JOIN PAYEE_V1 p ON p.PAYEEID=t.PAYEEID
    LEFT JOIN category_tree c ON c.CATEGID=t.CATEGID
    JOIN ACCOUNTLIST_V1 a ON a.ACCOUNTID=t.ACCOUNTID WHERE t.TRANSID=?`,[Number(id)])[0];
  if (!row) return null;
  const info = accountCurrencyInfo(), destination = accounts.find(a=>n(a.ACCOUNTID)===n(row.TOACCOUNTID));
  return { ...row, date: String(row.TRANSDATE).slice(0,10), amount: formatAmount(row.TRANSAMOUNT),
    code: info.byId.get(n(row.CURRENCYID))?.CURRENCY_SYMBOL || '?', destination: destination?.ACCOUNTNAME || '',
    destinationAmount: formatAmount(n(row.TOTRANSAMOUNT ?? row.TRANSAMOUNT)),
    destinationCode: info.byId.get(n(destination?.CURRENCYID))?.CURRENCY_SYMBOL || '?',
    splits: tableExists('SPLITTRANSACTIONS_V1') ? rows('SELECT * FROM SPLITTRANSACTIONS_V1 WHERE TRANSID=?',[Number(id)]).map(s=>({...s,name:categories.find(c=>n(c.CATEGID)===n(s.CATEGID))?.path || 'No category',amount:formatAmount(s.SPLITTRANSAMOUNT)})) : [],
    tags: tableExists('TAGLINK_V1') ? rows("SELECT t.TAGNAME FROM TAG_V1 t JOIN TAGLINK_V1 l ON l.TAGID=t.TAGID WHERE l.REFTYPE='Transaction' AND l.REFID=?",[Number(id)]).map(t=>t.TAGNAME) : [] };
}

function mobileBudget(month) {
  const b = computeBudget(month), code = accountCurrencyInfo().base?.CURRENCY_SYMBOL || '';
  return { month: b.month, code, available: formatAmount(b.available), availableValue:b.available,
    allocated:formatAmount(b.allocated), groups:companion.budget.groups.map(group=>{
      const allocated=n(companion.budget.months[b.month]?.[group.id]);
      return { id:group.id,name:group.name,allocated,allocatedText:formatAmount(allocated),
        spent:formatAmount(n(b.spending[group.id])),balance:n(b.balances[group.id]),balanceText:formatAmount(n(b.balances[group.id])),
        ratio:allocated>0?Math.min(1,Math.max(0,n(b.spending[group.id])/allocated)):0 };
    }) };
}

function mobileAllocate(month,id,value) {
  budgetCategorySave(month,id,value);
  render();
}
