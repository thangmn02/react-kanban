import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './providers/AuthProvider.tsx'
import ErrorBoundary from './components/error/ErrorBoundary.tsx'
import OfflineBanner from './components/error/OfflineBanner.tsx'
import DesignLab from './design-lab/DesignLab.tsx'
import { shouldMountDesignLab } from './design-lab/isDesignLabRoute.ts'

// Preview-only design lab: rendered in isolation BEFORE the production app so it
// never touches auth, Supabase, or App's hook order. Gated to dev builds (or an
// explicit VITE_ENABLE_DESIGN_LAB="true" opt-in) so it is unreachable in a
// normal production build — a disabled /design-lab/* visit falls through to App
// (which shows NotFound). Remove this branch + the src/design-lab folder to
// fully delete the lab.
const isLab = typeof window !== 'undefined' && shouldMountDesignLab(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <ErrorBoundary>
      {isLab ? (
        <DesignLab />
      ) : (
        <>
          <AuthProvider>
            <App />
          </AuthProvider>
          <OfflineBanner />
        </>
      )}
    </ErrorBoundary>
  // </StrictMode>,
)

