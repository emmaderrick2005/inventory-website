import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { formatDateTime, formatUGX, JOB_STATUS } from '../format.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'in-service', label: 'In service' },
  { value: 'completed', label: 'Completed' },
  { value: 'released', label: 'Released' },
];

export default function JobCards() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/jobcards')
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (status !== 'all' && job.status !== status) return false;
      if (!q) return true;
      return [
        job.jobNumber,
        job.vehicle?.registrationNumber,
        job.vehicle?.make,
        job.vehicle?.model,
        job.customer?.name,
        job.customer?.phone,
        job.services.map((s) => s.name).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [jobs, query, status]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Job Cards</h1>
          <p>Every car service recorded at the bay — parts, labour and totals in UGX.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/jobcards/new')}>
            + New job card
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="toolbar">
          <input
            className="input"
            placeholder="Search job #, registration, customer, service…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filters">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={status === f.value ? 'active' : ''}
                onClick={() => setStatus(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="muted small">
            {filtered.length} of {jobs.length}
          </span>
        </div>

        {loading ? (
          <div className="spinner">Loading job cards…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            No job cards match.{' '}
            <button className="btn btn-sm" onClick={() => navigate('/jobcards/new')}>
              Create the first one
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Date in</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Services</th>
                  <th className="right">Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => (
                  <tr
                    key={job._id}
                    className="clickable"
                    onClick={() => navigate(`/jobcards/${job._id}`)}
                  >
                    <td className="job-num">{job.jobNumber}</td>
                    <td className="small">{formatDateTime(job.dateIn)}</td>
                    <td>
                      <span className="strong">{job.vehicle?.registrationNumber || '—'}</span>
                      <div className="muted small">
                        {job.vehicle?.make} {job.vehicle?.model}
                      </div>
                    </td>
                    <td>
                      {job.customer?.name || '—'}
                      <div className="muted small">{job.customer?.phone}</div>
                    </td>
                    <td className="small">
                      {job.services.length
                        ? job.services.map((s) => s.name).join(', ')
                        : <span className="muted">Parts only</span>}
                      {job.parts.length > 0 && (
                        <div className="muted small">{job.parts.length} part line(s)</div>
                      )}
                    </td>
                    <td className="num strong">{formatUGX(job.totals.grand)}</td>
                    <td>
                      <span className={`badge badge-${job.status}`}>{JOB_STATUS[job.status]}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${job.paymentStatus}`}>
                        {job.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
