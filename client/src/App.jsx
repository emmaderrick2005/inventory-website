import { NavLink, Route, Routes } from 'react-router-dom';
import { ROLE_LABELS, useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import JobCards from './pages/JobCards.jsx';
import JobCardForm from './pages/JobCardForm.jsx';
import JobCardDetail from './pages/JobCardDetail.jsx';
import Receipt from './pages/Receipt.jsx';
import Customers from './pages/Customers.jsx';
import Vehicles from './pages/Vehicles.jsx';
import Services from './pages/Services.jsx';
import Parts from './pages/Parts.jsx';
import Technicians from './pages/Technicians.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/jobcards', label: 'Job Cards', icon: '▤' },
  { to: '/customers', label: 'Customers', icon: '☺' },
  { to: '/vehicles', label: 'Vehicles', icon: '🚗' },
  { to: '/parts', label: 'Parts & Stock', icon: '⚙' },
  { to: '/services', label: 'Service Catalogue', icon: '✓' },
  { to: '/technicians', label: 'Technicians', icon: '🛠' },
  { to: '/reports', label: 'Monthly Reports', icon: '📊' },
];

export default function App() {
  const { user, ready, logout, isAdmin } = useAuth();

  if (!ready) {
    return (
      <div className="login-wrap">
        <div className="spinner">Loading OAS Bay…</div>
      </div>
    );
  }

  if (!user) return <Login />;

  const nav = isAdmin ? [...NAV, { to: '/users', label: 'User Accounts', icon: '👤' }] : NAV;

  return (
    <div className="layout">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="brand-logo">OAS</div>
          <div>
            <strong>Oyera Auto Service Bay</strong>
            <span>Records Management</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div>
            <strong>{user.name}</strong>
            <span>{ROLE_LABELS[user.role] || user.role}</span>
          </div>
          <button className="btn btn-sm" onClick={logout} title="Sign out">
            Logout
          </button>
        </div>
        <div className="sidebar-foot">
          All amounts in UGX
          <br />
          Refactory · Software Engineering
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobcards" element={<JobCards />} />
          <Route path="/jobcards/new" element={<JobCardForm />} />
          <Route path="/jobcards/:id" element={<JobCardDetail />} />
          <Route path="/jobcards/:id/edit" element={<JobCardForm />} />
          <Route path="/jobcards/:id/receipt" element={<Receipt />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/services" element={<Services />} />
          <Route path="/parts" element={<Parts />} />
          <Route path="/technicians" element={<Technicians />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/users" element={<Users />} />
          <Route path="*" element={<div className="empty">Page not found.</div>} />
        </Routes>
      </main>
    </div>
  );
}
