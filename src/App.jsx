// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginSelection from './pages/LoginSelection';
import AdminPinLogin from './pages/AdminPinLogin';
import CashierPinLogin from './pages/CashierPinLogin';
import DashboardLayout from './layouts/DashboardLayout';
import AdminDashboard from './pages/AdminDashboard';
import StockManagement from './pages/StockManagement';
import CashierManagement from './pages/CashierManagement';
import SalesReport from './pages/SalesReport';
import VoidReceipts from './pages/VoidReceipts';
import CashierPOS from './pages/CashierPOS';
import ProtectedRoute from './components/ProtectedRoute';
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Public Login Routes */}
        <Route path="/" element={<LoginSelection />} />
        <Route path="/admin-login" element={<AdminPinLogin />} />
        <Route path="/cashier-login" element={<CashierPinLogin />} />

        {/* Protected Admin Routes (Includes Dashboard, Stocks, Cashiers, Sales, and Voids) */}
        <Route path="/admin" element={
          <ProtectedRoute requiredRole="admin">
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="stocks" element={<StockManagement />} />
          <Route path="cashiers" element={<CashierManagement />} />
          <Route path="sales" element={<SalesReport />} />
          <Route path="voids" element={<VoidReceipts />} />
        </Route>

        {/* Protected Cashier Routes (POS Terminal) */}
        <Route path="/cashier/pos" element={
          <ProtectedRoute requiredRole="cashier">
            <CashierPOS />
          </ProtectedRoute>
        } />
        
        <Route path="/unauthorized" element={<Unauthorized />} />
        {/* 404 - Page Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
