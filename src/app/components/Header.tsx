"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";
import AuthModal from "./AuthModal";
import { LogOut, User, Map, Camera, History, Package, Mail, Phone, X } from "lucide-react";
import { formatClockDate, formatClockTime } from "@/app/lib/timeFormat";
import { motion, AnimatePresence } from "framer-motion";

const HEADER_HEIGHT = 72;
const MODAL_BACKDROP_CLASS = "fixed inset-0 bg-white/10 backdrop-blur-sm";

export default function Header() {
  const { userMeta, userRole, isLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const userInitiatedLogout = useRef(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !userMeta && pathname !== "/") {
      router.push("/");
    }
  }, [isLoading, userMeta, pathname, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    userInitiatedLogout.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setShowLogoutConfirm(false);
      setShowUserPopup(false);
    } catch {
      setShowLogoutConfirm(false);
      setShowUserPopup(false);
    }
  };

  const fullName = `${userMeta?.first_name ?? ""} ${userMeta?.last_name ?? ""}`.trim();
  const roleLabel = userRole === "official" ? "Barangay Official" : "Resident";
  const userEmail = (userMeta as any)?.email;
  const userPhone = (userMeta as any)?.contact_number;

  const navItems = useMemo(() => {
    if (userRole === "official") {
      return [
        { href: "/", label: "Map", icon: Map },
        { href: "/camera", label: "Camera", icon: Camera },
        { href: "#", label: "User", icon: User, isUser: true },
        { href: "/history", label: "History", icon: History },
        { href: "/inventory", label: "Inventory", icon: Package },
      ];
    } else {
      return [
        { href: "/", label: "Map", icon: Map },
        { href: "#", label: "User", icon: User, isUser: true },
        { href: "/camera", label: "Camera", icon: Camera },
      ];
    }
  }, [userRole]);

  const isLoggedOut = !isLoading && !userMeta;
  const isLoggedIn = !isLoading && userMeta;

  const headerContentVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 10, transition: { duration: 0.2 } },
  };

  const iconVariants = {
    hover: { scale: 1.1, transition: { duration: 0.2 } },
    tap: { scale: 0.95 },
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[900] backdrop-blur shadow-md px-4 sm:px-6 lg:px-8"
        style={{ height: HEADER_HEIGHT, backgroundColor: "rgba(30, 58, 138, 0.95)" }}
      >
        {!isLoading && (
          <AnimatePresence mode="wait">
            {isLoggedOut ? (
              <motion.div
                key="logged-out"
                variants={headerContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="grid h-full grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center"
              >
                <div className="hidden md:block" />
                <div className="flex h-full items-center justify-center">
                  <div className="h-full w-px bg-white/30 self-stretch mr-4" />
                  <motion.button
                    variants={iconVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => setShowAuth(true)}
                    className="rounded-full bg-white/10 p-2 hover:bg-white/20"
                  >
                    <User size={20} className="text-white" />
                  </motion.button>
                  <div className="h-full w-px bg-white/30 self-stretch ml-4" />
                </div>
                <div className="hidden md:flex justify-end">
                  <div className="text-right leading-tight">
                    <div className="text-sm font-semibold text-white" suppressHydrationWarning>
                      {formatClockDate(currentTime)}
                    </div>
                    <div className="text-xs text-white/80" suppressHydrationWarning>
                      {formatClockTime(currentTime)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : isLoggedIn && (
              <motion.div
                key="logged-in"
                variants={headerContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="grid h-full grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center"
              >
                <div className="hidden md:block" />
                <div className="flex h-full items-center justify-center">
                  <div className="h-full w-px bg-white/30 self-stretch mr-4" />
                  <div className="flex h-full items-center gap-4">
                    {navItems.map((item, idx) => {
                      const Icon = item.icon;
                      const isActive = !item.isUser && pathname === item.href;
                      return (
                        <div key={`${item.href}-${idx}`} className="flex h-full items-center">
                          {item.isUser ? (
                            <motion.button
                              variants={iconVariants}
                              whileHover="hover"
                              whileTap="tap"
                              onClick={() => setShowUserPopup(true)}
                              className="rounded-full bg-white/10 p-2 hover:bg-white/20"
                            >
                              <Icon size={20} className="text-white" />
                            </motion.button>
                          ) : (
                            <motion.div variants={iconVariants} whileHover="hover" whileTap="tap">
                              <Link
                                href={item.href}
                                className={`flex items-center p-2 text-sm font-medium ${
                                  isActive ? "text-white" : "text-white/70 hover:text-white"
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </Link>
                            </motion.div>
                          )}
                          {idx < navItems.length - 1 && (
                            <div className="ml-4 w-px bg-white/30 self-stretch" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="h-full w-px bg-white/30 self-stretch ml-4" />
                </div>
                <div className="hidden md:flex justify-end">
                  <div className="text-right leading-tight">
                    <div className="text-sm font-semibold text-white" suppressHydrationWarning>
                      {formatClockDate(currentTime)}
                    </div>
                    <div className="text-xs text-white/80" suppressHydrationWarning>
                      {formatClockTime(currentTime)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </header>

      <AnimatePresence>
        {showUserPopup && userMeta && (
          <motion.div
            className={`${MODAL_BACKDROP_CLASS} z-[9999] flex items-center justify-center p-4`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUserPopup(false)}
          >
            <motion.div
              className="relative w-80 rounded-xl bg-white p-6 shadow-xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowUserPopup(false)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
              <div className="flex flex-col items-center text-center">
                <h3 className="text-lg font-semibold text-blue-900">{fullName || "User"}</h3>
                <p className="text-sm text-gray-600 mt-1">{roleLabel}</p>
                <div className="w-full border-t border-gray-100 my-4" />
                <div className="space-y-2 w-full">
                  {userEmail && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                      <Mail size={16} className="text-blue-600 shrink-0" />
                      <span className="truncate">{userEmail}</span>
                    </div>
                  )}
                  {userPhone && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                      <Phone size={16} className="text-blue-600 shrink-0" />
                      <span>{userPhone}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowUserPopup(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="mt-5 w-full rounded-md bg-blue-900 px-4 py-2 text-sm text-white hover:bg-blue-800"
                >
                  Log Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAuth && (
          <motion.div
            className={`${MODAL_BACKDROP_CLASS} z-[9999] flex items-center justify-center p-4`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAuth(false)}
          >
            <motion.div
              className="w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <AuthModal onClose={() => setShowAuth(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            className={`${MODAL_BACKDROP_CLASS} z-[9999] flex items-center justify-center p-4`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-lg font-semibold text-blue-900">Log Out?</h3>
              <p className="mb-6 text-sm text-gray-700">Are you sure you want to log out?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 rounded-lg border border-blue-900 px-4 py-2 text-sm text-blue-900 hover:bg-blue-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 rounded-lg bg-blue-900 px-4 py-2 text-sm text-white hover:bg-blue-800"
                >
                  Log Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}