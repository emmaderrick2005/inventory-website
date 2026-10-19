import CrudManager from '../components/CrudManager.jsx';
import { useAuth } from '../auth.jsx';

const FIELDS = [
  { name: 'name', label: 'Name' },
  { name: 'phone', label: 'Phone number', required: false },
  {
    name: 'role',
    label: 'Role',
    type: 'select',
    options: [
      { value: 'senior', label: 'Senior technician (assesses parts & oils)' },
      { value: 'technician', label: 'Technician' },
    ],
  },
  { name: 'skills', label: 'Skills', type: 'tags', wide: true, placeholder: 'Brakes, Gearbox, Alignment' },
];

export default function Technicians() {
  const { isStaff, isAdmin } = useAuth();
  return (
    <CrudManager
      title="Technicians"
      subtitle="One technician or more can handle a car service; a senior technician determines the parts and oils needed."
      singular="technician"
      endpoint="/technicians"
      fields={FIELDS}
      defaultValues={{ name: '', phone: '', role: 'technician', skills: '' }}
      readOnly={!isStaff}
      canDelete={() => isAdmin}
      searchKeys={[(r) => r.name, (r) => r.phone, (r) => r.skills?.join(' ')]}
      columns={[
        { label: 'Name', render: (r) => <span className="strong">{r.name}</span> },
        { label: 'Phone', render: (r) => r.phone || '—' },
        {
          label: 'Role',
          render: (r) =>
            r.role === 'senior' ? (
              <span className="badge badge-released">Senior</span>
            ) : (
              <span className="badge badge-neutral">Technician</span>
            ),
        },
        {
          label: 'Skills',
          render: (r) => (r.skills?.length ? r.skills.join(', ') : '—'),
          className: 'muted small',
        },
      ]}
    />
  );
}
