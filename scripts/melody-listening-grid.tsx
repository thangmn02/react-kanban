import { createRoot } from 'react-dom/client';
import MelodyListeningGrid from '../src/features/music/diagnostics/MelodyListeningGrid';
import './melody-listening.css';

// This entry is loaded only by the local listening HTML, never by the product app.
const container = document.getElementById('melody-grid');
const audio = document.querySelector('audio');
if (import.meta.env.DEV && container && audio) {
  createRoot(container).render(<MelodyListeningGrid audio={audio} />);
}
