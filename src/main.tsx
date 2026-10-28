import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './components/error/ErrorBoundary.tsx'
import { isDesignLabEnabled, shouldMountDesignLab } from './design-lab/isDesignLabRoute.ts'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

const MainApp = lazy(() => import('./app/main-app'));
const NativeNoteWindow = lazy(() => import('./features/notes/native-note-window'));
const isNoteWindow = isTauri() && getCurrentWindow().label.startsWith('note-');

// Preview-only design lab: rendered in isolation BEFORE the production app so it
// never touches auth, Supabase, or App's hook order. Gated to dev builds (or an
// explicit VITE_ENABLE_DESIGN_LAB="true" opt-in) so it is unreachable in a
// normal production build — a disabled /design-lab/* visit falls through to App
// (which shows NotFound). Remove this branch + the src/design-lab folder to
// fully delete the lab.

// Design Lab is a preview-only surface. It is lazily imported AND gated behind
// isDesignLabEnabled() so that, in a normal production build (DEV === false and
// no VITE_ENABLE_DESIGN_LAB opt-in), the entire design-lab chunk is dead code
// and is stripped from the bundle. The dynamic import only survives in dev
// (or when explicitly opted in).
const DesignLab = isDesignLabEnabled()
  ? lazy(() => import('./design-lab/DesignLab.tsx'))
  : null;

const isLab = typeof window !== 'undefined' && shouldMountDesignLab(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <ErrorBoundary>
      {isNoteWindow ? <Suspense fallback={null}><NativeNoteWindow /></Suspense> : isLab && DesignLab ? (
        <Suspense fallback={null}>
          <DesignLab />
        </Suspense>
      ) : (
        <>
          <Suspense fallback={null}><MainApp /></Suspense>
        </>
      )}
    </ErrorBoundary>
  // </StrictMode>,
)
