"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Car, Waves, AlertTriangle, MapPin, Loader2, RefreshCw, X, Building2, ChevronDown, ChevronUp } from "lucide-react";

type DisasterType = "fire" | "accident" | "flood" | "hazard";
type LocationMode = "current" | "pick";
type PanelMode = "disaster" | "evacuation";

interface ActionPanelProps {
  onReportDisaster: (type: DisasterType, location: [number, number], description?: string) => Promise<void>;
  onSubmitEvacuation: (location: [number, number], title: string, description?: string) => Promise<void>;
  isSubmitting: boolean;
  mode: PanelMode;
  onModeChange: (mode: PanelMode) => void;
  userRole?: string | null;
  locationMode: LocationMode;
  onLocationModeChange: (mode: LocationMode) => void;
  currentLocation: [number, number] | null;
  pickedLocation: [number, number] | null;
  locationError?: string | null;
  onRequestLocation: () => void;
  onClearPickedLocation: () => void;
  isGettingLocation: boolean;
}

const DISASTER_CONFIG = {
  fire: { icon: Flame, label: "Fire", color: "bg-red-600", hover: "hover:bg-red-700" },
  accident: { icon: Car, label: "Accident", color: "bg-orange-500", hover: "hover:bg-orange-600" },
  flood: { icon: Waves, label: "Flood", color: "bg-blue-600", hover: "hover:bg-blue-700" },
  hazard: { icon: AlertTriangle, label: "Hazard", color: "bg-yellow-500", hover: "hover:bg-yellow-600" },
};

export default function ActionPanel({
  onReportDisaster,
  onSubmitEvacuation,
  isSubmitting,
  mode,
  onModeChange,
  userRole,
  locationMode,
  onLocationModeChange,
  currentLocation,
  pickedLocation,
  locationError,
  onRequestLocation,
  onClearPickedLocation,
  isGettingLocation,
}: ActionPanelProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [hazardDescription, setHazardDescription] = useState("");
  const [showHazardInput, setShowHazardInput] = useState(false);
  const [selectedType, setSelectedType] = useState<DisasterType | null>(null);
  const [evacTitle, setEvacTitle] = useState("");
  const [evacDescription, setEvacDescription] = useState("");

  const isOfficial = userRole === "official";

  useEffect(() => {
    if (locationMode === "current" && !currentLocation && !isGettingLocation) {
      onRequestLocation();
    }
  }, [locationMode, currentLocation, isGettingLocation, onRequestLocation]);

  const handleDisasterReportClick = (type: DisasterType) => {
    if (type === "hazard") {
      setSelectedType(type);
      setShowHazardInput(true);
    } else {
      const location = locationMode === "current" ? currentLocation : pickedLocation;
      if (location) onReportDisaster(type, location);
    }
  };

  const submitHazardReport = () => {
    if (!hazardDescription.trim()) return;
    const location = locationMode === "current" ? currentLocation : pickedLocation;
    if (location) {
      onReportDisaster("hazard", location, hazardDescription.trim());
      setHazardDescription("");
      setShowHazardInput(false);
      setSelectedType(null);
    }
  };

  const cancelHazardInput = () => {
    setShowHazardInput(false);
    setSelectedType(null);
    setHazardDescription("");
  };

  const handleSubmitEvacuation = () => {
    if (!evacTitle.trim()) return;
    const location = locationMode === "current" ? currentLocation : pickedLocation;
    if (location) {
      onSubmitEvacuation(location, evacTitle.trim(), evacDescription.trim() || undefined);
      setEvacTitle("");
      setEvacDescription("");
    }
  };

  const isReady = locationMode === "current" ? !!currentLocation : !!pickedLocation;
  const isError = locationMode === "current" ? !!locationError : false;
  const containerStyle = isReady
    ? "bg-green-50 border border-green-200"
    : isError
    ? "bg-red-50 border border-red-200"
    : "bg-gray-50 border border-gray-200";
  const textColor = isReady ? "text-green-700" : isError ? "text-red-700" : "text-gray-700";
  const iconColor = isReady ? "text-green-600" : isError ? "text-red-600" : "text-gray-400";

  const getStatusText = () => {
    if (locationMode === "current") {
      if (isGettingLocation) return "Getting location...";
      if (currentLocation) return "Location Ready";
      if (locationError) return "Location Error";
      return "Not available";
    } else {
      if (pickedLocation) return "Location Ready";
      return "Tap map to drop location";
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[1000] flex justify-center pb-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl w-80 max-w-[90%] overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={`w-full flex items-center justify-between px-4 py-2 bg-[#1e3a8a] text-white transition-colors ${
            panelOpen ? "rounded-t-2xl" : "rounded-2xl"
          }`}
        >
          <div className="flex items-center gap-2">
            {mode === "disaster" ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Building2 className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">Action Panel</span>
          </div>
          <span className="text-xl leading-none">
            {panelOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {panelOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="p-3 flex flex-col gap-2">
                {/* Mode toggle */}
                <div className="flex rounded-lg bg-gray-100 p-0.5 w-full gap-0.5">
                  <button
                    onClick={() => onModeChange("disaster")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      mode === "disaster"
                        ? "bg-red-600 text-white shadow"
                        : "text-gray-600 hover:text-gray-700"
                    }`}
                  >
                    Report Disaster
                  </button>
                  {isOfficial && (
                    <button
                      onClick={() => onModeChange("evacuation")}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        mode === "evacuation"
                          ? "bg-green-600 text-white shadow"
                          : "text-gray-600 hover:text-gray-700"
                      }`}
                    >
                      Add Evacuation Site
                    </button>
                  )}
                </div>

                {/* Location selector */}
                <div className="flex rounded-lg bg-gray-100 p-0.5 w-full">
                  <button
                    onClick={() => onLocationModeChange("current")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      locationMode === "current"
                        ? "bg-[#1e3a8a] text-white shadow"
                        : "text-gray-600 hover:text-gray-700"
                    }`}
                  >
                    Current Location
                  </button>
                  <button
                    onClick={() => onLocationModeChange("pick")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      locationMode === "pick"
                        ? "bg-[#1e3a8a] text-white shadow"
                        : "text-gray-600 hover:text-gray-700"
                    }`}
                  >
                    Pick on Map
                  </button>
                </div>

                {/* Location status */}
                <div className={`rounded-lg py-1 px-3 flex items-center justify-between transition-colors min-h-[36px] ${containerStyle}`}>
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-4 h-4 ${textColor}`} />
                    <span className={`text-xs font-medium ${textColor}`}>{getStatusText()}</span>
                  </div>
                  <div className="flex items-center justify-center">
                    {locationMode === "current" ? (
                      <button
                        onClick={onRequestLocation}
                        disabled={isGettingLocation}
                        className={`${iconColor} hover:opacity-80 disabled:opacity-50`}
                      >
                        {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    ) : (
                      pickedLocation && (
                        <button
                          onClick={onClearPickedLocation}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Mode-specific forms */}
                {mode === "disaster" ? (
                  <>
                    {showHazardInput ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          rows={2}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Describe the hazard... (Required)"
                          value={hazardDescription}
                          onChange={(e) => setHazardDescription(e.target.value)}
                          maxLength={500}
                        />
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={submitHazardReport}
                            disabled={isSubmitting || !hazardDescription.trim() || !isReady}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            {isSubmitting ? "Submitting..." : "Submit"}
                          </button>
                          <button
                            onClick={cancelHazardInput}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-3 rounded-md text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 w-full">
                        {Object.entries(DISASTER_CONFIG).map(([type, config]) => {
                          const Icon = config.icon;
                          return (
                            <button
                              key={type}
                              onClick={() => handleDisasterReportClick(type as DisasterType)}
                              disabled={isSubmitting || !isReady}
                              className={`flex flex-col items-center justify-center aspect-square rounded-full transition-all ${
                                config.color
                              } ${config.hover} text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <Icon className="w-5 h-5" />
                              <span className="text-[10px] font-medium mt-1">{config.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Site title (Required)"
                      value={evacTitle}
                      onChange={(e) => setEvacTitle(e.target.value)}
                      maxLength={100}
                    />
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Description (Optional)"
                      value={evacDescription}
                      onChange={(e) => setEvacDescription(e.target.value)}
                      maxLength={500}
                    />
                    <div className="flex justify-center">
                      <button
                        onClick={handleSubmitEvacuation}
                        disabled={isSubmitting || !evacTitle.trim() || !isReady}
                        className="bg-green-600 hover:bg-green-700 text-white py-1 px-4 rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        {isSubmitting ? "Submitting..." : "Add Evacuation Site"}
                      </button>
                    </div>
                  </div>
                )}

                {isSubmitting && (
                  <div className="text-center text-xs text-gray-500 flex justify-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}