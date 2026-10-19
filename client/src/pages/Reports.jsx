import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDay, formatUGX } from '../format.js';

const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (value) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

export default function Reports() {
  const [month, setMonth] = useState(thisMonth);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/reports?month=${month}`)
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [month]);

  if (error) return <div className="alert alert-error">{error}</div>;

  const s = report?.summary;
  const delta = report?.deltaPct;

  // full-month chart with empty days filled in
  const chart = (() => {
    if (!report) return [];
    const [year, mon] = report.month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const byDate = Object.fromEntries(report.daily.map((d) => [d.date, d]));
    return Array.from({ length: daysInMonth }, (_, i) => {
      const key = `${year}-${String(mon).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return { key, day: i + 1, paid: byDate[key]?.paid || 0, jobs: byDate[key]?.jobs || 0 };
    });
  })();
  const max = Math.max(...chart.map((d) => d.paid), 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Monthly Report</h1>
          <p>Revenue, services, parts and technician activity for the bay.</p>
        </div>
        <div className="page-actions">
          <input
            type="month"
            className="input"
            value={month}
            max={thisMonth()}
            onChange={(e) => setMonth(e.target.value || thisMonth())}
          />
          <button className="btn" onClick={() => window.print()}>
            Print report
          </button>
        </div>
      </div>

      {loading || !report || !s ? (
        <div className="spinner">Loading report…</div>
      ) : (
        <>
          <div className="grid grid-stats">
            <div className="card stat">
              <div className="stat-chip green">💰</div>
              <div>
                <div className="stat-value">{formatUGX(s.paid)}</div>
                <div className="stat-label">
                  Collected in {monthLabel(report.month)}{' '}
                  {delta !== null && (
                    <span className={`badge ${delta >= 0 ? 'badge-paid' : 'badge-unpaid'}`}>
                      {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs prev.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="card stat">
              <div className="stat-chip">🧾</div>
              <div>
                <div className="stat-value">{formatUGX(s.billed)}</div>
                <div className="stat-label">Billed (all job cards)</div>
              </div>
            </div>
            <div className="card stat">
              <div className="stat-chip purple">▤</div>
              <div>
                <div className="stat-value">{s.jobs}</div>
                <div className="stat-label">
                  Job cards · {s.completed} completed · {s.paidJobs} paid
                </div>
              </div>
            </div>
            <div className="card stat">
              <div className="stat-chip amber">⏳</div>
              <div>
                <div className="stat-value">{formatUGX(s.billed - s.paid)}</div>
                <div className="stat-label">Still to collect</div>
              </div>
            </div>
            <div className="card stat">
              <div className="stat-chip">⚙</div>
              <div>
                <div className="stat-value">{formatUGX(s.parts)}</div>
                <div className="stat-label">Parts &amp; oils sold</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Collections per day — {monthLabel(report.month)}</h3>
            <div className="card-sub">Paid job cards, in UGX</div>
            <div className="chart" style={{ height: 150 }}>
              {chart.map((day) => (
                <div className="chart-col" key={day.day}>
                  <div
                    className="chart-bar"
                    style={{ height: `${Math.max(3, Math.round((day.paid / max) * 100))}%` }}
                    title={`Day ${day.day}: ${formatUGX(day.paid)} from ${day.jobs} job(s)`}
                  />
                  <span className="chart-label">{day.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-halves" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Services sold</h3>
              <div className="card-sub">How often each catalogue service was booked</div>
              {report.servicesSold.length === 0 ? (
                <div className="empty">No services booked this month.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th className="right">Times booked</th>
                        <th className="right">Fixed charges</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.servicesSold.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td className="num strong">{row.count}</td>
                          <td className="num">{formatUGX(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h3>Parts &amp; oils sold</h3>
              <div className="card-sub">Top sellers this month (shop stock)</div>
              {report.partsSold.length === 0 ? (
                <div className="empty">No parts sold this month.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Part</th>
                        <th className="right">Qty</th>
                        <th className="right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.partsSold.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td className="num strong">{row.qty}</td>
                          <td className="num">{formatUGX(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Technician activity</h3>
            <div className="card-sub">Job cards each technician handled this month</div>
            {report.byTechnician.length === 0 ? (
              <div className="empty">No technicians were assigned this month.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Technician</th>
                      <th className="right">Jobs handled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byTechnician.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td className="num strong">{row.jobs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted small" style={{ marginTop: 10 }}>
              Previous month collected {formatUGX(report.previous.paid)} across {report.previous.jobs}{' '}
              job card(s).
            </p>
          </div>
        </>
      )}
    </>
  );
}
