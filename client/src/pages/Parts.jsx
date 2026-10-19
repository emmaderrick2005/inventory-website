import CrudManager from '../components/CrudManager.jsx';
import { useAuth } from '../auth.jsx';
import { formatUGX } from '../format.js';

const categoryLabel = (value) =>
  value
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const FIELDS = [
  { name: 'name', label: 'Part name', placeholder: 'Oil Filter (Small)' },
  { name: 'category', label: 'Category', type: 'select', fetch: '/parts/meta/categories', formatOption: categoryLabel },
  { name: 'price', label: 'Selling price (UGX)', type: 'number', min: 0, step: 500 },
  { name: 'stock', label: 'Stock on hand', type: 'number', min: 0 },
  { name: 'unit', label: 'Unit', placeholder: 'piece / bottle / litre / set' },
  { name: 'reorderLevel', label: 'Reorder level', type: 'number', min: 0 },
];

export default function Parts() {
  const { isStaff, isAdmin } = useAuth();
  return (
    <CrudManager
      title="Parts & Stock"
      subtitle="Service / repair parts on sale: filters, engine and gearbox oil, brake fluids, pads and more (prices in UGX)."
      singular="part"
      endpoint="/parts"
      fields={FIELDS}
      defaultValues={{ name: '', category: '', price: 0, stock: 0, unit: 'piece', reorderLevel: 5 }}
      readOnly={!isStaff}
      canDelete={() => isAdmin}
      searchKeys={[(r) => r.name, (r) => r.category, (r) => r.unit]}
      columns={[
        { label: 'Part', render: (r) => <span className="strong">{r.name}</span> },
        {
          label: 'Category',
          render: (r) => <span className="badge badge-neutral">{categoryLabel(r.category)}</span>,
        },
        { label: 'Price', align: 'right', render: (r) => <span className="strong">{formatUGX(r.price)}</span> },
        {
          label: 'Stock',
          align: 'right',
          render: (r) =>
            r.stock <= r.reorderLevel ? (
              <span className="badge badge-unpaid">
                {r.stock} {r.unit}s
              </span>
            ) : (
              <span className="badge badge-paid">
                {r.stock} {r.unit}s
              </span>
            ),
        },
        { label: 'Reorder at', align: 'right', render: (r) => r.reorderLevel, className: 'muted' },
      ]}
    />
  );
}
