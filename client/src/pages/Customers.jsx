import CrudManager from '../components/CrudManager.jsx';
import { useAuth } from '../auth.jsx';

const FIELDS = [
  { name: 'name', label: 'Full name / company' },
  { name: 'phone', label: 'Phone number', placeholder: '0772 000 000' },
  { name: 'email', label: 'Email (optional)', required: false },
  { name: 'address', label: 'Address (optional)', required: false },
];

export default function Customers() {
  const { isStaff } = useAuth();
  return (
    <CrudManager
      title="Customers"
      subtitle="Car owners who bring heavy, small and commercial cars to the bay."
      singular="customer"
      endpoint="/customers"
      fields={FIELDS}
      defaultValues={{ name: '', phone: '', email: '', address: '' }}
      searchKeys={[(r) => r.name, (r) => r.phone, (r) => r.address, (r) => r.email]}
      canDelete={() => isStaff}
      columns={[
        { label: 'Name', render: (r) => <span className="strong">{r.name}</span> },
        { label: 'Phone', render: (r) => r.phone },
        { label: 'Address', render: (r) => r.address || '—', className: 'muted' },
        { label: 'Email', render: (r) => r.email || '—', className: 'muted small' },
      ]}
    />
  );
}
