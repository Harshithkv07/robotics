import { createRoot } from 'react-dom/client'
// Fonts are bundled so the demo renders the same offline, on any laptop.
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)
