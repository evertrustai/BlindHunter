import ReactDOM from 'react-dom/client'
import { App } from './App'
import { applyCodeTheme } from './lib/appearance'
import './styles/tokens.css'
import './styles/global.css'
import './styles/app.css'
import './styles/settings.css'
import './styles/chat.css'

// Apply the saved code-appearance theme before first paint (app theme defaults to dark
// until settings load; applyTheme re-applies the matching code theme after).
applyCodeTheme()

// Rendered without React.StrictMode: its dev-only double-invocation of effects tore
// down the first chat's send (the mount cleanup aborts the request) before it could
// run, losing the initial prompt. Production never double-invokes, so dev now matches
// production behavior and the first message is sent exactly once. (QA-04)
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
