// app/inventory/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";
import { Package, Box, Plus, Minus, Search, Lock, Trash2 } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  in_use?: number;
  unit: string;
  created_at: string;
  updated_at: string;
  is_consumable: boolean;
}

const UNITS = ["packs", "bottles", "kits", "pcs", "boxes", "sacks"];
const ITEM_SUGGESTIONS = ["Relief Food Packs", "Bottled Water", "First Aid Kits", "Blankets", "Hygiene Kits", "Rice", "Canned Goods", "Medicines"];

const MODAL_BACKDROP_CLASS = "fixed inset-0 bg-white/10 backdrop-blur-sm";

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

const InventoryCard = memo(({
  title,
  items,
  isConsumable,
  icon: Icon,
  search,
  setSearch,
  onAdd,
  onUpdateQty,
  onUpdateInUse,
  onDelete,
}: {
  title: string;
  items: InventoryItem[];
  isConsumable: boolean;
  icon: React.ElementType;
  search: string;
  setSearch: (v: string) => void;
  onAdd: () => void;
  onUpdateQty: (id: string, newQuantity: number) => void;
  onUpdateInUse?: (id: string, newInUse: number) => void;
  onDelete: (item: InventoryItem) => void;
}) => {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleQuantityChange = (id: string, value: string) => {
    let num = parseInt(value);
    if (isNaN(num)) num = 0;
    onUpdateQty(id, num);
  };

  const handleInUseChange = (id: string, value: string) => {
    let num = parseInt(value);
    if (isNaN(num)) num = 0;
    if (onUpdateInUse) onUpdateInUse(id, num);
  };

  return (
    <motion.div
      variants={fadeInUp}
      className="flex flex-col h-full rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white"
    >
      <div className="bg-[#1e3a8a] px-3 sm:px-4 py-2 shrink-0">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Icon size={20} className="text-white" />
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                className="pl-8 pr-3 py-1.5 bg-[#1e3a8a] text-white placeholder-white/70 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/50 w-[160px]"
              />
            </div>
            <button
              onClick={onAdd}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="min-w-[640px] sm:min-w-full divide-y divide-gray-200">
          <div className="bg-gray-50 grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-[#1e3a8a] uppercase tracking-wider sticky top-0">
            {isConsumable ? (
              <>
                <div className="col-span-8">Item</div>
                <div className="col-span-3">Quantity</div>
                <div className="col-span-1"> </div>
              </>
            ) : (
              <>
                <div className="col-span-5">Item</div>
                <div className="col-span-2">Total</div>
                <div className="col-span-2">In Use</div>
                <div className="col-span-2">Available</div>
                <div className="col-span-1"> </div>
              </>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
              <Package size={44} className="mb-3 text-gray-300" />
              <p className="text-sm">No {title.toLowerCase()} items.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-50 border-b border-gray-100"
              >
                {isConsumable ? (
                  <>
                    <div className="col-span-8">
                      <p className="text-base font-medium text-[#1e3a8a]">{item.item_name}</p>
                      <div className="flex flex-col">
                        <p className="text-[10px] text-gray-500">Added: {formatDate(item.created_at)}</p>
                        {item.updated_at !== item.created_at && (
                          <p className="text-[10px] text-gray-400">Updated: {formatDate(item.updated_at)}</p>
                        )}
                      </div>
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 0}
                        className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-16 text-center font-bold text-base border border-gray-300 rounded-md px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                        className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="text-[10px] text-gray-500 ml-1">{item.unit}</span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <button
                        onClick={() => onDelete(item)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-5">
                      <p className="text-base font-medium text-[#1e3a8a]">{item.item_name}</p>
                      <div className="flex flex-col">
                        <p className="text-[10px] text-gray-500">Added: {formatDate(item.created_at)}</p>
                        {item.updated_at !== item.created_at && (
                          <p className="text-[10px] text-gray-400">Updated: {formatDate(item.updated_at)}</p>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <button
                        onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                        disabled={item.quantity <= (item.in_use ?? 0)}
                        className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-16 text-center font-bold text-base border border-gray-300 rounded-md px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                        className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="text-[10px] text-gray-500 ml-1">{item.unit}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <button
                        onClick={() => onUpdateInUse && onUpdateInUse(item.id, (item.in_use ?? 0) - 1)}
                        disabled={(item.in_use ?? 0) <= 0}
                        className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        value={item.in_use ?? 0}
                        onChange={(e) => handleInUseChange(item.id, e.target.value)}
                        className="w-16 text-center font-bold text-base border border-gray-300 rounded-md px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => onUpdateInUse && onUpdateInUse(item.id, (item.in_use ?? 0) + 1)}
                        disabled={(item.quantity - (item.in_use ?? 0)) <= 0}
                        className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-50"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="text-[10px] text-gray-500 ml-1">{item.unit}</span>
                    </div>
                    <div className="col-span-2 flex items-center pl-2">
                      <p className="font-bold text-base text-gray-700">
                        {item.quantity - (item.in_use ?? 0)}
                      </p>
                      <p className="text-[10px] text-gray-500 ml-1">{item.unit}</p>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <button
                        onClick={() => onDelete(item)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 bg-gray-50 shrink-0">
        Showing {items.length} records
      </div>
    </motion.div>
  );
});

InventoryCard.displayName = "InventoryCard";

export default function InventoryPage() {
  const { userRole, isLoading, user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchConsumable, setSearchConsumable] = useState("");
  const [searchNonConsumable, setSearchNonConsumable] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [modalType, setModalType] = useState<"consumable" | "nonConsumable">("consumable");
  const [form, setForm] = useState({ name: "", qty: 1, unit: UNITS[0] });
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!isLoading && userRole !== "official") {
      router.push("/");
    }
  }, [isLoading, userRole, router]);

  const fetchInventory = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const processed = data.map((item: InventoryItem) => ({
        ...item,
        in_use: item.is_consumable ? undefined : (item.in_use ?? 0),
      }));
      setItems(processed);
    }
    setLoadingData(false);
  }, [user]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("inventory-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => {
              if (prev.some(item => item.id === payload.new.id)) return prev;
              const newItem = payload.new as InventoryItem;
              newItem.in_use = newItem.is_consumable ? undefined : (newItem.in_use ?? 0);
              return [newItem, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) =>
              prev.map((item) => {
                if (item.id === payload.new.id) {
                  const updated = payload.new as InventoryItem;
                  updated.in_use = updated.is_consumable ? undefined : (updated.in_use ?? 0);
                  return updated;
                }
                return item;
              })
            );
          } else if (payload.eventType === "DELETE") {
            setItems((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateQty = useCallback(async (id: string, newQuantity: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    if (newQuantity < 0) newQuantity = 0;
    if (!item.is_consumable && newQuantity < (item.in_use ?? 0)) {
      alert("Total quantity cannot be less than the quantity in use.");
      return;
    }
    
    setItems(prev =>
      prev.map(i =>
        i.id === id ? { ...i, quantity: newQuantity, updated_at: new Date().toISOString() } : i
      )
    );
    const { error } = await supabase
      .from("inventory")
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setItems(prev =>
        prev.map(i =>
          i.id === id ? { ...i, quantity: item.quantity, updated_at: item.updated_at } : i
        )
      );
      alert("Failed to update quantity.");
    }
  }, [items]);

  const updateInUse = useCallback(async (id: string, newInUse: number) => {
    const item = items.find(i => i.id === id);
    if (!item || item.is_consumable) return;
    if (newInUse < 0) newInUse = 0;
    if (newInUse > item.quantity) {
      alert("In use cannot exceed total quantity.");
      return;
    }
    setItems(prev =>
      prev.map(i =>
        i.id === id ? { ...i, in_use: newInUse, updated_at: new Date().toISOString() } : i
      )
    );
    const { error } = await supabase
      .from("inventory")
      .update({ in_use: newInUse, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setItems(prev =>
        prev.map(i =>
          i.id === id ? { ...i, in_use: item.in_use, updated_at: item.updated_at } : i
        )
      );
      alert("Failed to update in‑use quantity.");
    }
  }, [items]);

  const confirmDelete = (item: InventoryItem) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    const deletedItem = items.find(i => i.id === itemToDelete.id);
    setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
    const { error } = await supabase.from("inventory").delete().eq("id", itemToDelete.id);
    if (error) {
      if (deletedItem) setItems(prev => [...prev, deletedItem]);
      alert("Failed to delete item.");
    }
    setDeleting(false);
    setDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.qty <= 0) {
      alert("Quantity must be at least 1.");
      return;
    }
    setAdding(true);
    const newItem: any = {
      item_name: form.name.trim(),
      quantity: form.qty,
      unit: form.unit,
      is_consumable: modalType === "consumable",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (modalType === "nonConsumable") {
      newItem.in_use = 0;
    }
    const { error } = await supabase.from("inventory").insert([newItem]);
    setAdding(false);
    if (error) {
      alert("Failed to add item.");
    } else {
      setAddModalOpen(false);
      setForm({ name: "", qty: 1, unit: UNITS[0] });
    }
  };

  const consumables = useMemo(() => {
    return items
      .filter(i => i.is_consumable && i.item_name.toLowerCase().includes(searchConsumable.toLowerCase()))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [items, searchConsumable]);

  const nonConsumables = useMemo(() => {
    return items
      .filter(i => !i.is_consumable && i.item_name.toLowerCase().includes(searchNonConsumable.toLowerCase()))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [items, searchNonConsumable]);

  // Modal quantity field handlers
  const handleModalQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val === "") {
      setForm({ ...form, qty: 1 });
    } else {
      const num = parseInt(val);
      if (!isNaN(num) && num >= 0) {
        setForm({ ...form, qty: num });
      }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="h-auto xl:h-full xl:min-h-0 relative p-5"
    >
      <div className="grid grid-cols-1 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-2 xl:items-stretch">
        <InventoryCard
          title="Consumable"
          items={consumables}
          isConsumable={true}
          icon={Package}
          search={searchConsumable}
          setSearch={setSearchConsumable}
          onAdd={() => { setModalType("consumable"); setAddModalOpen(true); }}
          onUpdateQty={updateQty}
          onDelete={confirmDelete}
        />
        <InventoryCard
          title="Non-Consumable"
          items={nonConsumables}
          isConsumable={false}
          icon={Box}
          search={searchNonConsumable}
          setSearch={setSearchNonConsumable}
          onAdd={() => { setModalType("nonConsumable"); setAddModalOpen(true); }}
          onUpdateQty={updateQty}
          onUpdateInUse={updateInUse}
          onDelete={confirmDelete}
        />
      </div>

      {/* Add Item Modal with fixed quantity input */}
      <AnimatePresence>
        {addModalOpen && (
          <motion.div
            className={`${MODAL_BACKDROP_CLASS} z-[9999] flex items-center justify-center p-4 pt-[72px]`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAddModalOpen(false)}
          >
            <motion.div
              className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 text-center">
                <h2 className="text-xl font-semibold tracking-tight text-blue-900">
                  Add {modalType === "consumable" ? "Consumable" : "Non-Consumable"}
                </h2>
              </div>

              <form onSubmit={addItem} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Item Name</label>
                  <input
                    type="text"
                    required
                    list="items"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="e.g. Rice Sacks"
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <datalist id="items">
                    {ITEM_SUGGESTIONS.map(i => <option key={i} value={i} />)}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Quantity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={form.qty}
                      onChange={handleModalQuantityChange}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Unit</label>
                    <select
                      value={form.unit}
                      onChange={e => setForm({...form, unit: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding || form.qty <= 0}
                    className="flex-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded-md text-white font-medium disabled:opacity-50"
                  >
                    {adding ? (
                      <div className="flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </div>
                    ) : (
                      "Add Item"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div
            className={`${MODAL_BACKDROP_CLASS} z-[9999] flex items-center justify-center p-4 pt-[72px]`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteModalOpen(false)}
          >
            <motion.div
              className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 text-center">
                <h2 className="text-xl font-semibold tracking-tight text-blue-900">Delete Item</h2>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete <span className="font-semibold">{itemToDelete?.item_name}</span>?
                  <br />
                  This action cannot be undone.
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 rounded-md text-white font-medium disabled:opacity-50"
                >
                  {deleting ? (
                    <div className="flex items-center justify-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}