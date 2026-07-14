import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
import App from './App'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Rankings = lazy(() => import('./pages/Rankings'))
const SetupLeague = lazy(() => import('./pages/SetupLeague'))
const ConfigureBots = lazy(() => import('./pages/ConfigureBots'))
const DraftRoom = lazy(() => import('./pages/DraftRoom'))
const Results = lazy(() => import('./pages/Results'))
const About = lazy(() => import('./pages/About'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'rankings', element: <Rankings /> },
      { path: 'setup', element: <SetupLeague /> },
      { path: 'bots', element: <ConfigureBots /> },
      { path: 'draft', element: <DraftRoom /> },
      { path: 'results', element: <Results /> },
      { path: 'about', element: <About /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>}>
      <RouterProvider router={router} />
    </Suspense>
  </React.StrictMode>,
)
