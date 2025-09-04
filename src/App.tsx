import { AuthGuard } from "@/components/layout/AuthGuard";
import { InsufficientBalanceModal } from "@/components/ui/InsufficientBalanceModal";
import { RecoveryPrompt } from "@/components/ui/RecoveryPrompt";
import { Toast } from "@/components/ui/Toast";
import { useShirtData } from "@/context/useShirtData";
import { useEchoErrorToast } from "@/hooks/useEchoErrorToast";
import { useRecoveryPrompt } from "@/hooks/useRecoveryPrompt";
import { HomePage } from "@/pages/HomePage";
import { ViewPage } from "@/pages/ViewPage";
import { EchoProvider, type EchoConfig } from "@merit-systems/echo-react-sdk";
import { Analytics } from "@vercel/analytics/react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ShirtDataProvider } from "./context/ShirtDataContext";

const echoConfig: EchoConfig = {
  appId: "60601628-cdb7-481e-8f7e-921981220348",
  baseEchoUrl: "https://echo.merit.systems",
  // rfs local testing
  // appId: "0e173291-6d49-49e4-8163-937d25ea7e34",
  // apiUrl: "http://localhost:3000",
};

function AppContent() {
  const {
    showRecoveryPrompt,
    recoveryData,
    recoverWork,
    startFresh,
    dismissRecovery,
  } = useRecoveryPrompt();

  const { toast, hideToast } = useEchoErrorToast();
  const { showInsufficientBalanceModal, setShowInsufficientBalanceModal } =
    useShirtData();

  return (
    <>
      <AuthGuard>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/view" element={<ViewPage />} />
          </Routes>
        </Router>
      </AuthGuard>

      {/* Recovery Prompt - Global overlay */}
      {showRecoveryPrompt && recoveryData && (
        <RecoveryPrompt
          recoveryData={recoveryData}
          onRecover={recoverWork}
          onStartFresh={startFresh}
          onDismiss={dismissRecovery}
        />
      )}

      {/* Echo Error Toast */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={4000}
      />

      {/* Insufficient Balance Modal */}
      <InsufficientBalanceModal
        isOpen={showInsufficientBalanceModal}
        onClose={() => setShowInsufficientBalanceModal(false)}
      />
    </>
  );
}

function App() {
  return (
    <EchoProvider config={echoConfig}>
      <ShirtDataProvider>
        <AppContent />
        <Analytics />
      </ShirtDataProvider>
    </EchoProvider>
  );
}

export default App;
