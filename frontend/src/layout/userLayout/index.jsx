import Navbar from '@/Components/Navbar'
import React from 'react'

export default function UserLayout({children}) {
  return (
    <div>
        <Navbar/>
        <main style={{ flex: 1, overflowY: 'auto' }}>
            {children}
        </main>
    </div>
  )
}
