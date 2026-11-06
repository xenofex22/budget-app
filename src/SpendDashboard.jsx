import { useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { aggregateExpenses, breakdownCsv, budgetCycleForDate, dubaiDateTime, mapDailyExpense } from './spendAnalytics.mjs';
import './spend-dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);
const COLORS = { 'Groceries': '#147d64', 'Food & drink': '#4f46b8', 'Alcohol': '#a3397c', 'Transport': '#2176a5',
  'Household': '#9c601e', 'Health': '#b54343', 'Personal care': '#8764b5', 'Shopping': '#b36b16',
  'Family': '#177e92', 'Subscriptions': '#657326', 'Needs review': '#697586', 'Fitness': '#436b35', 'Bills': '#576583', 'Fees': '#9c5035', 'Travel': '#3c7a7f' };
const money = (value, currency) => `${currency} ${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = date => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const PAGE_SIZE = 25;

export default function SpendDashboard({ transactions, loading, currency: preferredCurrency = 'AED' }) {
  const mapped = useMemo(() => transactions.map(mapDailyExpense).filter(Boolean), [transactions]);
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
  const summary = useMemo(() => aggregateExpenses(mapped, { currency, start, end }), [mapped, currency, start, end]);
  const tableRows = summary.rows.filter(row => (!category || row.category === category) && (!reviewOnly || row.needsReview)
    && `${row.merchant} ${row.category} ${row.subcategory}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = tableRows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const invalidCount = transactions.filter(item => item.classification === 'daily_spend').length - mapped.length;
  const chartCategories = summary.categories.filter(item => item.total > 0);
  const chartOptions = { responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${money(ctx.raw, currency)}` } } } };
  function changeScope(update) { update(); setPage(0); setCategory(''); setReviewOnly(false); }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([breakdownCsv(tableRows)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `daily-spend-breakdown-${period}-${currency}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  return <div className="spend-dashboard" aria-label="Daily spending dashboard">
    <div className="spend-dashboard-heading">
      <div><h3>Where your daily spend goes</h3><p>Daily Spend only · Dubai time · Categories are estimates where marked.</p></div>
      <button type="button" onClick={exportCsv} disabled={!tableRows.length || invalidRange || loading}>Download breakdown CSV</button>
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
    {invalidCount > 0 && <p role="status" className="spend-notice">{invalidCount} daily-spend record(s) have an invalid date or amount and cannot be charted.</p>}
    {loading ? <p role="status">Loading spending breakdown…</p> : invalidRange ? <p role="alert">Choose a valid start and end date, with From on or before To.</p> : !summary.rows.length ?
      <div className="spend-empty"><h4>No daily spend in this period</h4><p>Choose another cycle or All available dates to see your breakdown.</p></div> : <>
      <div className="spend-stats" aria-label="Spending summary">
        <div><span>Total daily spend</span><strong>{money(summary.total, currency)}</strong><small>{summary.rows.length} transactions</small></div>
        <div><span>Daily average</span><strong>{money(summary.average, currency)}</strong><small>{summary.dayCount} calendar days, including zero-spend days</small></div>
        <div><span>Low confidence</span><strong>{money(summary.reviewTotal, currency)}</strong><small>{summary.reviewCount} transactions to check</small></div>
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
        <section className="spend-panel"><h4>Daily spending</h4><div className="spend-chart"><Bar role="img" aria-label="Daily spending over the selected period; exact amounts are in the daily totals below"
          data={{ labels: summary.daily.map(item => shortDate(item.date)), datasets: [{ label: currency, data: summary.daily.map(item => item.total), backgroundColor: '#4f46b8', maxBarThickness: 28 }] }}
          options={{ ...chartOptions, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, title: { display: true, text: currency } } } }} /></div>
          <details><summary>View daily totals</summary><div className="spend-table-scroll spend-daily-totals"><table><caption className="sr-only">Daily totals in Dubai time</caption><thead><tr><th>Date</th><th>Amount</th></tr></thead><tbody>
            {summary.daily.map(item => <tr key={item.date}><td>{item.date}</td><td>{money(item.total, currency)}</td></tr>)}
          </tbody></table></div></details>
          <h4 className="spend-detail-heading">Expense detail</h4><div className="spend-table-scroll"><table><caption className="sr-only">Totals by subcategory</caption><thead><tr><th>Subcategory</th><th>Amount</th></tr></thead><tbody>
            {summary.subcategories.map(item => <tr key={item.name}><td>{item.subcategory}<small className="spend-muted">{item.category}</small></td><td>{money(item.total, currency)}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>
      <section className="spend-panel spend-transactions"><h4>Transaction breakdown</h4>
        <div className="spend-filters"><label>Category<select value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="">All categories</option>{summary.categories.map(item => <option key={item.name}>{item.name}</option>)}</select></label>
          <label>Search<input type="search" placeholder="Merchant or category" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
          <label className="spend-review-toggle"><input type="checkbox" checked={reviewOnly} onChange={e => { setReviewOnly(e.target.checked); setPage(0); }} />Low confidence only</label>
        </div>
        <p className="spend-muted">{tableRows.length} matching transactions. CSV export uses these filters.</p>
        <div className="spend-table-scroll"><table><caption className="sr-only">Mapped daily-spend transactions</caption><thead><tr><th>Dubai date / time</th><th>Merchant</th><th>Category / detail</th><th>Amount</th><th>Confidence / reason</th></tr></thead><tbody>
          {visibleRows.map((row, i) => <tr key={row.id || `${row.occurredAt}-${i}`}><td>{row.localDate}<small className="spend-muted">{row.source === 'manual-web' ? 'Manual date' : row.localTime}</small></td>
            <td>{row.normalizedMerchant || 'Unknown merchant'}</td><td>{row.category}<small className="spend-muted">{row.subcategory}</small></td><td>{money(row.amount, currency)}</td>
            <td><span className={row.needsReview ? 'spend-confidence-low' : ''}>{row.confidence}{row.needsReview ? ' · Check' : ''}</span><details><summary>Why?</summary><p>{row.mappingReason}</p></details></td></tr>)}
        </tbody></table></div>
        {!tableRows.length && <p>No transactions match these filters.</p>}
        <div className="spend-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div>
      </section>
      <details className="spend-method"><summary>How categories are estimated</summary><p>Noon and Amazon up to AED 400 default to groceries; larger purchases need review. Explicit memberships stay subscriptions. ANE Meydan is alcohol.</p>
        <p>Weekday supermarket purchases from 12:00–12:59 Dubai time, between AED 10 and AED 80, are likely lunch. Manual entries do not use the noon timestamp as evidence.</p>
        <p>High confidence means a clear descriptor or confirmation. Medium is an estimate or your grocery default. Low needs checking. Category estimates do not change your saved merchant rules.</p></details>
    </>}
  </div>;
}
