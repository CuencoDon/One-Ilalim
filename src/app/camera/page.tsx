"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/lib/AuthContext";
import { useData } from "@/app/lib/DataContext";
import { formatTime12Hour } from "@/app/lib/timeFormat";
import {
  Droplets,
  Wind,
  Gauge,
  Cloud,
  Camera,
  MapPin,
  RefreshCw,
  Sunrise,
  Sunset,
  Edit,
  Lock,
} from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { motion, AnimatePresence, Variants } from "framer-motion";

const NEW_ILALIM = {
  lat: 14.8345,
  lng: 120.2785,
  name: "Brgy. New Ilalim, Olongapo City",
};

type WeatherData = {
  current: {
    temperature: number;
    weatherCode: number;
    humidity: number;
    windSpeed: number;
    pressure: number;
    cloudCover: number;
  };
  daily: Array<{
    day: string;
    temperatureMin: number;
    temperatureMax: number;
    weatherCode: number;
    sunrise: string;
    sunset: string;
  }>;
};

const FALLBACK_WEATHER: WeatherData = {
  current: {
    temperature: 28,
    weatherCode: 2,
    humidity: 75,
    windSpeed: 12,
    pressure: 1012,
    cloudCover: 40,
  },
  daily: [
    {
      day: "Mon",
      temperatureMin: 25,
      temperatureMax: 29,
      weatherCode: 2,
      sunrise: "06:15",
      sunset: "18:30",
    },
    {
      day: "Tue",
      temperatureMin: 24,
      temperatureMax: 28,
      weatherCode: 61,
      sunrise: "06:16",
      sunset: "18:29",
    },
    {
      day: "Wed",
      temperatureMin: 24,
      temperatureMax: 28,
      weatherCode: 3,
      sunrise: "06:17",
      sunset: "18:28",
    },
  ],
};

const getWeatherText = (code: number): string => {
  const weatherMap: Record<number, string> = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    71: "Slight Snow",
    73: "Moderate Snow",
    75: "Heavy Snow",
    77: "Snow Grains",
    80: "Slight Showers",
    81: "Moderate Showers",
    82: "Violent Showers",
    85: "Slight Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm With Hail",
    99: "Thunderstorm With Heavy Hail",
  };
  return weatherMap[code] || "Unknown";
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export default function WeatherWaterPage() {
  const { userRole } = useAuth();
  const { refetch: refetchData } = useData();
  const pathname = usePathname();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [editAnnouncementText, setEditAnnouncementText] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWeather = async (retry = 0, showLoading = true) => {
    if (showLoading) setRefreshLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${NEW_ILALIM.lat}&longitude=${NEW_ILALIM.lng}&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,cloud_cover,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Asia%2FManila&forecast_days=3`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const current = data.current || {};
      const daily = data.daily || {
        time: [],
        temperature_2m_max: [],
        temperature_2m_min: [],
        weather_code: [],
        sunrise: [],
        sunset: [],
      };
      setWeather({
        current: {
          temperature: Math.round(current.temperature_2m ?? 28),
          weatherCode: current.weather_code ?? 2,
          humidity: current.relative_humidity_2m ?? 75,
          windSpeed: current.wind_speed_10m ?? 12,
          pressure: Math.round(current.pressure_msl ?? 1012),
          cloudCover: current.cloud_cover ?? 40,
        },
        daily: daily.time.slice(0, 3).map((date: string, index: number) => ({
          day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
          temperatureMin: Math.round(daily.temperature_2m_min[index] ?? 24),
          temperatureMax: Math.round(daily.temperature_2m_max[index] ?? 28),
          weatherCode: daily.weather_code[index] ?? 2,
          sunrise: daily.sunrise[index]?.split("T")[1]?.slice(0, 5) ?? "06:00",
          sunset: daily.sunset[index]?.split("T")[1]?.slice(0, 5) ?? "18:00",
        })),
      });
      setUsingFallback(false);
    } catch (err) {
      if (retry < 3) {
        setTimeout(() => fetchWeather(retry + 1, showLoading), 1000 * Math.pow(2, retry));
      } else {
        setWeather(FALLBACK_WEATHER);
        setUsingFallback(true);
      }
    } finally {
      if (showLoading) setRefreshLoading(false);
      setWeatherLoading(false);
    }
  };

  const fetchAnnouncement = async () => {
    try {
      const { data: ann } = await supabase
        .from("announcements")
        .select("content")
        .eq("type", "weather")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ann) {
        setAnnouncement(ann.content);
        setEditAnnouncementText(ann.content);
      } else {
        setAnnouncement("");
        setEditAnnouncementText("");
      }
    } catch (error) {
    } finally {
      setAnnouncementLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchWeather(0, false), fetchAnnouncement()]);
    };
    init();
    intervalRef.current = setInterval(() => fetchWeather(0, false), 10 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setAnnouncementLoading(true);
        setWeatherLoading(true);
        Promise.all([fetchAnnouncement(), fetchWeather(0, false), refetchData()]);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refetchData]);

  const handleEditAnnouncement = () => {
    setEditAnnouncementText(announcement);
    setIsEditingAnnouncement(true);
  };

  const handleCancelEdit = () => {
    setIsEditingAnnouncement(false);
    setEditAnnouncementText(announcement);
  };

  const handleSaveAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      const { data: existing } = await supabase
        .from("announcements")
        .select("id")
        .eq("type", "weather")
        .maybeSingle();
      if (existing) {
        await supabase
          .from("announcements")
          .update({
            content: editAnnouncementText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("announcements").insert({
          type: "weather",
          content: editAnnouncementText,
          updated_at: new Date().toISOString(),
        });
      }
      setAnnouncement(editAnnouncementText);
      setIsEditingAnnouncement(false);
    } catch (error) {
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const isOfficial = userRole === "official";
  const reserveWeatherCard = weatherLoading || refreshLoading;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="h-auto xl:h-full xl:min-h-0 relative p-5"
    >
      <div className="grid grid-cols-1 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(300px,0.95fr)_minmax(380px,1.05fr)] xl:items-stretch">
        <motion.div variants={fadeInUp} className="flex min-h-[280px] flex-col rounded-xl bg-gradient-to-br from-blue-900 to-blue-950 p-4 text-white shadow-lg sm:min-h-[320px] sm:p-5 xl:h-full xl:min-h-0 xl:p-4">
          <div className="mb-3 flex items-center gap-2 xl:mb-2">
            <Camera size={20} />
            <h2 className="text-base font-semibold sm:text-lg xl:text-base">
              Live Water Level Camera
            </h2>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-white/15 bg-white/10 p-4 xl:min-h-0 xl:p-3">
            <Camera size={44} className="mb-3 text-white/60 sm:h-12 sm:w-12 xl:h-10 xl:w-10" />
            <p className="text-center text-sm text-white/85 sm:text-base xl:text-sm">
              Live camera feed coming soon...
            </p>
            <p className="mt-2 max-w-md text-center text-xs text-white/60 sm:text-sm xl:text-xs">
              Camera will show real-time water level at Brgy. New Ilalim.
            </p>
          </div>
          <p className="mt-3 text-[10px] text-white/45 sm:text-xs xl:mt-2">
            Hardware setup in progress.
          </p>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className={`relative overflow-hidden rounded-xl shadow-lg xl:h-full xl:min-h-0 ${
            reserveWeatherCard ? "min-h-[640px] sm:min-h-[680px] xl:min-h-0" : ""
          }`}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/newilalim.png')" }}
          />
          <div className="absolute inset-0 bg-blue-950/90" />

          <div className="relative z-10 flex h-full min-h-0 flex-col p-4 text-white sm:p-5 xl:p-4">
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3 xl:mb-3">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-1.5 xl:mb-1.5">
                  <Cloud size={20} />
                  <h2 className="text-base font-semibold sm:text-lg xl:text-base">Weather</h2>
                </div>
                <div className="flex items-center gap-1 text-xs text-white/80 sm:text-sm xl:text-sm">
                  <MapPin size={13} />
                  <span className="truncate">{NEW_ILALIM.name}</span>
                </div>
              </div>
            </div>

            {weatherLoading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
                <p className="ml-2 text-sm text-white/80">Fetching weather data...</p>
              </div>
            ) : refreshLoading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
                <p className="ml-2 text-sm text-white/80">Refreshing weather data...</p>
              </div>
            ) : weather ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <div className="mb-2 shrink-0 xl:mb-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                    <span className="text-3xl font-bold leading-none sm:text-4xl xl:text-[2rem]">
                      {weather.current.temperature}°C
                    </span>
                    <span className="text-sm font-bold sm:text-right sm:text-base xl:text-base">
                      {getWeatherText(weather.current.weatherCode)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/80 sm:text-sm xl:text-xs">
                    Feels like {weather.current.temperature}°C
                  </p>
                </div>

                <div className="mb-2 grid shrink-0 grid-cols-2 gap-1.5 xl:mb-2 xl:gap-1.5">
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/10 p-1.5 xl:p-2">
                    <Droplets size={12} />
                    <div>
                      <p className="text-[10px] text-white/75 xl:text-[11px]">Humidity</p>
                      <p className="text-xs font-medium xl:text-xs">{weather.current.humidity}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/10 p-1.5 xl:p-2">
                    <Wind size={12} />
                    <div>
                      <p className="text-[10px] text-white/75 xl:text-[11px]">Wind</p>
                      <p className="text-xs font-medium xl:text-xs">{weather.current.windSpeed} km/h</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/10 p-1.5 xl:p-2">
                    <Gauge size={12} />
                    <div>
                      <p className="text-[10px] text-white/75 xl:text-[11px]">Pressure</p>
                      <p className="text-xs font-medium xl:text-xs">{weather.current.pressure} hPa</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/10 p-1.5 xl:p-2">
                    <Cloud size={12} />
                    <div>
                      <p className="text-[10px] text-white/75 xl:text-[11px]">Clouds</p>
                      <p className="text-xs font-medium xl:text-xs">{weather.current.cloudCover}%</p>
                    </div>
                  </div>
                </div>

                <div className="mb-2 grid shrink-0 grid-cols-2 gap-1.5 xl:mb-2">
                  <div className="rounded-lg bg-white/10 p-1.5 xl:p-2">
                    <div className="mb-0.5 flex items-center gap-1">
                      <Sunrise size={11} />
                      <span className="text-[10px] text-white/75 xl:text-[11px]">Sunrise</span>
                    </div>
                    <p className="text-xs font-medium xl:text-xs">
                      {formatTime12Hour(weather.daily[0]?.sunrise)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/10 p-1.5 xl:p-2">
                    <div className="mb-0.5 flex items-center gap-1">
                      <Sunset size={11} />
                      <span className="text-[10px] text-white/75 xl:text-[11px]">Sunset</span>
                    </div>
                    <p className="text-xs font-medium xl:text-xs">
                      {formatTime12Hour(weather.daily[0]?.sunset)}
                    </p>
                  </div>
                </div>

                <div className="mb-2 shrink-0 xl:mb-2">
                  <p className="mb-1.5 text-sm font-medium xl:text-sm">3-Day Forecast</p>
                  <div className="space-y-1">
                    {weather.daily.map((day, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] xl:px-2 xl:py-1.5 xl:text-xs"
                      >
                        <span className="w-10 shrink-0 font-medium">{day.day}</span>
                        <span className="flex-1 truncate text-center">{getWeatherText(day.weatherCode)}</span>
                        <span className="shrink-0 font-medium">
                          {day.temperatureMin}°/{day.temperatureMax}°
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium xl:text-base">Weather Announcement</p>
                      {(announcementLoading || savingAnnouncement) && (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      )}
                    </div>
                    {isOfficial && !isEditingAnnouncement && !announcementLoading && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleEditAnnouncement}
                        className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
                        title="Edit announcement"
                      >
                        <Edit size={14} />
                      </motion.button>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {isEditingAnnouncement ? (
                      <motion.div
                        key="edit"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="flex min-h-0 flex-1 flex-col"
                      >
                        <textarea
                          value={editAnnouncementText}
                          onChange={(e) => setEditAnnouncementText(e.target.value)}
                          className="min-h-[88px] flex-1 resize-none overflow-y-auto rounded-lg border border-white/20 bg-white/10 p-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white xl:min-h-0 xl:p-3 xl:text-sm"
                          placeholder="Enter weather announcement..."
                          maxLength={300}
                          disabled={savingAnnouncement}
                        />
                        <div className="mt-2 flex shrink-0 justify-end gap-2">
                          <button
                            onClick={handleSaveAnnouncement}
                            disabled={savingAnnouncement}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-medium hover:bg-green-700 disabled:opacity-50 xl:px-3 xl:py-1.5 xl:text-sm"
                          >
                            {savingAnnouncement ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              "Save"
                            )}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={savingAnnouncement}
                            className="rounded bg-gray-600 px-2 py-1 text-xs font-medium hover:bg-gray-700 disabled:opacity-50 xl:px-3 xl:py-1.5 xl:text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    ) : announcementLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-white/10 p-2 text-sm xl:p-3 xl:text-sm"
                      >
                        <p className="italic text-white/60">Fetching announcement...</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-white/10 p-2 text-sm xl:p-3 xl:text-sm"
                      >
                        {announcement ? (
                          <p className="break-words whitespace-pre-wrap">{announcement}</p>
                        ) : (
                          <p className="italic text-white/60">No weather announcement.</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {usingFallback && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 shrink-0 rounded-lg bg-yellow-500/20 p-2 xl:p-3"
                  >
                    <p className="text-sm text-yellow-200 xl:text-sm">
                      Live data unavailable – showing estimated conditions.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ) : null}
          </div>
        </motion.div>
      </div>


    </motion.div>
  );
}