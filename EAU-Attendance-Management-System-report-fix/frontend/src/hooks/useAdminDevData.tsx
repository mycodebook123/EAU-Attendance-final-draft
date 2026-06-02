import { createContext, useContext, ReactNode } from "react";

const AdminDevDataContext = createContext<null>(null);

export const AdminDevDataProvider = ({ children }: { children: ReactNode }) => {
  return <AdminDevDataContext.Provider value={null}>{children}</AdminDevDataContext.Provider>;
};

export const useAdminDevData = () => useContext(AdminDevDataContext);
