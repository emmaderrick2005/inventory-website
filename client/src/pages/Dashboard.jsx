import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, formatDay, formatUGX, JOB_STATUS } from '../format.js';

/** Compact chart label: 243000 -> "243k" */
const compact = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n || 0));

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/stats')
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <div className="spinner">Loading dashboard…</div>;

  // Fill the last 7 days so the chart always shows a full week.
  const byDate = Object.fromEntries(stats.revenueByDay.map((d) => [d.date, d]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - i));
    const key = date.toISOString().slice(0, 10);
    return { key, label: formatDay(date), total: byDate[key]?.total || 0 };
  });
  const max = Math.max(...week.map((d) => d.total), 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{formatDate(new Date())} · Oyera Auto Service Bay Ltd</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/jobcards/new')}>
            + New job card
          </button>
        </div>
      </div>

      <div className="grid grid-stats">
        <div className="card stat">
          <div className="stat-chip">🚗</div>
          <div>
            <div className="stat-value">{stats.carsInBay}</div>
            <div className="stat-label">Cars in the bay now</div>
          </div>
        </div>
        <div className="card stat">
          <div className="stat-chip purple">▤</div>
          <div>
            <div className="stat-value">{stats.todayJobs}</div>
            <div className="stat-label">
              Jobs today · {stats.completedToday} completed
            </div>
          </div>
        </div>
        <div className="card stat">
          <div className="stat-chip green">💰</div>
          <div>
            <div className="stat-value">{formatUGX(stats.revenueToday)}</div>
            <div className="stat-label">Collected today</div>
          </div>
        </div>
        <div className="card stat">
          <div className="stat-chip">📅</div>
          <div>
            <div className="stat-value">{formatUGX(stats.revenueMonth)}</div>
            <div className="stat-label">Collected this month</div>
          </div>
        </div>
        <div className="card stat">
          <div className="stat-chip amber">⚠</div>
          <div>
            <div className="stat-value">{stats.lowStock.length}</div>
            <div className="stat-label">Parts running low</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Revenue — last 7 days</h3>
          <div className="card-sub">Billed value of job cards per day (UGX)</div>
          <div className="chart">
            {week.map((day) => (
              <div className="chart-col" key={day.key}>
                <span className="chart-val">{compact(day.total)}</span>
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max(3, Math.round((day.total / max) * 100))}%` }}
                  title={`${formatUGX(day.total)}`}
                />
                <span className="chart-label">{day.label}</span>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 22 }}>Recent job cards</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th className="right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentJobs.map((job) => (
                  <tr
                    key={job._id}
                    className="clickable"
                    onClick={() => navigate(`/jobcards/${job._id}`)}
                  >
                    <td className="job-num">{job.jobNumber}</td>
                    <td>
                      <span className="strong">{job.vehicle.registrationNumber}</span>
                      <div className="muted small">
                        {job.vehicle.make} {job.vehicle.model}
                      </div>
                    </td>
                    <td>{job.customer.name}</td>
                    <td className="num strong">{formatUGX(job.totals.grand)}</td>
                    <td>
                      <span className={`badge badge-${job.status}`}>{JOB_STATUS[job.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Low stock alerts</h3>
            <div className="card-sub">Parts at or below their reorder level</div>
            {stats.lowStock.length === 0 ? (
              <div className="empty">All parts are sufficiently stocked.</div>
            ) : (
              stats.lowStock.map((part) => (
                <div className="list-line" key={part._id}>
                  <span>
                    {part.name}
                    <div className="muted small">
                      {formatUGX(part.price)} per {part.unit}
                    </div>
                  </span>
                  <span className={`badge ${part.stock <= part.reorderLevel ? 'badge-unpaid' : 'badge-neutral'}`}>
                    {part.stock} {part.unit}s left
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <h3>Bay activity</h3>
            <div className="card-sub">Job cards by status</div>
            {(stats.statusBreakdown.length
              ? stats.statusBreakdown
              : [{ status: 'received', count: 0 }]
            ).map((s) => (
              <div className="list-line" key={s.status}>
                <span>{JOB_STATUS[s.status] || s.status}</span>
                <span className="strong">{s.count}</span>
              </div>
            ))}
            <div className="list-line">
              <span className="muted">Customers · Vehicles · Technicians</span>
              <span className="strong">
                {stats.counts.customers} · {stats.counts.vehicles} · {stats.counts.technicians}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
