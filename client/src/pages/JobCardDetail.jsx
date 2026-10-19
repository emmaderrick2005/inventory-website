import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatDateTime, formatDate, formatUGX, JOB_STATUS } from '../format.js';

const NEXT_STEP = {
  received: { next: 'in-service', label: '▶ Start service' },
  'in-service': { next: 'completed', label: '✓ Mark completed' },
  completed: { next: 'released', label: '🚗 Release car' },
  released: null,
};

export default function JobCardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isStaff } = useAuth();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get(`/jobcards/${id}`)
      .then(setJob)
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, [id]);

  const patch = async (body) => {
    setBusy(true);
    try {
      setJob(await api.patch(`/jobcards/${id}`, body));
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete job card ${job.jobNumber}? Parts used will be returned to stock.`)) {
      return;
    }
    try {
      await api.del(`/jobcards/${id}`);
      navigate('/jobcards', { state: { flash: `${job.jobNumber} deleted.` } });
    } catch (err) {
      window.alert(err.message);
    }
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!job) return <div className="spinner">Loading job card…</div>;

  const step = NEXT_STEP[job.status];
  const paid = job.paymentStatus === 'paid';

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link to="/jobcards" className="btn btn-sm">
            ← Job cards
          </Link>
          <h1 style={{ marginTop: 10 }}>
            <span className="job-num">{job.jobNumber}</span>{' '}
            <span className={`badge badge-${job.status}`} style={{ verticalAlign: 'middle' }}>
              {JOB_STATUS[job.status]}
            </span>{' '}
            <span className={`badge badge-${job.paymentStatus}`} style={{ verticalAlign: 'middle' }}>
              {paid ? 'Paid' : 'Unpaid'}
            </span>
          </h1>
          <p>
            {job.vehicle.registrationNumber} · {job.customer.name} · in {formatDateTime(job.dateIn)}
          </p>
        </div>
        <div className="page-actions action-row">
          {step && (
            <button
              className="btn btn-success"
              disabled={busy}
              onClick={() => patch({ status: step.next })}
            >
              {step.label}
            </button>
          )}
          <button
            className="btn"
            disabled={busy}
            onClick={() => patch({ paymentStatus: paid ? 'unpaid' : 'paid' })}
          >
            {paid ? 'Mark unpaid' : 'Mark paid'}
          </button>
          <Link to={`/jobcards/${job._id}/edit`} className="btn">
            Edit
          </Link>
          <Link to={`/jobcards/${job._id}/receipt`} className="btn">
            🧾 Receipt
          </Link>
          <button className="btn" onClick={() => window.print()}>
            Print
          </button>
          {isStaff && (
            <button className="btn btn-danger" onClick={remove}>
              Delete
            </button>
          )}
        </div>
      </div>

      {location.state?.flash && <div className="alert alert-info no-print">{location.state.flash}</div>}

      <div className="grid grid-2">
        <div>
          <div className="card">
            <h3>Job details</h3>
            <div className="detail-grid" style={{ marginTop: 12 }}>
              <div className="detail-item">
                <span className="field-label">Customer</span>
                <div className="strong">{job.customer.name}</div>
                <div className="muted small">{job.customer.phone}</div>
              </div>
              <div className="detail-item">
                <span className="field-label">Vehicle</span>
                <div className="strong">
                  {job.vehicle.registrationNumber} · {job.vehicle.type}
                </div>
                <div className="muted small">
                  {job.vehicle.make} {job.vehicle.model}
                </div>
              </div>
              <div className="detail-item">
                <span className="field-label">Date in</span>
                <div>{formatDateTime(job.dateIn)}</div>
              </div>
              <div className="detail-item">
                <span className="field-label">Date out</span>
                <div>{job.dateOut ? formatDateTime(job.dateOut) : '—'}</div>
              </div>
              <div className="detail-item">
                <span className="field-label">Assessed by (senior)</span>
                <div>{job.assessedBy ? job.assessedBy.name : '—'}</div>
              </div>
              <div className="detail-item">
                <span className="field-label">Technicians</span>
                <div>
                  {job.technicians.length
                    ? job.technicians.map((t) => t.name).join(', ')
                    : '—'}
                </div>
              </div>
            </div>
            {job.notes && (
              <div style={{ marginTop: 14 }}>
                <span className="field-label">Notes</span>
                <div className="small">{job.notes}</div>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Services</h3>
            {job.services.length === 0 ? (
              <div className="empty">No fixed services — parts + labour only.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th className="right">Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.services.map((line, i) => (
                      <tr key={i}>
                        <td>{line.name}</td>
                        <td className="num">
                          {line.price > 0 ? formatUGX(line.price) : <span className="muted">parts + labour</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Parts &amp; oils used</h3>
            {job.parts.length === 0 ? (
              <div className="empty">No parts taken from the shop.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th className="right">Qty</th>
                      <th className="right">Unit price</th>
                      <th className="right">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.parts.map((line, i) => (
                      <tr key={i}>
                        <td>{line.name}</td>
                        <td className="num">{line.quantity}</td>
                        <td className="num">{formatUGX(line.price)}</td>
                        <td className="num strong">{formatUGX(line.price * line.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------- invoice ------------------------- */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 18 }}>
            <div className="invoice">
              <div className="invoice-head">
                <div>
                  <h4>Oyera Auto Service Bay Ltd</h4>
                  <div className="muted small">Service invoice · OAS Bay</div>
                </div>
                <div className="right small">
                  <div className="job-num">{job.jobNumber}</div>
                  <div className="muted">
                    {formatDate(job.dateIn)}
                    {job.receiptNumber ? ` · receipt ${job.receiptNumber}` : ''}
                  </div>
                </div>
              </div>

              <div className="small muted" style={{ marginBottom: 8 }}>
                {job.customer.name} · {job.vehicle.registrationNumber} ({job.vehicle.make}{' '}
                {job.vehicle.model})
              </div>

              <div className="totals-line">
                <span className="muted">Services</span>
                <span>{formatUGX(job.totals.services)}</span>
              </div>
              <div className="totals-line">
                <span className="muted">Parts &amp; oils</span>
                <span>{formatUGX(job.totals.parts)}</span>
              </div>
              <div className="totals-line">
                <span className="muted">Labour</span>
                <span>{formatUGX(job.totals.labour)}</span>
              </div>
              <div className="totals-line grand">
                <span>Total (UGX)</span>
                <span>{formatUGX(job.totals.grand)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  alignItems: 'center',
                }}
              >
                <span className="small muted">Payment</span>
                <span className={`badge badge-${job.paymentStatus}`}>
                  {paid ? 'PAID' : 'NOT YET PAID'}
                </span>
              </div>
              <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
                All amounts in Ugandan shillings. Thank you for choosing OAS Bay.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
