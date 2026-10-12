import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/global.css'
import './styles/app.css'
import './styles/settings.css'
import './styles/chat.css'

// Rendered without React.StrictMode: its dev-only double-invocation of effects tore
// down the first chat's send (the mount cleanup aborts the request) before it could
// run, losing the initial prompt. Production never double-invokes, so dev now matches
// production behavior and the first message is sent exactly once. (QA-04)
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
