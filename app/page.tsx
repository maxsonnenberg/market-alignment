'use client'

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function Page() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from('test')
        .select('*')

      if (error) {
        console.error('Supabase error:', error)
      } else {
        setData(data)
      }
    }

    loadData()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>Supabase Test</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
