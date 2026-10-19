import CrudManager from '../components/CrudManager.jsx';
import { useAuth } from '../auth.jsx';

const TYPE_LABELS = {
  small: 'Small car',
  heavy: 'Heavy vehicle',
  commercial: 'Commercial',
};

const FIELDS = [
  { name: 'registrationNumber', label: 'Registration number', placeholder: 'UAB 123X' },
  { name: 'owner', label: 'Owner', type: 'ref', fetch: '/customers', optionLabel: (c) => `${c.name} — ${c.phone}` },
  { name: 'make', label: 'Make' },
  { name: 'model', label: 'Model' },
  {
    name: 'type',
    label: 'Vehicle type',
    type: 'select',
    options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
  },
];

export default function Vehicles() {
  const { isStaff } = useAuth();
  return (
    <CrudManager
      title="Vehicles"
      subtitle="Cars served at the bay — small, heavy and commercial."
      singular="vehicle"
      endpoint="/vehicles"
      fields={FIELDS}
      defaultValues={{ registrationNumber: '', owner: '', make: '', model: '', type: 'small' }}
      searchKeys={[
        (r) => r.registrationNumber,
        (r) => r.make,
        (r) => r.model,
        (r) => r.owner?.name,
      ]}
      columns={[
        {
          label: 'Registration',
          render: (r) => <span className="strong">{r.registrationNumber}</span>,
        },
        { label: 'Vehicle', render: (r) => `${r.make} ${r.model}` },
        {
          label: 'Type',
          render: (r) => <span className="badge badge-neutral">{TYPE_LABELS[r.type] || r.type}</span>,
        },
        {
          label: 'Owner',
          render: (r) => (
            <>
              {r.owner?.name || '—'}
              <div className="muted small">{r.owner?.phone}</div>
            </>
          ),
        },
      ]}
      canDelete={() => isStaff}
    />
  );
}
