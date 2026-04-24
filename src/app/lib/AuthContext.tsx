"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { User } from "@supabase/supabase-js";

type UserMeta = {
  first_name?: string;
  last_name?: string;
  role?: string;
};

type AuthContextType = {
  user: User | null;
  userMeta: UserMeta | null;
  isLoading: boolean;
  userRole: string | null;
  tabVisible: boolean;
  triggerRefetch: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [tabVisible, setTabVisible] = useState(true);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const triggerRefetch = () => {
    setRefetchCounter(prev => prev + 1);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setUserMeta(session.user.user_metadata || null);
          
          try {
            const { data: profile, error } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", session.user.id)
              .single();
            
            if (!error && profile) {
              setUserRole(profile.role || session.user.user_metadata?.role || null);
            } else {
              setUserRole(session.user.user_metadata?.role || null);
            }
          } catch {
            setUserRole(session.user.user_metadata?.role || null);
          }
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          if (session) {
            setUser(session.user);
            setUserMeta(session.user.user_metadata || null);
            try {
              const { data: profile, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();
              
              if (!error && profile) {
                setUserRole(profile.role || session.user.user_metadata?.role || null);
              } else {
                setUserRole(session.user.user_metadata?.role || null);
              }
            } catch {
              setUserRole(session.user.user_metadata?.role || null);
            }
          } else {
            setUser(null);
            setUserMeta(null);
            setUserRole(null);
          }
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      setTabVisible(isVisible);
      if (isVisible) {
        triggerRefetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userMeta, isLoading, userRole, tabVisible, triggerRefetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}