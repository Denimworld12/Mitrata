import Navbar from '@/Components/Navbar'
import React from 'react'

export default function UserLayout({children}) {
  // The wrapper wasn't a flex container, so `flex: 1` on <main> did nothing —
  // pages using min-height:100svh inside it (login, forgot-password) got
  // that on top of Navbar's own height instead of filling the space actually
  // left over, pushing content down and off the bottom of the screen.
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <Navbar/>
        <main style={{ flex: 1, overflowY: 'auto' }}>
            {children}
        </main>
    </div>
  )
}
