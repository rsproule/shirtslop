import { useContext } from "react";
import { ShirtDataContext } from "./ShirtDataContextBase";

export function useShirtData() {
  const context = useContext(ShirtDataContext);
  if (context === undefined) {
    throw new Error("useShirtData must be used within a ShirtDataProvider");
  }
  return context;
}

export default useShirtData;
