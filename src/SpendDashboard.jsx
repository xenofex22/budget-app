import { useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineController, LineElement, PointElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { aggregateExpenses, breakdownCsv, budgetCycleForDate, dubaiDateTime, mapDailyExpense, EXPENSE_CATEGORIES, EXPENSE_DETAILS } from './spendAnalytics.mjs';
import useSpendReviews from './useSpendReviews';
import './spend-dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineController, LineElement, PointElement);
const COLORS = { 'Groceries': '#147d64', 'Food & drink': '#4f46b8', 'Alcohol': '#a3397c', 'Transport': '#2176a5',
  'Household': '#9c601e', 'Health': '#b54343', 'Personal care': '#8764b5', 'Shopping': '#b36b16',
  'Family': '#177e92', 'Subscriptions': '#657326', 'Needs review': '#697586', 'Fitness': '#436b35', 'Bills': '#576583', 'Fees': '#9c5035', 'Travel': '#3c7a7f', 'Entertainment': '#88406b', 'Other': '#67707e' };
const money = (value, currency) => `${currency} ${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = date => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const PAGE_SIZE = 25;

export default function SpendDashboard({ transactions, loading, currency: preferredCurrency = 'AED', trackingStartedAt }) {
  const review = useSpendReviews();
  const mapped = useMemo(() => transactions.map(item => mapDailyExpense(item, review.reviews[item.id])).filter(Boolean), [transactions, review.reviews]);
  const tableRef = useRef(null);
  const editorRef = useRef(null);
  const [editingRow, setEditingRow] = useState(null);
  const [draftCategory, setDraftCategory] = useState('');
  const [draftDetail, setDraftDetail] = useState('');
  const [detail, setDetail] = useState('');
  const today = dubaiDateTime(new Date().toISOString()).date;
  const currentCycle = budgetCycleForDate(today);
  const [period, setPeriod] = useState(currentCycle.key);
  const [currency, setCurrency] = useState(preferredCurrency);
  const [startDate, setStartDate] = useState(currentCycle.start);
  const [endDate, setEndDate] = useState(today);
  const [category, setCategory] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const cycles = useMemo(() => {
    const result = new Map([[currentCycle.key, currentCycle]]);
    mapped.forEach(row => { const cycle = budgetCycleForDate(row.localDate); result.set(cycle.key, cycle); });
    return [...result.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [mapped, currentCycle.key, currentCycle.start, currentCycle.end, currentCycle.label]);
  const currencies = [...new Set([preferredCurrency, ...mapped.map(row => row.currency)])].sort();
  const cycle = cycles.find(item => item.key === period);
  const start = period === 'all' ? '' : period === 'custom' ? startDate : cycle?.start || '';
  const end = period === 'all' ? '' : period === 'custom' ? endDate : cycle?.key === currentCycle.key ? today : cycle?.end || '';
  const invalidRange = period === 'custom' && (!start || !end || start > end);
  const trackingStart = dubaiDateTime(trackingStartedAt)?.date || '';
  const summary = useMemo(() => aggregateExpenses(mapped, { currency, start, end, trackingStart }), [mapped, currency, start, end, trackingStart]);
  const tableRows = summary.rows.filter(row => (!category || row.category === category) && (!detail || row.subcategory === detail) && (!reviewOnly || row.needsReview)
    && `${row.merchant} ${row.category} ${row.subcategory}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = tableRows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const invalidCount = transactions.filter(item => item.classification === 'daily_spend').length - mapped.length;
  const chartCategories = summary.categories.filter(item => item.total > 0);
  const chartOptions = { responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${money(ctx.raw, currency)}` } } } };
  function changeScope(update) { update(); setPage(0); setCategory(''); setDetail(''); setReviewOnly(false); setEditingRow(null); }
  function reviewRows(selectedCategory = '', selectedDetail = '', onlyUnreviewed = true) {
    setCategory(selectedCategory); setDetail(selectedDetail); setReviewOnly(onlyUnreviewed); setSearch(''); setPage(0);
    tableRef.current?.scrollIntoView({ block: 'start' });
  }
  function edit(row) {
    setEditingRow(row); setDraftCategory(row.category === 'Needs review' ? '' : row.category);
    setDraftDetail(row.category === 'Needs review' ? '' : row.subcategory);
    setTimeout(() => editorRef.current?.focus(), 0);
  }
  async function saveEdit(event) {
    event.preventDefault();
    if (await review.save(editingRow, draftCategory, draftDetail)) setEditingRow(null);
  }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([breakdownCsv(tableRows)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `daily-spend-breakdown-${period}-${currency}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  return <div className="spend-dashboard" aria-label="Daily spending dashboard">
    <div className="spend-dashboard-heading">
      <div><h3>Where your daily spend goes</h3><p>Daily Spend only · Dubai time · Categories are estimates where marked.</p></div>
      <button type="button" onClick={exportCsv} disabled={!tableRows.length || invalidRange || loading || review.loading || Boolean(review.error)}>Download breakdown CSV</button>
    </div>
    <div className="spend-filters">
      <label>Period<select value={period} onChange={e => changeScope(() => setPeriod(e.target.value))}>
        {cycles.map(item => <option key={item.key} value={item.key}>{item.label} cycle</option>)}
        <option value="all">All available dates</option><option value="custom">Custom dates</option>
      </select></label>
      <label>Currency<select value={currency} onChange={e => changeScope(() => setCurrency(e.target.value))}>
        {currencies.map(value => <option key={value}>{value}</option>)}
      </select></label>
      {period === 'custom' && <><label>From<input type="date" value={startDate} onChange={e => changeScope(() => setStartDate(e.target.value))} /></label>
        <label>To<input type="date" value={endDate} onChange={e => changeScope(() => setEndDate(e.target.value))} /></label></>}
    </div>
    <p className="spend-scope">{start && end ? `${shortDate(start)} – ${shortDate(end)} ${end.slice(0, 4)}` : 'All available dates'} · Currencies are shown separately.</p>
    {review.error && <div role="alert" className="spend-notice">{review.error} <button type="button" disabled={Boolean(review.busyId)} onClick={review.reload}>Reload saved reviews</button></div>}
    {review.message && <p role="status" className="spend-review-success">{review.message}</p>}
    {review.loading && <p role="status">Loading your saved category reviews…</p>}
    {invalidCount > 0 && <p role="status" className="spend-notice">{invalidCount} daily-spend record(s) have an invalid date or amount and cannot be charted.</p>}
    {loading || review.loading ? <p role="status">Loading spending breakdown…</p> : invalidRange ? <p role="alert">Choose a valid start and end date, with From on or before To.</p> : !summary.rows.length ?
      <div className="spend-empty"><h4>No daily spend in this period</h4><p>Choose another cycle or All available dates to see your breakdown.</p></div> : <>
      <div className="spend-stats" aria-label="Spending summary">
        <div><span>Total daily spend</span><strong>{money(summary.total, currency)}</strong><small>{summary.rows.length} transactions</small></div>
        <div><span>Daily average</span><strong>{money(summary.average, currency)}</strong><small>{summary.dayCount} tracked days ({shortDate(summary.trackingStart)} – {shortDate(summary.trackingEnd)}), including zero-spend days</small></div>
        <div><span>Needs your review</span><strong>{money(summary.reviewTotal, currency)}</strong><small>{summary.reviewCount} transactions to check</small><button type="button" disabled={!summary.reviewCount} onClick={() => reviewRows()}>Review transactions</button></div>
      </div>
      <div className="spend-chart-grid">
        <section className="spend-panel"><h4>Spend by category</h4>
          {summary.total > 0 ? <div className="spend-chart"><Doughnut role="img" aria-label="Daily spending by category; exact amounts are in the category table below"
            data={{ labels: chartCategories.map(item => item.name), datasets: [{ data: chartCategories.map(item => item.total), backgroundColor: chartCategories.map(item => COLORS[item.name] || '#697586'), borderWidth: 2, borderColor: '#ffffff' }] }}
            options={{ ...chartOptions, cutout: '62%', onClick: (_, elements) => { if (elements.length) { setCategory(chartCategories[elements[0].index].name); setPage(0); } } }} /></div> : <p>All recorded amounts are zero.</p>}
          <div className="spend-table-scroll"><table><caption className="sr-only">Category totals</caption><thead><tr><th>Category</th><th>Amount</th><th>Share</th></tr></thead>
            <tbody>{summary.categories.map(item => <tr key={item.name}><td><button className="spend-category-button" type="button" aria-pressed={category === item.name} onClick={() => { setCategory(category === item.name ? '' : item.name); setPage(0); }}>
              <span className="spend-swatch" style={{ backgroundColor: COLORS[item.name] || '#697586' }} />{item.name}</button></td><td>{money(item.total, currency)}</td><td>{summary.total ? `${(item.total / summary.total * 100).toFixed(1)}%` : '0%'}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="spend-panel"><h4>Daily spending</h4><p className="spend-chart-key">Purple bars: daily spend · Dashed line: period average {money(summary.average, currency)}</p><div className="spend-chart"><Bar role="img" aria-label={`Daily spending and period average ${money(summary.average, currency)}; exact daily amounts are below`}
          data={{ labels: summary.daily.map(item => shortDate(item.date)), datasets: [
            { type: 'bar', label: 'Daily spend', data: summary.daily.map(item => item.total), backgroundColor: '#4f46b8', maxBarThickness: 28, order: 1 },
            { type: 'line', label: 'Period average', data: summary.daily.map(() => summary.average), borderColor: '#ad530c', backgroundColor: '#ad530c', borderWidth: 3, borderDash: [7, 4], pointRadius: 0, pointHoverRadius: 3, fill: false, order: 0 }
          ] }}
          options={{ ...chartOptions, plugins: { ...chartOptions.plugins, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${money(ctx.raw, currency)}` } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, title: { display: true, text: currency } } } }} /></div>
          <details><summary>View daily totals</summary><div className="spend-table-scroll spend-daily-totals"><table><caption className="sr-only">Daily totals in Dubai time</caption><thead><tr><th>Date</th><th>Amount</th></tr></thead><tbody>
            {summary.daily.map(item => <tr key={item.date}><td>{item.date}</td><td>{money(item.total, currency)}</td></tr>)}
          </tbody></table></div></details>
          <h4 className="spend-detail-heading">Expense detail</h4><div className="spend-table-scroll"><table><caption className="sr-only">Totals by subcategory</caption><thead><tr><th>Subcategory</th><th>Amount</th></tr></thead><tbody>
            {summary.subcategories.map(item => <tr key={item.name}><td><button type="button" onClick={() => reviewRows(item.category, item.subcategory, false)}>{item.subcategory}</button><small className="spend-muted">{item.category}</small></td><td>{money(item.total, currency)}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>
      <section ref={tableRef} className="spend-panel spend-transactions"><h4>Transaction breakdown & category review</h4>
        <p className="spend-muted">Confirm an estimate or choose a different category. Each choice is saved to your account for this transaction.</p>
        <div className="spend-filters"><label>Category<select value={category} onChange={e => { setCategory(e.target.value); setDetail(''); setPage(0); }}><option value="">All categories</option>{[...new Set([category, ...summary.categories.map(item => item.name)])].filter(Boolean).map(name => <option key={name}>{name}</option>)}</select></label>
          <label>Search<input type="search" placeholder="Merchant or category" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
          <label className="spend-review-toggle"><input type="checkbox" checked={reviewOnly} onChange={e => { setReviewOnly(e.target.checked); setPage(0); }} />Needs review only</label>
        </div>
        {detail && <p className="spend-muted">Detail: {detail} <button type="button" onClick={() => setDetail('')}>Clear detail filter</button></p>}
        {editingRow && <form className="spend-review-editor" onSubmit={saveEdit} aria-label="Edit transaction category">
          <h4>Choose category: {editingRow.normalizedMerchant || 'Unknown merchant'}</h4><p>{editingRow.localDate} · {money(editingRow.amount, editingRow.currency)}</p>
          <div className="spend-filters"><label>New category<select ref={editorRef} required value={draftCategory} onChange={e => { setDraftCategory(e.target.value); setDraftDetail(''); }}><option value="">Choose a category</option>{EXPENSE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Detail / subcategory<input required maxLength={80} list="expense-review-details" value={draftDetail} onChange={e => setDraftDetail(e.target.value)} placeholder="e.g. Lunch, Coffee, Groceries" /></label>
            <datalist id="expense-review-details">{EXPENSE_DETAILS(draftCategory).map(value => <option key={value} value={value} />)}</datalist>
          </div><p className="spend-muted">This transaction only. Your existing merchant rules stay unchanged.</p>
          <div className="spend-review-actions"><button type="submit" disabled={Boolean(review.busyId) || review.loading || !draftCategory || !draftDetail.trim()}>Save category</button><button type="button" disabled={Boolean(review.busyId)} onClick={() => setEditingRow(null)}>Cancel</button></div>
        </form>}
        <p className="spend-muted">{tableRows.length} matching transactions. CSV export uses these filters.</p>
        <div className="spend-table-scroll"><table><caption className="sr-only">Mapped daily-spend transactions</caption><thead><tr><th>Dubai date / time</th><th>Merchant</th><th>Category / detail</th><th>Amount</th><th>Confidence / reason</th></tr></thead><tbody>
          {visibleRows.map((row, i) => <tr key={row.id || `${row.occurredAt}-${i}`}><td>{row.localDate}<small className="spend-muted">{row.source === 'manual-web' ? 'Manual date' : row.localTime}</small></td>
            <td>{row.normalizedMerchant || 'Unknown merchant'}</td><td>{row.category}<small className="spend-muted">{row.subcategory}</small></td><td>{money(row.amount, currency)}</td>
            <td><span className={row.needsReview ? 'spend-confidence-low' : ''}>{row.confidence}{row.needsReview ? ' · Check' : ''}</span><details><summary>Why?</summary><p>{row.mappingReason}</p></details>
              <div className="spend-review-actions">
                {row.confidence !== 'Confirmed' && row.category !== 'Needs review' && <button type="button" disabled={Boolean(review.busyId) || review.loading || Boolean(review.error)} onClick={() => review.save(row, row.category, row.subcategory)}>Confirm category</button>}
                <button type="button" disabled={Boolean(review.busyId) || review.loading || Boolean(review.error)} onClick={() => edit(row)}>{row.category === 'Needs review' ? 'Choose category' : 'Change category'}</button>
                {row.confidence === 'Confirmed' && <button type="button" disabled={Boolean(review.busyId) || review.loading} onClick={() => review.save(row, '', '', true)}>Reset estimate</button>}
                {review.busyId === row.id && <span role="status">Saving…</span>}
              </div></td></tr>)}
        </tbody></table></div>
        {!tableRows.length && <p>No transactions match these filters.</p>}
        <div className="spend-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div>
      </section>
      <details className="spend-method"><summary>How categories are estimated</summary><p>Noon and Amazon up to AED 400 default to groceries; larger purchases need review. Explicit memberships stay subscriptions. ANE Meydan is alcohol.</p>
        <p>Weekday supermarket purchases from 12:00–12:59 Dubai time, between AED 10 and AED 80, are likely lunch. Manual entries do not use the noon timestamp as evidence.</p>
        <p>High confidence means a clear descriptor or confirmation. Medium is an estimate or your grocery default. Low needs checking. Confirmed means you reviewed that transaction. Saved reviews do not change your merchant rules.</p></details>
    </>}
  </div>;
}
