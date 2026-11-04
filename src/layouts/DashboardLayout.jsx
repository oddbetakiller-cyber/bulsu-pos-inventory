import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  AlertOctagon,
  LogOut,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ChangeAdminPinModal from "../components/ChangeAdminPinModal";
import ConfirmLogoutModal from "../components/ConfirmLogoutModal";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const { logout } = useAuth();

  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    setMenuOpen(false);
    navigate("/", { replace: true });
    await logout();
  };

  const isActive = (path) =>
    path === "/admin"
      ? location.pathname === "/admin" ||
        location.pathname === "/admin/dashboard"
      : location.pathname.startsWith(path);

  const navItems = [
    { to: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { to: "/admin/stocks", label: "Stock Management", Icon: Package },
    { to: "/admin/cashiers", label: "Cashier Accounts", Icon: Users },
    { to: "/admin/sales", label: "Sales Report", Icon: FileText },
    { to: "/admin/voids", label: "Void Receipts", Icon: AlertOctagon },
  ];

  return (
    <div className="dashboard-layout flex min-h-screen bg-gray-100">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="hamburger-button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>

        <div>
          <h1>BULSU ADMIN</h1>
          <p>POS &amp; Inventory System</p>
        </div>
      </header>

      {/* Mobile Overlay */}
      {menuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`dashboard-sidebar ${
          menuOpen ? "sidebar-open" : ""
        }`}
      >
        <div>
          <div className="sidebar-brand">
            <h1>BULSU ADMIN</h1>
            <p>POS &amp; Inventory System</p>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(({ to, label, Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`sidebar-link ${
                  isActive(to) ? "sidebar-link-active" : ""
                }`}
              >
                <Icon size={19} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="sidebar-logout space-y-2">
          <button
            onClick={() => setIsPinModalOpen(true)}
            className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition w-full p-2 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <KeyRound size={16} />
            <span>Change Admin PIN</span>
          </button>

          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="cursor-pointer"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <Outlet />
      </main>

      {/* Change Admin PIN Modal */}
      <ChangeAdminPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
      />

      {/* Confirm Logout Modal */}
      <ConfirmLogoutModal
        isOpen={isLogoutModalOpen}
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
};

export default DashboardLayout;
