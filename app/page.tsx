'use client'

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useMemo, useState } from 'react'

type Country = {
  id: string
  name: string
  sort_order?: number | null
}

type AppCategory = {
  id: string
  name: string
  sort_order?: number | null
}

type CountryAppAssignment = {
  country_id: string
  app_category_id: string
  app_name: string | null
}

const defaultCountries = [
  'Deutschland',
  'Polen',
  'Ungarn',
  'Tschechien',
  'Albanien',
  'Kosovo',
  'Spanien',
  'Türkei',
  'Schweiz',
  'Dänemark',
] as const

const defaultCategories = ['ERP', 'Onlinesshop', 'App', 'Kasse'] as const

const defaultValues: Record<string, Record<string, string>> = {
  Deutschland: { ERP: 'SAP', Onlinesshop: 'Shopware', App: 'Customer Portal', Kasse: 'POS' },
  Polen: { ERP: 'Comarch', Onlinesshop: 'Shoper', App: 'Mobile App', Kasse: 'Kassa Pro' },
  Ungarn: { ERP: 'NAV', Onlinesshop: 'Webshop', App: 'B2B Portal', Kasse: 'POS Lite' },
  Tschechien: { ERP: 'S4 Hana', Onlinesshop: 'eShop', App: 'Field App', Kasse: 'Cash Desk' },
  Albanien: { ERP: 'ERP Plus', Onlinesshop: 'AlbShop', App: 'Service App', Kasse: 'CashBox' },
  Kosovo: { ERP: 'ERP Flex', Onlinesshop: 'Kosovo Shop', App: 'App Suite', Kasse: 'Kasse 1' },
  Spanien: { ERP: 'Dynamics', Onlinesshop: 'Tiendan', App: 'Mobile Suite', Kasse: 'Caja' },
  Türkei: { ERP: 'NetSuite', Onlinesshop: 'TrShop', App: 'Türk App', Kasse: 'POS TR' },
  Schweiz: { ERP: 'SAP', Onlinesshop: 'Shopify', App: 'Swiss App', Kasse: 'Kasse CH' },
  Dänemark: { ERP: 'Dynamics', Onlinesshop: 'NordShop', App: 'DK App', Kasse: 'POS DK' },
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')
}

function getFallbackCountries(): Country[] {
  return defaultCountries.map((countryName, index) => ({
    id: `country-${index + 1}`,
    name: countryName,
    sort_order: index + 1,
  }))
}

function getFallbackCategories(): AppCategory[] {
  return defaultCategories.map((categoryName, index) => ({
    id: `category-${index + 1}`,
    name: categoryName,
    sort_order: index + 1,
  }))
}

function createInitialMatrix() {
  const matrix: Record<string, Record<string, string>> = {}

  getFallbackCategories().forEach((category) => {
    matrix[category.id] = {}

    getFallbackCountries().forEach((country) => {
      matrix[category.id][country.id] = defaultValues[country.name]?.[category.name] ?? '—'
    })
  })

  return matrix
}

function createMatrixFromAssignments(
  countries: Country[],
  categories: AppCategory[],
  assignments: CountryAppAssignment[]
) {
  const matrix: Record<string, Record<string, string>> = {}

  categories.forEach((category) => {
    matrix[category.id] = {}

    countries.forEach((country) => {
      const match = assignments.find(
        (entry) => entry.country_id === country.id && entry.app_category_id === category.id
      )

      matrix[category.id][country.id] = match?.app_name || '—'
    })
  })

  return matrix
}

export default function Page() {
  const [countries, setCountries] = useState<Country[]>(() => getFallbackCountries())
  const [categories, setCategories] = useState<AppCategory[]>(() => getFallbackCategories())
  const [matrix, setMatrix] = useState<Record<string, Record<string, string>>>(() => createInitialMatrix())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [countriesResponse, categoriesResponse, assignmentsResponse] = await Promise.all([
          supabase
            .from('countries')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true, nullsFirst: false }),
          supabase
            .from('app_categories')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true, nullsFirst: false }),
          supabase.from('country_app_assignments').select('country_id, app_category_id, app_name'),
        ])

        const countryRows =
          countriesResponse.error && isMissingTableError(countriesResponse.error)
            ? getFallbackCountries()
            : countriesResponse.data?.length
              ? (countriesResponse.data as Country[])
              : getFallbackCountries()

        const categoryRows =
          categoriesResponse.error && isMissingTableError(categoriesResponse.error)
            ? getFallbackCategories()
            : categoriesResponse.data?.length
              ? (categoriesResponse.data as AppCategory[])
              : getFallbackCategories()

        const assignments =
          assignmentsResponse.error && isMissingTableError(assignmentsResponse.error)
            ? []
            : (assignmentsResponse.data as CountryAppAssignment[]) || []

        setCountries(countryRows)
        setCategories(categoryRows)
        setMatrix(createMatrixFromAssignments(countryRows, categoryRows, assignments))
      } catch (error) {
        console.error('Failed to load app matrix data:', error)
        setCountries(getFallbackCountries())
        setCategories(getFallbackCategories())
        setMatrix(createInitialMatrix())
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const tableTitle = useMemo(() => {
    return categories.length > 0 ? 'App-Übersicht je Land' : 'Ländervergleich'
  }, [categories.length])

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">Market Alignment</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{tableTitle}</h1>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-600">Daten werden geladen...</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">
                    App-Kategorie
                  </th>
                  {countries.map((country) => (
                    <th
                      key={country.id}
                      className="min-w-[150px] border-b border-slate-200 px-4 py-3 font-semibold text-slate-700"
                    >
                      {country.name}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="even:bg-slate-50">
                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-700">
                      {category.name}
                    </th>

                    {countries.map((country) => (
                      <td
                        key={`${category.id}-${country.id}`}
                        className="border-l border-slate-200 px-4 py-3 text-slate-700"
                      >
                        {matrix[category.id]?.[country.id] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
