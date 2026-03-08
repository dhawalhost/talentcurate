import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InterviewRoom from './pages/InterviewRoom';
import SSOCallback from './pages/SSOCallback';
import AdminDashboard from './pages/AdminDashboard';
import CalendarPage from './pages/CalendarPage';
import PrepPage from './pages/PrepPage';
import Settings from './pages/Settings';

import React from 'react';

// Basic wrapper to check local storage token
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('talentcurate_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/sso-callback" element={<SSOCallback />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        {/* The interview room accepts guests, no auth protecting it right now because guests have tokens */}
        <Route path="/interview/:session_id" element={<InterviewRoom />} />
        <Route path="/interview" element={<InterviewRoom />} />
        <Route
          path="/prep/:session_id"
          element={
            <ProtectedRoute>
              <PrepPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
