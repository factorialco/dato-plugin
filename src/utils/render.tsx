import type React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Missing #root element: the plugin iframe failed to load.')
}

const root = createRoot(container)

export function render(component: React.ReactNode): void {
  root.render(<StrictMode>{component}</StrictMode>)
}
