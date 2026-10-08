import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/global.css'
import './styles/app.css'
import './styles/settings.css'
import './styles/chat.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
