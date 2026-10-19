import CrudManager from '../components/CrudManager.jsx';
import { useAuth } from '../auth.jsx';
import { formatUGX } from '../format.js';

const FIELDS = [
  { name: 'name', label: 'Service name', placeholder: 'Wheel alignment' },
  {
    name: 'price',
    label: 'Charge (UGX)',
    type: 'number',
    min: 0,
    step: 1000,
    placeholder: '0 = parts + labour',
  },
  {
    name: 'isFixed',
    label: 'Fixed charge',
    type: 'checkbox',
    checkLabel: 'Fixed charge (alignment / balance style — not labour-based)',
  },
  { name: 'description', label: 'Description', type: 'textarea', wide: true, required: false },
];

export default function Services() {
  const { isStaff, isAdmin } = useAuth();
  return (
    <CrudManager
      title="Service Catalogue"
      subtitle="Engine oil & filters, gearbox oil, brake fluids, brake pads, greasing, minor repairs, alignment and balancing."
      singular="service"
      endpoint="/services"
      fields={FIELDS}
      defaultValues={{ name: '', price: 0, isFixed: false, description: '' }}
      readOnly={!isStaff}
      canDelete={() => isAdmin}
      searchKeys={[(r) => r.name, (r) => r.description]}
      columns={[
        { label: 'Service', render: (r) => <span className="strong">{r.name}</span> },
        { label: 'Description', render: (r) => r.description || '—', className: 'muted small' },
        {
          label: 'Charge',
          align: 'right',
          render: (r) =>
            r.price > 0 ? (
              <span className="strong">{formatUGX(r.price)}</span>
            ) : (
              <span className="muted">parts + labour</span>
            ),
        },
        {
          label: 'Kind',
          render: (r) =>
            r.isFixed ? (
              <span className="badge badge-received">Fixed charge</span>
            ) : (
              <span className="badge badge-neutral">Parts + labour</span>
            ),
        },
      ]}
    />
  );
}
