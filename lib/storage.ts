// utils/storage.ts
export const storage = {
    set: (key: string, value: any) => {
      if (typeof window === "undefined") return;
      sessionStorage.setItem(key, JSON.stringify(value));
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
    get: (key: string) => {
      if (typeof window === "undefined") return null;
      try {
        const sessionVal = sessionStorage.getItem(key);
        if (sessionVal) return JSON.parse(sessionVal);
        const localVal = localStorage.getItem(key);
        return localVal ? JSON.parse(localVal) : null;
      } catch {
        return null;
      }
    },
    remove: (key: string) => {
      if (typeof window === "undefined") return;
      sessionStorage.removeItem(key);
      try {
        localStorage.removeItem(key);
      } catch {}
    },
    clear: () => {
      if (typeof window === "undefined") return;
      sessionStorage.clear();
      try {
        localStorage.removeItem("selected_roles");
        localStorage.removeItem("selected_vendor");
        localStorage.removeItem("selected_vendor_location_id");
      } catch {}
    },
    clearVendorData:()=>{
      if (typeof window === "undefined") return;
      sessionStorage.removeItem("selected_roles");
      sessionStorage.removeItem("selected_vendor");
      sessionStorage.removeItem("selected_vendor_location_id");
      try {
        localStorage.removeItem("selected_roles");
        localStorage.removeItem("selected_vendor");
        localStorage.removeItem("selected_vendor_location_id");
      } catch {}
    }
  };
  