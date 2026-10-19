import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, formatDateTime, formatUGX } from '../format.js';

/**
 * Standalone printable receipt — open it, press "Print / save as PDF".
 * The sidebar and buttons carry .no-print, so only the receipt prints.
 */
export default function Receipt() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/jobcards/${id}`)
      .then(setJob)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!job) return <div className="spinner">Loading receipt…</div>;

  const paid = job.paymentStatus === 'paid';

  return (
    <div className="page-head" style={{ display: 'block' }}>
      <div className="action-row no-print" style={{ marginBottom: 16 }}>
        <Link to={`/jobcards/${job._id}`} className="btn btn-sm">
          ← Back to job card
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Print / save as PDF
        </button>
      </div>

      <div className="receipt-page">
        <div className="receipt-head">
          <div>
            <div className="receipt-logo">OAS</div>
            <h2>Oyera Auto Service Bay Ltd</h2>
            <p className="muted small">
              Service bay station · Kampala, Uganda
              <br />
              Engine &amp; gearbox oil, filters, brake fluids, pads, greasing, alignment &amp; balancing
            </p>
          </div>
          <div className="receipt-title">
            <strong>{paid ? 'OFFICIAL RECEIPT' : 'PROFORMA INVOICE'}</strong>
            <div className="small muted">{paid ? 'Payment received — thank you' : 'Not yet paid'}</div>
          </div>
        </div>

        <div className="receipt-meta">
          <div>
            <span className="field-label">Receipt no.</span>
            <div className="job-num">{job.receiptNumber || '— (issued on payment)'}</div>
          </div>
          <div>
            <span className="field-label">Job card</span>
            <div className="job-num">{job.jobNumber}</div>
          </div>
          <div>
            <span className="field-label">Date in</span>
            <div>{formatDateTime(job.dateIn)}</div>
          </div>
          <div>
            <span className="field-label">Date out</span>
            <div>{job.dateOut ? formatDateTime(job.dateOut) : '—'}</div>
          </div>
        </div>

        <div className="receipt-parties">
          <div>
            <span className="field-label">Billed to</span>
            <div className="strong">{job.customer.name}</div>
            <div className="small muted">{job.customer.phone}</div>
          </div>
          <div>
            <span className="field-label">Vehicle</span>
            <div className="strong">{job.vehicle.registrationNumber}</div>
            <div className="small muted">
              {job.vehicle.make} {job.vehicle.model} · {job.vehicle.type}
            </div>
          </div>
          <div>
            <span className="field-label">Technicians</span>
            <div className="small">
              {job.technicians.length ? job.technicians.map((t) => t.name).join(', ') : '—'}
            </div>
            <div className="small muted">
              Assessed by: {job.assessedBy ? job.assessedBy.name : '—'}
            </div>
          </div>
        </div>

        <table className="receipt-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Qty</th>
              <th className="right">Unit (UGX)</th>
              <th className="right">Amount (UGX)</th>
            </tr>
          </thead>
          <tbody>
            {job.services.map((line, i) => (
              <tr key={`s${i}`}>
                <td>
                  {line.name}
                  <span className="muted small"> · service</span>
                </td>
                <td className="num">1</td>
                <td className="num">{line.price > 0 ? line.price.toLocaleString('en-US') : '—'}</td>
                <td className="num">{line.price > 0 ? line.price.toLocaleString('en-US') : 'parts + labour'}</td>
              </tr>
            ))}
            {job.parts.map((line, i) => (
              <tr key={`p${i}`}>
                <td>
                  {line.name}
                  <span className="muted small"> · part</span>
                </td>
                <td className="num">{line.quantity}</td>
                <td className="num">{line.price.toLocaleString('en-US')}</td>
                <td className="num">{(line.price * line.quantity).toLocaleString('en-US')}</td>
              </tr>
            ))}
            <tr>
              <td>
                Labour (service bay)
                <span className="muted small"> · labour</span>
              </td>
              <td className="num">1</td>
              <td className="num">{job.totals.labour.toLocaleString('en-US')}</td>
              <td className="num">{job.totals.labour.toLocaleString('en-US')}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-totals">
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
            <span>TOTAL PAID (UGX)</span>
            <span>{formatUGX(job.totals.grand)}</span>
          </div>
        </div>

        <div className="receipt-foot">
          <div className="receipt-sign">
            <div className="sign-line" />
            <span className="small muted">Received by (OAS Bay)</span>
          </div>
          <div className="receipt-status">
            <span className={`badge badge-${job.paymentStatus}`}>
              {paid ? 'PAID' : 'NOT YET PAID'}
            </span>
            <div className="small muted" style={{ marginTop: 6 }}>
              {formatDate(job.dateIn)} · {job.jobNumber}
            </div>
          </div>
          <div className="receipt-sign">
            <div className="sign-line" />
            <span className="small muted">Customer signature</span>
          </div>
        </div>

        <p className="muted small" style={{ textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
          All amounts in Ugandan shillings (UGX). Goods once sold on parts are subject to shop
          policy. Thank you for choosing Oyera Auto Service Bay Ltd.
        </p>
      </div>
    </div>
  );
}
