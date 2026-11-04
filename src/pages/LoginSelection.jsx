// src/pages/LoginSelection.jsx
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, UserCheck, Clock, X } from 'lucide-react';
import bulsuLogo from "../assets/bulsu logo.jpg";
import { useAuth } from '../context/AuthContext';

const LoginSelection = () => {
  const navigate = useNavigate();
  const { inactivityNotice, clearInactivityNotice } = useAuth();

  return (
    <div className="min-h-screen bg-[#8B1E2D] flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-t-8 border-[#F4D35E]">
        {/* Inactivity Notification */}
        {inactivityNotice && (
          <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm text-left">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-700 shrink-0" />
              <span>You were automatically logged out due to 15 minutes of inactivity.</span>
            </div>
            <button
              onClick={clearInactivityNotice}
              className="text-amber-800 hover:text-amber-950 p-1"
              aria-label="Dismiss notice"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* BulSU Logo / Seal Placeholder */}
        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 rounded-full bg-[#8B1E2D] flex items-center justify-center shadow-inner overflow-hidden">
            <img
              src={bulsuLogo}
              alt="BulSU Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-widest text-gray-500 uppercase">Bulacan State University</h2>
        <h1 className="text-3xl font-black text-[#8B1E2D] mt-1 mb-8">BULSU POS & Inventory</h1>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/admin-login')}
            className="w-full bg-[#8B1E2D] hover:bg-[#6c1723] text-white py-4 rounded-xl font-extrabold text-lg shadow-lg flex items-center justify-center gap-3 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <ShieldAlert className="text-[#F4D35E]" size={24} /> ADMIN PORTAL
          </button>

          <button
            onClick={() => navigate('/cashier-login')}
            className="w-full bg-[#F4D35E] hover:bg-[#e2c14c] text-gray-900 py-4 rounded-xl font-extrabold text-lg shadow-lg flex items-center justify-center gap-3 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <UserCheck className="text-[#8B1E2D]" size={24} /> CASHIER PORTAL
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginSelection;
