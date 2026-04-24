"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

export type Disaster = {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  type: "fire" | "accident" | "flood" | "hazard";
  description: string | null;
  full_name: string;
  contact_number: string | null;
  status: "active" | "resolved";
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type DataContextType = {
  disasters: Disaster[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, tabVisible } = useAuth();
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDisasters = useCallback(async () => {
    if (!user) {
      setDisasters([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("disasters")
        .select("*")
        .order("reported_at", { ascending: false });

      if (error) throw error;
      setDisasters(data || []);
    } catch (err) {
      console.error("Failed to fetch disasters:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch disasters");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const refetch = useCallback(() => {
    fetchDisasters();
  }, [fetchDisasters]);

  useEffect(() => {
    fetchDisasters();
  }, [fetchDisasters]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("disasters-central")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "disasters" },
        (payload) => {
          setDisasters((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as Disaster, ...prev];
            } else if (payload.eventType === "UPDATE") {
              return prev.map((d) =>
                d.id === payload.new.id ? (payload.new as Disaster) : d
              );
            } else if (payload.eventType === "DELETE") {
              return prev.filter((d) => d.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (tabVisible) {
      refetch();
    }
  }, [tabVisible, refetch]);

  return (
    <DataContext.Provider value={{ disasters, isLoading, error, refetch }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}