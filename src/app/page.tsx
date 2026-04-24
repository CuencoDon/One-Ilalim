"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/lib/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/app/components/Map"), {
  ssr: false,
  // No loading component – the map will appear immediately when ready
});

type Disaster = {
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

type EvacuationSite = {
  id: string;
  official_id: string;
  official_name: string;
  lat: number;
  lng: number;
  title: string;
  description: string | null;
  created_at: string;
  status: "available" | "full";
};

export default function UnifiedMapPage() {
  const { user, userRole, isLoading: authLoading, tabVisible } = useAuth();

  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [evacuationSites, setEvacuationSites] = useState<EvacuationSite[]>([]);
  const [reporterRoleMap, setReporterRoleMap] = useState<Record<string, string>>({});
  const [resolvedByNameMap, setResolvedByNameMap] = useState<Record<string, string>>({});
  const [officialPhoneMap, setOfficialPhoneMap] = useState<Record<string, string>>({});
  const [focusDisaster, setFocusDisaster] = useState<{ id: string; key: number } | null>(null);
  const [focusEvacuationSite, setFocusEvacuationSite] = useState<{ id: string; key: number } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setDisasters([]);
      setEvacuationSites([]);
      setReporterRoleMap({});
      setResolvedByNameMap({});
      setOfficialPhoneMap({});
      return;
    }

    try {
      const [disastersRes, sitesRes, profilesRes] = await Promise.all([
        supabase.from("disasters").select("*").order("reported_at", { ascending: false }),
        supabase.from("evacuation_sites").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, role, first_name, last_name, contact_number"),
      ]);

      const { data: disastersData, error: disastersError } = disastersRes;
      const { data: sitesData, error: sitesError } = sitesRes;
      const { data: profilesData, error: profilesError } = profilesRes;

      if (!disastersError && disastersData) {
        setDisasters(disastersData);
      }
      if (!sitesError && sitesData) {
        setEvacuationSites(sitesData);
      }

      if (!profilesError && profilesData) {
        const roleMap: Record<string, string> = {};
        const phoneMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};

        profilesData.forEach((p) => {
          if (p.role) roleMap[p.id] = p.role;
          if (p.contact_number) phoneMap[p.id] = p.contact_number;
          nameMap[p.id] = `${p.first_name} ${p.last_name}`.trim();
        });

        setReporterRoleMap(roleMap);
        setOfficialPhoneMap(phoneMap);

        if (!disastersError && disastersData) {
          const resolvedMap: Record<string, string> = {};
          disastersData.forEach((d: any) => {
            if (d.resolved_by) resolvedMap[d.resolved_by] = nameMap[d.resolved_by] || "Unknown";
          });
          setResolvedByNameMap(resolvedMap);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [user, fetchData]);

  useEffect(() => {
    if (tabVisible) {
      fetchData();
    }
  }, [tabVisible, fetchData]);

  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchData();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        fetchData();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, fetchData]);

  const handleFocusDisaster = useCallback((id: string) => {
    setFocusDisaster(id ? { id, key: Date.now() } : null);
  }, []);

  const handleFocusEvacuationSite = useCallback((id: string) => {
    setFocusEvacuationSite(id ? { id, key: Date.now() } : null);
  }, []);

  const updateEvacuationDescription = useCallback(async (id: string, newDescription: string) => {
    const { error } = await supabase
      .from("evacuation_sites")
      .update({ description: newDescription || null })
      .eq("id", id);
    if (!error) {
      setEvacuationSites(prev =>
        prev.map(site =>
          site.id === id ? { ...site, description: newDescription || null } : site
        )
      );
    }
  }, []);

  useEffect(() => {
    const disastersChannel = supabase
      .channel("disasters")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "disasters" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newDisaster = payload.new as Disaster;
            const { data: profile } = await supabase
              .from("profiles")
              .select("role, first_name, last_name")
              .eq("id", newDisaster.user_id)
              .single();
            if (profile) {
              setReporterRoleMap((prev) => ({ ...prev, [newDisaster.user_id]: profile.role }));
              const name = `${profile.first_name} ${profile.last_name}`.trim();
              setResolvedByNameMap((prev) => ({ ...prev, [newDisaster.user_id]: name }));
            }
            setDisasters((prev) => {
              if (prev.some((d) => d.id === newDisaster.id)) return prev;
              setFocusDisaster({ id: newDisaster.id, key: Date.now() });
              return [newDisaster, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Disaster;
            setDisasters((prev) =>
              prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
            );
            setFocusDisaster({ id: updated.id, key: Date.now() });
          } else if (payload.eventType === "DELETE") {
            setDisasters((prev) => prev.filter((d) => d.id !== payload.old.id));
            setFocusDisaster((current) => 
              current?.id === payload.old.id ? null : current
            );
          }
        }
      )
      .subscribe();

    const evacChannel = supabase
      .channel("evacuation_sites")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evacuation_sites" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newSite = payload.new as EvacuationSite;
            const { data: profile } = await supabase
              .from("profiles")
              .select("contact_number")
              .eq("id", newSite.official_id)
              .single();
            if (profile?.contact_number) {
              setOfficialPhoneMap((prev) => ({ ...prev, [newSite.official_id]: profile.contact_number }));
            }
            setEvacuationSites((prev) => {
              if (prev.some((s) => s.id === newSite.id)) return prev;
              setFocusEvacuationSite({ id: newSite.id, key: Date.now() });
              return [newSite, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as EvacuationSite;
            setEvacuationSites((prev) =>
              prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
            );
            setFocusEvacuationSite({ id: updated.id, key: Date.now() });
          } else if (payload.eventType === "DELETE") {
            setEvacuationSites((prev) => prev.filter((s) => s.id !== payload.old.id));
            setFocusEvacuationSite((current) => 
              current?.id === payload.old.id ? null : current
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(disastersChannel).catch(() => {});
      supabase.removeChannel(evacChannel).catch(() => {});
    };
  }, []);

  // Always show the map immediately – no loading spinner
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="relative h-full w-full"
    >
      <Map
        key={user?.id || "no-user"}
        disasters={disasters}
        evacuationSites={evacuationSites}
        currentUser={user}
        currentUserRole={userRole}
        focusDisaster={focusDisaster}
        focusEvacuationSite={focusEvacuationSite}
        onFocusDisaster={handleFocusDisaster}
        onFocusEvacuationSite={handleFocusEvacuationSite}
        reporterRoleMap={reporterRoleMap}
        resolvedByNameMap={resolvedByNameMap}
        officialPhoneMap={officialPhoneMap}
        onUpdateEvacuationDescription={updateEvacuationDescription}
        readOnly={false}
      />

      <AnimatePresence>
        {!user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-[2000] flex items-center justify-center bg-white/20 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2 }}
              className="inline-flex w-auto max-w-[92vw] flex-col rounded-xl bg-white px-5 py-6 shadow-xl"
            >
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Lock size={24} className="text-blue-700" />
                </div>
              </div>
              <h3 className="mb-2 text-center text-lg font-semibold text-blue-900">Locked</h3>
              <p className="text-center text-sm text-gray-700">
                Sign up or log in to view and report disasters and evacuation sites.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}