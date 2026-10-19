import CrudManager from '../components/CrudManager.jsx';
import { useAuth } from '../auth.jsx';

const FIELDS = [
  { name: 'name', label: 'Full name' },
  { name: 'email', label: 'Email' },
  { name: 'role', label: 'Role', type: 'select', fetch: '/users/meta/roles' },
  { name: 'password', label: 'Password', type: 'text', required: false, placeholder: 'min 6 characters' },
  { name: 'active', label: 'Account active', type: 'checkbox', checkLabel: 'Account is active' },
];

export default function Users() {
  const { isAdmin, user } = useAuth();

  if (!isAdmin) {
    return <div className="alert alert-error">User accounts can only be managed by an administrator.</div>;
  }

  return (
    <CrudManager
      title="User Accounts"
      subtitle="Who can sign in to the records system: administrators, senior technicians and receptionists."
      singular="user"
      endpoint="/users"
      fields={FIELDS}
      defaultValues={{ name: '', email: '', role: 'reception', password: '', active: true }}
      searchKeys={[(r) => r.name, (r) => r.email, (r) => r.role]}
      canDelete={(row) => String(row._id) !== String(user?._id)}
      columns={[
        { label: 'Name', render: (r) => <span className="strong">{r.name}</span> },
        { label: 'Email', render: (r) => r.email },
        {
          label: 'Role',
          render: (r) => (
            <span className={`badge ${r.role === 'admin' ? 'badge-released' : r.role === 'senior' ? 'badge-received' : 'badge-neutral'}`}>
              {r.role === 'admin' ? 'Administrator' : r.role === 'senior' ? 'Senior technician' : 'Receptionist'}
            </span>
          ),
        },
        {
          label: 'Status',
          render: (r) => (
            <span className={`badge ${r.active ? 'badge-paid' : 'badge-unpaid'}`}>
              {r.active ? 'Active' : 'Deactivated'}
            </span>
          ),
        },
      ]}
    />
  );
}
