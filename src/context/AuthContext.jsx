// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { auth, signOut } from "../firebase/firebaseConfig";

const AuthContext = createContext();

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours max session life

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inactivityNotice, setInactivityNotice] = useState(false);
  const inactivityTimerRef = useRef(null);

  // Perform logout
  const logout = useCallback(async (reason = null) => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    try {
      await signOut(auth);
    } catch {
      // Ignore if not signed in with Firebase Auth
    }

    localStorage.removeItem("bulsu_user");
    sessionStorage.removeItem("bulsu_user");

    setUser(null);
    setRole(null);

    if (reason === "inactivity") {
      setInactivityNotice(true);
    }
  }, []);

  // Reset inactivity timer on user activity
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Only set timer if user is actively logged in
    inactivityTimerRef.current = setTimeout(() => {
      logout("inactivity");
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  // Perform login
  const login = useCallback((userData) => {
    const session = {
      ...userData,
      sessionId: window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now()),
      loginTime: Date.now(),
      expiresAt: Date.now() + SESSION_MAX_AGE_MS,
    };

    localStorage.setItem("bulsu_user", JSON.stringify(session));
    sessionStorage.setItem("bulsu_user", JSON.stringify(session));

    setUser(session);
    setRole(session.role);
    setInactivityNotice(false);

    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Initial load from storage with expiration check
  useEffect(() => {
    const loadSavedSession = () => {
      try {
        const stored = sessionStorage.getItem("bulsu_user") || localStorage.getItem("bulsu_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = Date.now();

          // Check if session has expired
          if (parsed.expiresAt && now > parsed.expiresAt) {
            localStorage.removeItem("bulsu_user");
            sessionStorage.removeItem("bulsu_user");
            setUser(null);
            setRole(null);
          } else {
            setUser(parsed);
            setRole(parsed.role);
            resetInactivityTimer();
          }
        }
      } catch {
        localStorage.removeItem("bulsu_user");
        sessionStorage.removeItem("bulsu_user");
        setUser(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    loadSavedSession();
  }, [resetInactivityTimer]);

  // Inactivity activity listeners
  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    let throttleTimer = null;

    const handleActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          resetInactivityTimer();
          throttleTimer = null;
        }, 1000); // Throttled to at most once per second
      }
    };

    events.forEach((evt) => window.addEventListener(evt, handleActivity));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      if (throttleTimer) clearTimeout(throttleTimer);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user, resetInactivityTimer]);

  const clearInactivityNotice = () => setInactivityNotice(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        login,
        logout,
        loading,
        inactivityNotice,
        clearInactivityNotice,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
