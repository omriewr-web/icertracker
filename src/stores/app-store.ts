import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;

  selectedPortfolio: string | null;
  setSelectedPortfolio: (p: string | null) => void;

  selectedBuildingId: string | null;
  setSelectedBuildingId: (id: string | null) => void;

  searchTerm: string;
  setSearchTerm: (term: string) => void;

  arrearsFilter: string;
  setArrearsFilter: (f: string) => void;

  leaseFilter: string;
  setLeaseFilter: (f: string) => void;

  balanceMin: string;
  balanceMax: string;
  setBalanceMin: (v: string) => void;
  setBalanceMax: (v: string) => void;

  sortField: string;
  sortDir: "asc" | "desc";
  setSort: (field: string, dir: "asc" | "desc") => void;

  selectedTenantIds: Set<string>;
  toggleTenant: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;

  detailTenantId: string | null;
  setDetailTenantId: (id: string | null) => void;

  editTenantId: string | null;
  setEditTenantId: (id: string | null) => void;

  detailBuildingId: string | null;
  setDetailBuildingId: (id: string | null) => void;

  buildingFormOpen: boolean;
  editBuildingId: string | null;
  openBuildingForm: (id?: string | null) => void;
  closeBuildingForm: () => void;

  tenantCreateOpen: boolean;
  setTenantCreateOpen: (open: boolean) => void;

  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  aiTenantId: string | null;
  openAiForTenant: (id: string) => void;

  resetFilters: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  selectedPortfolio: null,
  setSelectedPortfolio: (p) => set({ selectedPortfolio: p, selectedBuildingId: null }),

  selectedBuildingId: null,
  setSelectedBuildingId: (id) => set({ selectedBuildingId: id }),

  searchTerm: "",
  setSearchTerm: (term) => set({ searchTerm: term }),

  arrearsFilter: "all",
  setArrearsFilter: (f) => set({ arrearsFilter: f }),

  leaseFilter: "all",
  setLeaseFilter: (f) => set({ leaseFilter: f }),

  balanceMin: "",
  balanceMax: "",
  setBalanceMin: (v) => set({ balanceMin: v }),
  setBalanceMax: (v) => set({ balanceMax: v }),

  sortField: "balance",
  sortDir: "desc",
  setSort: (field, dir) => set({ sortField: field, sortDir: dir }),

  selectedTenantIds: new Set(),
  toggleTenant: (id) =>
    set((s) => {
      const next = new Set(s.selectedTenantIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selectedTenantIds: next };
    }),
  selectAll: (ids) => set({ selectedTenantIds: new Set(ids) }),
  deselectAll: () => set({ selectedTenantIds: new Set() }),

  detailTenantId: null,
  setDetailTenantId: (id) => set({ detailTenantId: id }),

  editTenantId: null,
  setEditTenantId: (id) => set({ editTenantId: id }),

  detailBuildingId: null,
  setDetailBuildingId: (id) => set({ detailBuildingId: id }),

  buildingFormOpen: false,
  editBuildingId: null,
  openBuildingForm: (id) => set({ buildingFormOpen: true, editBuildingId: id ?? null }),
  closeBuildingForm: () => set({ buildingFormOpen: false, editBuildingId: null }),

  tenantCreateOpen: false,
  setTenantCreateOpen: (open) => set({ tenantCreateOpen: open }),

  aiPanelOpen: false,
  setAiPanelOpen: (open) => set({ aiPanelOpen: open, ...(!open ? { aiTenantId: null } : {}) }),
  aiTenantId: null,
  openAiForTenant: (id) => set({ aiPanelOpen: true, aiTenantId: id }),

  resetFilters: () =>
    set({
      selectedPortfolio: null,
      selectedBuildingId: null,
      searchTerm: "",
      arrearsFilter: "all",
      leaseFilter: "all",
      balanceMin: "",
      balanceMax: "",
      sortField: "balance",
      sortDir: "desc" as const,
      selectedTenantIds: new Set(),
      detailTenantId: null,
      editTenantId: null,
      detailBuildingId: null,
      editBuildingId: null,
      buildingFormOpen: false,
      tenantCreateOpen: false,
      aiPanelOpen: false,
      aiTenantId: null,
    }),
}));
