import { createRoot } from 'react-dom/client'
// Fonts are bundled so the demo renders the same offline, on any laptop.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)
