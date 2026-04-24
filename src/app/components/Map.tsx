"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { disasterIcons, evacuationSiteAvailable, evacuationSiteFull } from "@/app/lib/leafletIcons";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import { User, CheckCircle2, Clock, Phone, AlertTriangle, Flame, Car, Waves, Trash2, Building2, XCircle, Pencil, MapPin } from "lucide-react";
import ActionPanel from "@/app/components/ActionPanel";

type DisasterType = "fire" | "accident" | "flood" | "hazard";

type Disaster = {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  type: DisasterType;
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

const BOUNDARY = {
  lat: { min: 14.8332, max: 14.8358 },  // vertical range unchanged
  lng: { min: 120.2775, max: 120.2801 }, // right side moved left by ~20%
};

const DEFAULT_CENTER: [number, number] = [14.8345, 120.2788];
const DEFAULT_ZOOM = 18; // increased for a closer view of the barangay

const DISASTER_TYPE_CONFIG: Record<DisasterType, { label: string; badge: string; icon: React.ElementType }> = {
  fire: { label: "Fire", badge: "bg-red-600", icon: Flame },
  accident: { label: "Accident", badge: "bg-orange-500", icon: Car },
  flood: { label: "Flood", badge: "bg-blue-600", icon: Waves },
  hazard: { label: "Hazard", badge: "bg-yellow-500", icon: AlertTriangle },
};

const isWithinBoundary = (lat: number, lng: number) =>
  lat >= BOUNDARY.lat.min && lat <= BOUNDARY.lat.max &&
  lng >= BOUNDARY.lng.min && lng <= BOUNDARY.lng.max;

const userLocationIcon = L.divIcon({
  html: `<div style="background-color: #1e3a8a; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
    <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
  </div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

function BoundaryLayer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const bounds = L.latLngBounds(
      [BOUNDARY.lat.min, BOUNDARY.lng.min],
      [BOUNDARY.lat.max, BOUNDARY.lng.max]
    );
    const rectangle = L.rectangle(bounds, {
      color: "#1e3a8a",
      weight: 2,
      opacity: 0.8,
      fillColor: "#1e3a8a",
      fillOpacity: 0.1,
    }).addTo(map);

    // Fit the map exactly to the bounds and prevent panning far away
    map.fitBounds(bounds, { padding: [20, 20] });
    map.setMaxBounds(bounds.pad(0.2));

    return () => { map.removeLayer(rectangle); };
  }, [map]);
  return null;
}

function ClickToPickLocation({
  onPick,
  onBoundaryError,
}: {
  onPick: (lat: number, lng: number) => void;
  onBoundaryError: () => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (isWithinBoundary(lat, lng)) {
        onPick(lat, lng);
      } else {
        onBoundaryError();
      }
    },
  });
  return null;
}

// Enhanced Routing Control with multi‑disaster avoidance
function CustomRoutingControl({
  userLocation,
  destination,
  disasters = [],
}: {
  userLocation: [number, number] | null;
  destination: [number, number] | null;
  disasters?: Disaster[];
}) {
  const map = useMap();
  const polylineRef = useRef<L.Polyline | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const distanceToSegment = (p: [number, number], a: [number, number], b: [number, number]) => {
    const [x, y] = p;
    const [x1, y1] = a;
    const [x2, y2] = b;
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const len2 = C * C + D * D;
    if (len2 === 0) return Math.hypot(A, B);
    let t = dot / len2;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const projX = x1 + t * C;
    const projY = y1 + t * D;
    return Math.hypot(x - projX, y - projY);
  };

  const offsetPoint = (lat: number, lng: number, direction: [number, number], distance: number) => {
    const [dx, dy] = direction;
    const norm = Math.hypot(dx, dy);
    if (norm === 0) return [lat, lng];
    const ux = dy / norm;
    const uy = -dx / norm;
    return [lat + ux * distance, lng + uy * distance];
  };

  useEffect(() => {
    if (!map || !userLocation || !destination) return;

    let active = true;

    const fetchRoute = async (): Promise<void> => {
      if (!active) return;

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      let coords = `${userLocation[1]},${userLocation[0]};${destination[1]},${destination[0]}`;
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

      try {
        const response = await fetch(url, { signal: abortControllerRef.current.signal });
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return;

        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );

        const activeDisasters = disasters.filter(d => d.status === "active");
        const THRESHOLD = 0.0003; // ~30 meters (tighter to avoid false positives)
        const OFFSET = 0.0006; // ~60 meters detour (forces snapping to a parallel street)
        let foundAny = false;
        
        // Track disasters we've already detoured around in this pass
        const avoidedDisasters = new Set<string>();
        const newWaypoints: [number, number][] = [];

        // Walking the line guarantees waypoints are pushed in chronological order
        for (let i = 0; i < coordinates.length - 1; i++) {
          const a = coordinates[i];
          const b = coordinates[i + 1];
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          
          for (const disaster of activeDisasters) {
            if (avoidedDisasters.has(disaster.id)) continue;

            const dist = distanceToSegment([disaster.lat, disaster.lng], a, b);
            if (dist < THRESHOLD) {
              foundAny = true;
              avoidedDisasters.add(disaster.id);
              const direction: [number, number] = [dx, dy];
              
              // Push a small detour perpendicular to the street
              const [offLat, offLng] = offsetPoint(disaster.lat, disaster.lng, direction, OFFSET);
              newWaypoints.push([offLat, offLng]);
            }
          }
        }

        let finalCoordinates = coordinates;

        // If hazards are found, compute exactly ONE alternative path using the ordered detours
        if (foundAny && newWaypoints.length > 0 && newWaypoints.length <= 10) {
          let detourCoords = `${userLocation[1]},${userLocation[0]}`;
          for (const wp of newWaypoints) {
            detourCoords += `;${wp[1]},${wp[0]}`;
          }
          detourCoords += `;${destination[1]},${destination[0]}`;
          
          const detourUrl = `https://router.project-osrm.org/route/v1/driving/${detourCoords}?overview=full&geometries=geojson`;
          const detourResponse = await fetch(detourUrl, { signal: abortControllerRef.current.signal });
          const detourData = await detourResponse.json();
          
          if (detourData.routes && detourData.routes.length > 0) {
            finalCoordinates = detourData.routes[0].geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
            );
          }
        }

        if (polylineRef.current) polylineRef.current.remove();
        polylineRef.current = L.polyline(finalCoordinates, {
          color: "#10b981", // Single solid green line
          weight: 5,
          opacity: 0.8,
        }).addTo(map);

        map.fitBounds(L.polyline(finalCoordinates).getBounds(), { padding: [50, 50] });
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          console.error("Routing error:", error);
        }
      }
    };

    fetchRoute();

    return () => {
      active = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (polylineRef.current) polylineRef.current.remove();
    };
  }, [map, userLocation, destination, disasters]);

  return null;
}

function DisasterPopupContent({
  disaster,
  role,
  user,
  onFocus,
  reporterRoleMap,
  resolvedByNameMap,
}: {
  disaster: Disaster;
  role: string | null;
  user: any;
  onFocus?: (id: string) => void;
  reporterRoleMap: Record<string, string>;
  resolvedByNameMap: Record<string, string>;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (onFocus) onFocus(disaster.id);
  }, [disaster.id, onFocus]);

  const handleResolve = async () => {
    setIsUpdating(true);
    try {
      await supabase
        .from("disasters")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", disaster.id);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await supabase.from("disasters").delete().eq("id", disaster.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const reporterRole = reporterRoleMap[disaster.user_id];
  const typeConfig = DISASTER_TYPE_CONFIG[disaster.type];
  const TypeIcon = typeConfig.icon;

  const isOfficial = role === "official";
  const isReporter = disaster.user_id === user?.id;

  const showResolveButton = isOfficial && disaster.status === "active";
  const canDelete = isOfficial || (isReporter && disaster.status === "active");
  const showDeleteButton = canDelete;

  const canSeeDetails =
    role === "official" ||
    isReporter ||
    reporterRole === "official";

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleString();
  };

  const reportedTime = formatTime(disaster.reported_at);
  const resolvedTime = formatTime(disaster.resolved_at);
  const resolverName = disaster.resolved_by ? resolvedByNameMap[disaster.resolved_by] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative font-sans text-center"
    >
      {(isUpdating || isDeleting) && <div className="absolute inset-0 backdrop-blur-sm bg-white/30 z-10" />}
      <div className="relative z-20 flex flex-col gap-1">
        <div className="flex flex-row flex-nowrap gap-1.5 justify-center">
          <span
            className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium ${disaster.status === "active"
                ? "bg-red-600 text-white"
                : "bg-green-600 text-white"
              }`}
          >
            {disaster.status === "active" ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            <span>{disaster.status === "active" ? "Active" : "Resolved"}</span>
          </span>

          <span
            className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium text-white ${typeConfig.badge}`}
          >
            <TypeIcon className="w-3 h-3" />
            <span>{typeConfig.label}</span>
          </span>

          {reporterRole && (
            <span
              className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium ${reporterRole === "official" ? "bg-blue-700 text-white" : "bg-gray-500 text-white"
                }`}
            >
              <User className="w-3 h-3" />
              <span>{reporterRole === "official" ? "Brgy. Official" : "Resident"}</span>
            </span>
          )}
        </div>

        <div className="text-[10px] text-gray-600">Reported: {reportedTime}</div>

        {disaster.status === "resolved" && (
          <div className="text-[10px] text-gray-600">
            Resolved by {resolverName || "Unknown"} at {resolvedTime}
          </div>
        )}

        {disaster.type === "hazard" && disaster.description && (
          <div className="p-1 bg-gray-50 rounded border border-gray-200 text-xs text-gray-800 break-words">
            {disaster.description}
          </div>
        )}

        {canSeeDetails && (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-black" />
              <span className="text-xs font-medium text-black">{disaster.full_name}</span>
            </div>
            {disaster.contact_number && (
              <>
                <span className="text-xs text-black">•</span>
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-black" />
                  <span className="text-xs text-black">{disaster.contact_number}</span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-center gap-2 mt-0.5">
          {showResolveButton && (
            <button
              onClick={handleResolve}
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {isUpdating ? "Resolving..." : "Resolve"}
            </button>
          )}
          {showDeleteButton && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EvacuationSitePopupContent({
  site,
  role,
  user,
  onFocus,
  officialPhoneMap,
  onUpdateDescription,
  onRequestRoute,
}: {
  site: EvacuationSite;
  role: string | null;
  user: any;
  onFocus?: (id: string) => void;
  officialPhoneMap: Record<string, string>;
  onUpdateDescription: (id: string, newDescription: string) => Promise<void>;
  onRequestRoute: (site: EvacuationSite) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(site.description || "");

  useEffect(() => {
    if (onFocus) onFocus(site.id);
  }, [site.id, onFocus]);

  const handleStatusToggle = async () => {
    if (!isOfficial) return;
    setIsUpdating(true);
    try {
      await supabase
        .from("evacuation_sites")
        .update({ status: site.status === "available" ? "full" : "available" })
        .eq("id", site.id);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await supabase.from("evacuation_sites").delete().eq("id", site.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveDescription = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editDesc === site.description) {
      setIsEditingDesc(false);
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdateDescription(site.id, editDesc.trim());
      setIsEditingDesc(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditDesc(site.description || "");
    setIsEditingDesc(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingDesc(true);
  };

  const handleRouteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRequestRoute(site);
  };

  const isOfficial = role === "official";
  const isCreator = site.official_id === user?.id;

  const showStatusToggle = isOfficial;
  const canDelete = isOfficial || isCreator;

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative font-sans text-center"
    >
      {(isUpdating || isDeleting) && <div className="absolute inset-0 backdrop-blur-sm bg-white/30 z-10" />}
      <div className="relative z-20 flex flex-col gap-1">
        <div className="flex flex-row flex-nowrap gap-1.5 justify-center">
          <span
            className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium ${site.status === "available" ? "bg-green-600 text-white" : "bg-red-600 text-white"
              }`}
          >
            {site.status === "available" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            <span>{site.status === "available" ? "Available" : "Full"}</span>
          </span>

          <span className="flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium bg-green-600 text-white">
            <Building2 className="w-3 h-3" />
            <span>Evacuation Site</span>
          </span>
        </div>

        <div className="text-center font-semibold text-xs text-black break-words">{site.title}</div>

        <div className="relative pt-1">
          {isEditingDesc ? (
            <div className="flex flex-col gap-1">
              <textarea
                rows={2}
                className="w-full rounded border border-gray-300 p-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={500}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex justify-center gap-2">
                <button
                  onClick={handleSaveDescription}
                  disabled={isUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white py-0.5 px-2 rounded text-[10px]"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-0.5 px-2 rounded text-[10px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {site.description ? (
                <div className="p-1 bg-gray-50 rounded border border-gray-200 text-xs text-gray-800 break-words">
                  {site.description}
                </div>
              ) : (
                <div className="text-[10px] text-gray-500 italic">No description</div>
              )}
              {isOfficial && (
                <button
                  onClick={handleEditClick}
                  className="absolute -mt-1.5 -mr-1 top-0 right-0 bg-transparent p-0.5 text-gray-500 hover:text-gray-700"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>

        <div className="text-[10px] text-gray-600">Added: {formatTime(site.created_at)}</div>

        <div className="flex items-center justify-center gap-1">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-black" />
            <span className="text-xs font-medium text-black">{site.official_name}</span>
          </div>
          {officialPhoneMap[site.official_id] && (
            <>
              <span className="text-xs text-black">•</span>
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-black" />
                <span className="text-xs text-black">{officialPhoneMap[site.official_id]}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-center gap-2 mt-0.5">
          <button
            onClick={handleRouteClick}
            className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/80 text-white py-1 px-3 rounded-md text-xs font-medium transition-colors"
          >
            Get Route
          </button>

          {showStatusToggle && (
            <button
              onClick={handleStatusToggle}
              disabled={isUpdating}
              className={`${site.status === "available" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                } text-white py-1 px-3 rounded-md text-xs font-medium disabled:opacity-50 transition-colors`}
            >
              {isUpdating ? "Updating..." : site.status === "available" ? "Mark Full" : "Mark Available"}
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Map({
  disasters = [],
  evacuationSites = [],
  currentUser,
  currentUserRole,
  focusDisaster,
  focusEvacuationSite,
  onFocusDisaster,
  onFocusEvacuationSite,
  reporterRoleMap = {},
  resolvedByNameMap = {},
  officialPhoneMap = {},
  onUpdateEvacuationDescription,
  readOnly = false,
}: {
  disasters?: Disaster[];
  evacuationSites?: EvacuationSite[];
  currentUser?: any;
  currentUserRole?: string | null;
  focusDisaster?: { id: string; key: number } | null;
  focusEvacuationSite?: { id: string; key: number } | null;
  onFocusDisaster?: (id: string) => void;
  onFocusEvacuationSite?: (id: string) => void;
  reporterRoleMap?: Record<string, string>;
  resolvedByNameMap?: Record<string, string>;
  officialPhoneMap?: Record<string, string>;
  onUpdateEvacuationDescription?: (id: string, newDescription: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const router = useRouter();

  const user = currentUser;
  const role = currentUserRole;

  const [panelMode, setPanelMode] = useState<"disaster" | "evacuation">("disaster");
  const [locationMode, setLocationMode] = useState<"current" | "pick">("current");
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [pickedLocation, setPickedLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBoundaryError, setShowBoundaryError] = useState(false);
  const [routingDestination, setRoutingDestination] = useState<[number, number] | null>(null);

  const disasterMarkersRef = useRef<Record<string, L.Marker | null>>({});
  const evacMarkersRef = useRef<Record<string, L.Marker | null>>({});
  const manuallyClosedDisaster = useRef(false);
  const manuallyClosedEvac = useRef(false);
  const initialRequestDone = useRef(false);

  const focusedDisasterObj = useMemo(
    () => disasters.find((d) => focusDisaster?.id === d.id),
    [disasters, focusDisaster]
  );
  const focusedEvacObj = useMemo(
    () => evacuationSites.find((s) => focusEvacuationSite?.id === s.id),
    [evacuationSites, focusEvacuationSite]
  );

  useEffect(() => {
    if (!readOnly && focusDisaster && !manuallyClosedDisaster.current) {
      const timer = setTimeout(() => {
        disasterMarkersRef.current[focusDisaster.id]?.openPopup();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [focusDisaster, readOnly]);

  useEffect(() => {
    if (!readOnly && focusEvacuationSite && !manuallyClosedEvac.current) {
      const timer = setTimeout(() => {
        evacMarkersRef.current[focusEvacuationSite.id]?.openPopup();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [focusEvacuationSite, readOnly]);

  const requestDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }
    setIsGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationError(null);
        setIsGettingLocation(false);
      },
      (err) => {
        setLocationError(err.message);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!initialRequestDone.current && locationMode === "current") {
      initialRequestDone.current = true;
      requestDeviceLocation();
    }
  }, [locationMode, requestDeviceLocation]);

  const handleLocationModeChange = useCallback((mode: "current" | "pick") => {
    setLocationMode(mode);
    if (mode === "current") {
      if (!currentLocation && !isGettingLocation) {
        requestDeviceLocation();
      }
    }
  }, [currentLocation, isGettingLocation, requestDeviceLocation]);

  const handleMapPick = (lat: number, lng: number) => {
    if (locationMode === "pick") {
      setPickedLocation([lat, lng]);
    }
  };

  const handleBoundaryError = useCallback(() => setShowBoundaryError(true), []);

  const submitDisasterReport = useCallback(async (type: DisasterType, location: [number, number], description?: string) => {
    if (!user) return;

    if (!isWithinBoundary(location[0], location[1])) {
      setShowBoundaryError(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, contact_number, role")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      await supabase.from("disasters").insert({
        user_id: user.id,
        full_name: `${profile.first_name} ${profile.last_name}`,
        contact_number: profile.contact_number ?? null,
        lat: location[0],
        lng: location[1],
        type,
        description: type === "hazard" ? description : null,
        status: "active",
      });

      if (locationMode === "pick") setPickedLocation(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [user, locationMode]);

  const submitEvacuationSite = useCallback(async (location: [number, number], title: string, description?: string) => {
    if (!user) return;

    if (!isWithinBoundary(location[0], location[1])) {
      setShowBoundaryError(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      await supabase.from("evacuation_sites").insert({
        official_id: user.id,
        official_name: `${profile.first_name} ${profile.last_name}`.trim(),
        lat: location[0],
        lng: location[1],
        title: title,
        description: description || null,
        status: "available",
      });

      if (locationMode === "pick") setPickedLocation(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [user, locationMode]);

  const getDisasterIcon = (disaster: Disaster) => {
    if (disaster.status === "resolved") return disasterIcons.resolved;
    switch (disaster.type) {
      case "fire": return disasterIcons.fire;
      case "accident": return disasterIcons.accident;
      case "flood": return disasterIcons.flood;
      case "hazard": return disasterIcons.hazard;
      default: return disasterIcons.default;
    }
  };

  const getEvacuationIcon = (site: EvacuationSite) => {
    return site.status === "available" ? evacuationSiteAvailable : evacuationSiteFull;
  };

  const routingUserLocation = locationMode === "current" ? currentLocation : pickedLocation;

  const handleRequestRoute = useCallback((site: EvacuationSite) => {
    setRoutingDestination([site.lat, site.lng]);
    evacMarkersRef.current[site.id]?.closePopup();
    onFocusEvacuationSite?.("");
  }, [onFocusEvacuationSite]);

  const handleEvacMarkerClick = useCallback((site: EvacuationSite) => {
    if (readOnly) {
      router.push(`/evacuation?id=${site.id}`);
    } else {
      if (routingDestination && routingDestination[0] === site.lat && routingDestination[1] === site.lng) {
        setRoutingDestination(null);
      }
      onFocusEvacuationSite?.(site.id);
    }
  }, [readOnly, router, onFocusEvacuationSite, routingDestination]);

  useEffect(() => {
    if (!routingUserLocation) {
      setRoutingDestination(null);
    }
  }, [routingUserLocation]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative h-full w-full"
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        dragging={!readOnly}
        zoomControl={!readOnly}
        scrollWheelZoom={!readOnly}
        doubleClickZoom={!readOnly}
        boxZoom={!readOnly}
        keyboard={!readOnly}
        touchZoom={!readOnly}
      >
        <BoundaryLayer />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {!readOnly && locationMode === "pick" && (
          <ClickToPickLocation
            onPick={(lat, lng) => handleMapPick(lat, lng)}
            onBoundaryError={handleBoundaryError}
          />
        )}

        {!readOnly && locationMode === "pick" && pickedLocation && (
          <Marker position={pickedLocation} icon={userLocationIcon}>
            <Popup>Pinned location.</Popup>
          </Marker>
        )}

        {!readOnly && locationMode === "current" && currentLocation && (
          <Marker position={currentLocation} icon={userLocationIcon}>
            <Popup>Your current location.</Popup>
          </Marker>
        )}

        <CustomRoutingControl
          userLocation={routingUserLocation}
          destination={routingDestination}
          disasters={disasters}
        />

        {disasters.map((disaster) => (
          <Marker
            key={disaster.id}
            position={[disaster.lat, disaster.lng]}
            icon={getDisasterIcon(disaster)}
            eventHandlers={{
              click: () => {
                if (readOnly) router.push(`/disasters?id=${disaster.id}`);
                else onFocusDisaster?.(disaster.id);
              },
              ...(!readOnly && {
                popupopen: (e) => {
                  onFocusDisaster?.(disaster.id);
                  const map = e.target._map;
                  const popup = e.popup;
                  if (!map || !popup) return;
                  setTimeout(() => {
                    const container = popup.getElement();
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    const popupCenterX = rect.left + rect.width / 2;
                    const popupCenterY = rect.top + rect.height / 2;
                    const mapRect = map.getContainer().getBoundingClientRect();
                    const point = {
                      x: popupCenterX - mapRect.left,
                      y: popupCenterY - mapRect.top,
                    };
                    const targetLatLng = map.containerPointToLatLng([point.x, point.y]);
                    map.flyTo(targetLatLng, map.getZoom(), { duration: 0.8 });
                  }, 10);
                },
                popupclose: () => {
                  manuallyClosedDisaster.current = true;
                  onFocusDisaster?.("");
                },
              }),
            }}
            ref={(ref) => {
              disasterMarkersRef.current[disaster.id] = ref;
            }}
          >
            <Popup className="disaster-popup" keepInView autoPan={false}>
              <DisasterPopupContent
                disaster={disaster}
                role={role ?? null}
                user={user}
                onFocus={onFocusDisaster}
                reporterRoleMap={reporterRoleMap}
                resolvedByNameMap={resolvedByNameMap}
              />
            </Popup>
          </Marker>
        ))}

        {evacuationSites.map((site) => (
          <Marker
            key={site.id}
            position={[site.lat, site.lng]}
            icon={getEvacuationIcon(site)}
            eventHandlers={{
              click: () => handleEvacMarkerClick(site),
              ...(!readOnly && {
                popupopen: (e) => {
                  onFocusEvacuationSite?.(site.id);
                  const map = e.target._map;
                  const popup = e.popup;
                  if (!map || !popup) return;
                  setTimeout(() => {
                    const container = popup.getElement();
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    const popupCenterX = rect.left + rect.width / 2;
                    const popupCenterY = rect.top + rect.height / 2;
                    const mapRect = map.getContainer().getBoundingClientRect();
                    const point = {
                      x: popupCenterX - mapRect.left,
                      y: popupCenterY - mapRect.top,
                    };
                    const targetLatLng = map.containerPointToLatLng([point.x, point.y]);
                    map.flyTo(targetLatLng, map.getZoom(), { duration: 0.8 });
                  }, 10);
                },
                popupclose: () => {
                  manuallyClosedEvac.current = true;
                  onFocusEvacuationSite?.("");
                },
              }),
            }}
            ref={(ref) => {
              evacMarkersRef.current[site.id] = ref;
            }}
          >
            <Popup className="evacuation-popup" keepInView autoPan={false}>
              <EvacuationSitePopupContent
                site={site}
                role={role ?? null}
                user={user}
                onFocus={onFocusEvacuationSite}
                officialPhoneMap={officialPhoneMap}
                onUpdateDescription={onUpdateEvacuationDescription || (() => Promise.resolve())}
                onRequestRoute={handleRequestRoute}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <AnimatePresence>
        {showBoundaryError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[9999] flex items-center justify-center bg-white/20 backdrop-blur-sm"
            onClick={() => setShowBoundaryError(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <AlertTriangle size={24} className="text-blue-600" />
                </div>
              </div>
              <h3 className="mb-2 text-center text-lg font-semibold text-blue-900">
                Outside Service Area
              </h3>
              <p className="mb-6 text-center text-sm text-gray-700">
                Reports and evacuation sites are only accepted within New Ilalim, Olongapo City.
              </p>
              <button
                onClick={() => setShowBoundaryError(false)}
                className="w-full rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!readOnly && user && (
        <ActionPanel
          onReportDisaster={submitDisasterReport}
          onSubmitEvacuation={submitEvacuationSite}
          isSubmitting={isSubmitting}
          mode={panelMode}
          onModeChange={setPanelMode}
          userRole={role}
          locationMode={locationMode}
          onLocationModeChange={handleLocationModeChange}
          currentLocation={currentLocation}
          pickedLocation={pickedLocation}
          locationError={locationError}
          onRequestLocation={requestDeviceLocation}
          onClearPickedLocation={() => setPickedLocation(null)}
          isGettingLocation={isGettingLocation}
        />
      )}
    </motion.div>
  );
}