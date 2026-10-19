import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import Modal from './Modal.jsx';

/**
 * Generic records manager: list + search + create/edit modal + delete.
 *
 * props:
 *  - title/singular    page heading and wording for confirmations
 *  - endpoint          e.g. '/customers'
 *  - fields            form field definitions (see renderField)
 *  - columns           table columns: [{ label, align?, render(row) }]
 *  - defaultValues     values used when creating
 *  - searchKeys        row getters used by the search box
 */
export default function CrudManager({
  title,
  subtitle,
  singular,
  endpoint,
  fields,
  columns,
  defaultValues = {},
  searchKeys = [],
  canDelete = () => true,
  readOnly = false,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | row
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [refOptions, setRefOptions] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api.get(endpoint));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [endpoint]);

  // options for ref-type fields (owner, category, role, ...)
  useEffect(() => {
    const refFields = fields.filter((f) => f.fetch);
    if (!refFields.length) return;
    let cancelled = false;
    Promise.all(refFields.map(async (f) => [f.name, await api.get(f.fetch)]))
      .then((entries) => {
        if (!cancelled) setRefOptions(Object.fromEntries(entries));
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [fields]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      (searchKeys.length ? searchKeys.map((get) => get(row)) : [JSON.stringify(row)])
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query, searchKeys]);

  const openNew = () => {
    setForm({ ...defaultValues });
    setModal('new');
    setError('');
  };

  const openEdit = (row) => {
    const next = {};
    for (const field of fields) {
      const value = row[field.name];
      if (field.type === 'tags') next[field.name] = (value || []).join(', ');
      else if (field.type === 'ref') next[field.name] = value?._id || value || '';
      else if (field.type === 'checkbox') next[field.name] = Boolean(value);
      else if (field.type === 'number') next[field.name] = value ?? 0;
      else next[field.name] = value ?? '';
    }
    setForm(next);
    setModal(row);
  };

  const close = () => {
    setModal(null);
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {};
      for (const field of fields) {
        let value = form[field.name];
        if (field.type === 'number') value = Number(value) || 0;
        if (field.type === 'tags') {
          value = String(value || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (field.type === 'checkbox') value = Boolean(value);
        if (value === '') value = field.type === 'ref' ? undefined : value;
        body[field.name] = value;
      }
      if (modal === 'new') await api.post(endpoint, body);
      else await api.put(`${endpoint}/${modal._id}`, body);
      close();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!canDelete(row)) return;
    const label = row.name || row.registrationNumber || row.jobNumber || 'this record';
    if (!window.confirm(`Delete ${singular} "${label}"? This cannot be undone.`)) return;
    try {
      await api.del(`${endpoint}/${row._id}`);
      await load();
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="page-actions">
          {!readOnly && (
            <button className="btn btn-primary" onClick={openNew}>
              + Add {singular}
            </button>
          )}
        </div>
      </div>

      {error && !modal && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="toolbar">
          <input
            className="input"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="muted small">
            {filtered.length} of {rows.length}
          </span>
        </div>

        {loading ? (
          <div className="spinner">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No records found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.label} className={col.align === 'right' ? 'right' : ''}>
                      {col.label}
                    </th>
                  ))}
                  {!readOnly && <th className="right no-print">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row._id}>
                    {columns.map((col) => (
                      <td key={col.label} className={`${col.align === 'right' ? 'num' : ''} ${col.className || ''}`}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                    {!readOnly && (
                      <td className="right no-print" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm" onClick={() => openEdit(row)}>
                          Edit
                        </button>{' '}
                        {canDelete(row) && (
                          <button className="btn btn-sm btn-danger" onClick={() => remove(row)}>
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={`${modal === 'new' ? 'Add' : 'Edit'} ${singular}`} onClose={close}>
          <form onSubmit={save}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              {fields.map((field) => (
                <div key={field.name} className={field.wide ? 'span-2' : ''}>
                  <label className="field">
                    <span className="field-label">{field.label}</span>
                    {renderField(field, form, setForm, refOptions)}
                  </label>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function renderField(field, form, setForm, refOptions) {
  const value = form[field.name] ?? '';
  const set = (v) => setForm((prev) => ({ ...prev, [field.name]: v }));

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className="input"
          rows={3}
          value={value}
          placeholder={field.placeholder || ''}
          onChange={(e) => set(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          className="input"
          type="number"
          min={field.min ?? 0}
          step={field.step}
          value={value}
          placeholder={field.placeholder || ''}
          onChange={(e) => set(e.target.value)}
        />
      );
    case 'select': {
      const source = field.options || refOptions[field.name] || [];
      const options = source.map((opt) =>
        typeof opt === 'object'
          ? opt
          : { value: opt, label: field.formatOption ? field.formatOption(opt) : String(opt) }
      );
      return (
        <select className="input" value={value} onChange={(e) => set(e.target.value)}>
          <option value="">— select —</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    case 'ref': {
      const options = refOptions[field.name] || [];
      const label = (opt) =>
        typeof field.optionLabel === 'function'
          ? field.optionLabel(opt)
          : `${opt.name || opt.registrationNumber}${opt.phone ? ` — ${opt.phone}` : ''}`;
      return (
        <select className="input" value={value} onChange={(e) => set(e.target.value)} required>
          <option value="">— select —</option>
          {options.map((opt) => (
            <option key={opt._id} value={opt._id}>
              {label(opt)}
            </option>
          ))}
        </select>
      );
    }
    case 'checkbox':
      return (
        <div style={{ paddingTop: 6 }}>
          <label className="checkbox-line">
            <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} />
            {field.checkLabel || field.label}
          </label>
        </div>
      );
    case 'tags':
      return (
        <input
          className="input"
          value={value}
          placeholder={field.placeholder || 'Comma separated'}
          onChange={(e) => set(e.target.value)}
        />
      );
    default:
      return (
        <input
          className="input"
          value={value}
          required={field.required !== false}
          placeholder={field.placeholder || ''}
          onChange={(e) => set(e.target.value)}
        />
      );
  }
}
