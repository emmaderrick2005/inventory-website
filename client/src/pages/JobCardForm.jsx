import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatUGX, toInputDate } from '../format.js';

const STANDARD_LABOUR = 20000; // UGX charged for labour in the service bay

const emptyForm = () => ({
  customer: '',
  vehicle: '',
  dateIn: toInputDate(new Date()),
  services: [],
  partRows: [{ partId: '', quantity: 1 }],
  technicians: [],
  assessedBy: '',
  labourCharge: STANDARD_LABOUR,
  notes: '',
  status: 'received',
  paymentStatus: 'unpaid',
});

export default function JobCardForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [jobNumber, setJobNumber] = useState('');
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [services, setServices] = useState([]);
  const [parts, setParts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get('/vehicles'),
      api.get('/services'),
      api.get('/parts'),
      api.get('/technicians'),
      editing ? api.get(`/jobcards/${id}`) : null,
    ])
      .then(([customerRows, vehicleRows, serviceRows, partRows, techRows, job]) => {
        setCustomers(customerRows);
        setVehicles(vehicleRows);
        setServices(serviceRows);
        setParts(partRows);
        setTechnicians(techRows);
        if (job) {
          setJobNumber(job.jobNumber);
          setForm({
            customer: job.customer._id,
            vehicle: job.vehicle._id,
            dateIn: toInputDate(job.dateIn),
            services: job.services.map((line) => line.serviceId || ''),
            partRows: job.parts.length
              ? job.parts.map((line) => ({ partId: line.partId || '', quantity: line.quantity }))
              : [{ partId: '', quantity: 1 }],
            technicians: job.technicians.map((tech) => tech._id),
            assessedBy: job.assessedBy?._id || '',
            labourCharge: job.labourCharge,
            notes: job.notes || '',
            status: job.status,
            paymentStatus: job.paymentStatus,
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, editing]);

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const ownedVehicles = form.customer
    ? vehicles.filter((v) => (v.owner?._id || v.owner) === form.customer)
    : [];
  const seniors = technicians.filter((t) => t.role === 'senior');
  const findPart = (partId) => parts.find((p) => p._id === partId);

  // ----- live totals -------------------------------------------------------
  const servicesTotal = services
    .filter((s) => form.services.includes(s._id))
    .reduce((sum, s) => sum + s.price, 0);
  const partsTotal = form.partRows.reduce((sum, row) => {
    const part = findPart(row.partId);
    return sum + (part ? part.price * (Number(row.quantity) || 0) : 0);
  }, 0);
  const labour = Number(form.labourCharge) || 0;
  const grand = servicesTotal + partsTotal + labour;

  const toggle = (listName, value) =>
    setForm((prev) => ({
      ...prev,
      [listName]: prev[listName].includes(value)
        ? prev[listName].filter((v) => v !== value)
        : [...prev[listName], value],
    }));

  const setPartRow = (index, patch) =>
    setForm((prev) => ({
      ...prev,
      partRows: prev.partRows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));

  const addPartRow = () =>
    setForm((prev) => ({ ...prev, partRows: [...prev.partRows, { partId: '', quantity: 1 }] }));

  const removePartRow = (index) =>
    setForm((prev) => ({
      ...prev,
      partRows: prev.partRows.filter((_, i) => i !== index),
    }));

  // ----- submit ------------------------------------------------------------
  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.customer) return setError('Select the customer (car owner).');
    if (!form.vehicle) return setError('Select the vehicle being serviced.');

    const chosenParts = form.partRows.filter((row) => row.partId);
    if (!form.services.length && !chosenParts.length && !form.notes.trim()) {
      return setError('Select at least one service or part — or add notes describing the work.');
    }

    // merged stock validation (a part may appear on several rows)
    const quantities = {};
    for (const row of chosenParts) {
      quantities[row.partId] = (quantities[row.partId] || 0) + Number(row.quantity || 0);
    }
    for (const [partId, qty] of Object.entries(quantities)) {
      const part = findPart(partId);
      if (!part) return setError('A selected part no longer exists. Re-load the page.');
      if (!Number.isFinite(qty) || qty < 1) return setError(`Quantity for ${part.name} must be at least 1.`);
      if (qty > part.stock) {
        return setError(`Not enough stock for ${part.name}: only ${part.stock} ${part.unit}(s) available.`);
      }
    }

    setSaving(true);
    try {
      const body = {
        customer: form.customer,
        vehicle: form.vehicle,
        dateIn: form.dateIn,
        services: form.services,
        parts: chosenParts.map((row) => ({ partId: row.partId, quantity: Number(row.quantity) })),
        technicians: form.technicians,
        assessedBy: form.assessedBy || null,
        labourCharge: labour,
        notes: form.notes,
        ...(editing ? { status: form.status, paymentStatus: form.paymentStatus } : {}),
      };
      const job = editing
        ? await api.put(`/jobcards/${id}`, body)
        : await api.post('/jobcards', body);
      navigate(`/jobcards/${job._id}`, {
        state: { flash: editing ? 'Job card updated.' : `Job card ${job.jobNumber} created.` },
      });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="spinner">Loading form…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/jobcards" className="btn btn-sm no-print">
            ← Back
          </Link>
          <h1 style={{ marginTop: 10 }}>
            {editing ? `Edit ${jobNumber}` : 'New Job Card'}
          </h1>
          <p>
            A senior technician determines the parts and oils needed; labour in the bay is
            {' '}{formatUGX(STANDARD_LABOUR)} by default.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={submit}>
        <div className="grid grid-2">
          <div>
            <div className="card">
              <h3>1 · Car and owner</h3>
              <div className="card-sub">One or more services can be booked on the same day.</div>
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Customer (owner)</span>
                  <select
                    className="input"
                    value={form.customer}
                    required
                    onChange={(e) => {
                      const customerId = e.target.value;
                      const stillOwned = vehicles.some(
                        (v) => (v.owner?._id || v.owner) === customerId && v._id === form.vehicle
                      );
                      setForm((prev) => ({
                        ...prev,
                        customer: customerId,
                        vehicle: stillOwned ? prev.vehicle : '',
                      }));
                    }}
                  >
                    <option value="">— select customer —</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} — {c.phone}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Vehicle</span>
                  <select
                    className="input"
                    value={form.vehicle}
                    required
                    disabled={!form.customer}
                    onChange={(e) => set('vehicle', e.target.value)}
                  >
                    <option value="">
                      {form.customer ? '— select vehicle —' : 'Select customer first'}
                    </option>
                    {ownedVehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.registrationNumber} — {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Date in</span>
                  <input
                    type="date"
                    className="input"
                    value={form.dateIn}
                    required
                    onChange={(e) => set('dateIn', e.target.value)}
                  />
                </label>

                {editing && (
                  <label className="field">
                    <span className="field-label">Payment status</span>
                    <select
                      className="input"
                      value={form.paymentStatus}
                      onChange={(e) => set('paymentStatus', e.target.value)}
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                )}

                {editing && (
                  <label className="field">
                    <span className="field-label">Status</span>
                    <select
                      className="input"
                      value={form.status}
                      onChange={(e) => set('status', e.target.value)}
                    >
                      <option value="received">Received</option>
                      <option value="in-service">In service</option>
                      <option value="completed">Completed</option>
                      <option value="released">Released</option>
                    </select>
                  </label>
                )}
              </div>
            </div>

            <div className="card">
              <h3>2 · Services required</h3>
              <div className="card-sub">
                Fixed services carry their own charge; others are billed as parts + labour.
              </div>
              <div className="chip-grid">
                {services.map((service) => {
                  const checked = form.services.includes(service._id);
                  return (
                    <label key={service._id} className={`chip ${checked ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle('services', service._id)}
                      />
                      {service.name}
                      <span className="chip-price">
                        {service.price > 0 ? formatUGX(service.price) : '+ labour'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h3>3 · Parts and oils</h3>
              <div className="card-sub">
                Stock in the shop is reduced automatically when the job card is saved.
              </div>
              {form.partRows.map((row, index) => {
                const part = findPart(row.partId);
                return (
                  <div
                    className="row"
                    key={index}
                    style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}
                  >
                    <select
                      className="input"
                      style={{ flex: 3 }}
                      value={row.partId}
                      onChange={(e) => setPartRow(index, { partId: e.target.value })}
                    >
                      <option value="">— select part / oil —</option>
                      {parts.map((p) => (
                        <option key={p._id} value={p._id} disabled={p.stock === 0}>
                          {p.name} — {formatUGX(p.price)}
                          {p.stock === 0 ? ' (out of stock)' : ` (stock: ${p.stock} ${p.unit}s)`}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input"
                      style={{ width: 92 }}
                      min={1}
                      max={part ? part.stock : undefined}
                      value={row.quantity}
                      disabled={!row.partId}
                      onChange={(e) => setPartRow(index, { quantity: e.target.value })}
                    />
                    <span className="muted small" style={{ width: 120 }}>
                      {part ? formatUGX(part.price * (Number(row.quantity) || 0)) : ''}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Remove line"
                      onClick={() => removePartRow(index)}
                      disabled={form.partRows.length === 1}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button type="button" className="btn btn-sm" onClick={addPartRow}>
                + Add another part
              </button>
            </div>

            <div className="card">
              <h3>4 · Technicians</h3>
              <div className="card-sub">One technician or more can handle a car service.</div>
              <div className="chip-grid" style={{ marginBottom: 14 }}>
                {technicians.map((tech) => {
                  const checked = form.technicians.includes(tech._id);
                  return (
                    <label key={tech._id} className={`chip ${checked ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle('technicians', tech._id)}
                      />
                      {tech.name}
                      <span className="chip-price small">
                        {tech.role === 'senior' ? 'senior' : ''}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Assessed by (senior technician)</span>
                  <select
                    className="input"
                    value={form.assessedBy}
                    onChange={(e) => set('assessedBy', e.target.value)}
                  >
                    <option value="">— none —</option>
                    {seniors.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Labour charge (UGX)</span>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    step={1000}
                    value={form.labourCharge}
                    onChange={(e) => set('labourCharge', e.target.value)}
                  />
                  <span className="muted small">Standard bay labour: {formatUGX(STANDARD_LABOUR)}</span>
                </label>

                <label className="field span-2">
                  <span className="field-label">Notes / diagnosis</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.notes}
                    placeholder="What the senior technician observed, advice given to the owner…"
                    onChange={(e) => set('notes', e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* ---------------- totals panel ---------------- */}
          <div>
            <div className="card" style={{ position: 'sticky', top: 18 }}>
              <h3>Job total</h3>
              <div className="card-sub">Calculated live · Ugandan shillings</div>

              <div className="totals-line">
                <span className="muted">
                  Services ({form.services.length})
                </span>
                <span>{formatUGX(servicesTotal)}</span>
              </div>
              <div className="totals-line">
                <span className="muted">
                  Parts &amp; oils (
                  {form.partRows.filter((r) => r.partId).length} line
                  {form.partRows.filter((r) => r.partId).length === 1 ? '' : 's'})
                </span>
                <span>{formatUGX(partsTotal)}</span>
              </div>
              <div className="totals-line">
                <span className="muted">Labour</span>
                <span>{formatUGX(labour)}</span>
              </div>
              <div className="totals-line grand">
                <span>Grand total</span>
                <span>{formatUGX(grand)}</span>
              </div>

              <div className="form-actions" style={{ marginTop: 16 }}>
                <Link to="/jobcards" className="btn">
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create job card'}
                </button>
              </div>
              <p className="muted small" style={{ marginTop: 10 }}>
                On save, selected parts leave the shop stock. Wheel alignment {formatUGX(30000)} ·
                wheel balancing {formatUGX(20000)} are fixed services.
              </p>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
