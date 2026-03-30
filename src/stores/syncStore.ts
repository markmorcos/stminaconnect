import { create } from "zustand";

type SyncStatus = "synced" | "pending" | "failed";

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: Date | null;
  setStatus: (status: SyncStatus) => void;
  setPendingCount: (count: number) => void;
  setLastSyncedAt: (date: Date) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: "synced",
  pendingCount: 0,
  lastSyncedAt: null,
  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) =>
    set({
      pendingCount,
      status: pendingCount > 0 ? "pending" : "synced",
    }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
}));
