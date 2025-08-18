import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
import App from './App'
import Dashboard from './pages/Dashboard'
import SetupLeague from './pages/SetupLeague'
import ConfigureBots from './pages/ConfigureBots'
import DraftRoom from './pages/DraftRoom'
import Results from './pages/Results'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'setup', element: <SetupLeague /> },
      { path: 'bots', element: <ConfigureBots /> },
      { path: 'draft', element: <DraftRoom /> },
      { path: 'results', element: <Results /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
