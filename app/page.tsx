'use client'

import { supabase } from '@/lib/supabaseClient'
import packageJson from '../package.json'
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

type Application = {
  id: string
  name: string
  sort_order?: number | null
}

type CountryAppAssignment = {
  country_id: string
  app_category_id: string
  application_id: string
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

const defaultApplications = ['SAP', 'Shopware', 'Customer Portal', 'POS', 'Comarch', 'Shoper', 'Mobile App', 'Kassa Pro'] as const

const defaultAssignments: Record<string, Record<string, string[]>> = {
  Deutschland: { ERP: ['SAP'], Onlinesshop: ['Shopware'], App: ['Customer Portal'], Kasse: ['POS'] },
  Polen: { ERP: ['Comarch'], Onlinesshop: ['Shoper'], App: ['Mobile App'], Kasse: ['Kassa Pro'] },
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false
  }

  return error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')
}

function getErrorMessage(error: { message?: string } | null) {
  return error?.message || 'Unbekannter Fehler beim Laden der Daten.'
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

function getFallbackApplications(): Application[] {
  return defaultApplications.map((applicationName, index) => ({
    id: `application-${index + 1}`,
    name: applicationName,
    sort_order: index + 1,
  }))
}

function createInitialMatrix() {
  const matrix: Record<string, Record<string, string[]>> = {}
  const applications = getFallbackApplications()

  getFallbackCategories().forEach((category) => {
    matrix[category.id] = {}

    getFallbackCountries().forEach((country) => {
      matrix[category.id][country.id] = (defaultAssignments[country.name]?.[category.name] ?? [])
        .map((name) => applications.find((application) => application.name === name)?.name)
        .filter((name): name is string => Boolean(name))
    })
  })

  return matrix
}

function createMatrixFromAssignments(
  countries: Country[],
  categories: AppCategory[],
  applications: Application[],
  assignments: CountryAppAssignment[]
) {
  const matrix: Record<string, Record<string, string[]>> = {}

  categories.forEach((category) => {
    matrix[category.id] = {}

    countries.forEach((country) => {
      const applicationIds = assignments
        .filter(
          (entry) => entry.country_id === country.id && entry.app_category_id === category.id
        )
        .map((entry) => entry.application_id)

      matrix[category.id][country.id] = applicationIds
        .map((applicationId) => applications.find((application) => application.id === applicationId)?.name)
        .filter((name): name is string => Boolean(name))
    })
  })

  return matrix
}

export default function Page() {
  const [countries, setCountries] = useState<Country[]>(() => getFallbackCountries())
  const [categories, setCategories] = useState<AppCategory[]>(() => getFallbackCategories())
  const [matrix, setMatrix] = useState<Record<string, Record<string, string[]>>>(() => createInitialMatrix())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [countriesResponse, categoriesResponse, applicationsResponse, assignmentsResponse] = await Promise.all([
          supabase
            .from('countries')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true }),
          supabase
            .from('app_categories')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true }),
          supabase
            .from('applications')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true }),
          supabase.from('country_app_assignments').select('country_id, app_category_id, application_id'),
        ])

        const countryRows =
          countriesResponse.error
            ? getFallbackCountries()
            : countriesResponse.data?.length
              ? (countriesResponse.data as Country[])
              : getFallbackCountries()

        const categoryRows =
          categoriesResponse.error
            ? getFallbackCategories()
            : categoriesResponse.data?.length
              ? (categoriesResponse.data as AppCategory[])
              : getFallbackCategories()

        const applicationRows =
          applicationsResponse.error
            ? getFallbackApplications()
            : applicationsResponse.data?.length
              ? (applicationsResponse.data as Application[])
              : getFallbackApplications()

        const assignments =
          (assignmentsResponse.error ? [] : assignmentsResponse.data) as CountryAppAssignment[] || []

        const errors = [
          countriesResponse.error,
          categoriesResponse.error,
          applicationsResponse.error,
          assignmentsResponse.error,
        ].filter((error) => error && !isMissingTableError(error))

        if (errors.length > 0) {
          console.error('Supabase matrix errors:', errors)
          setLoadError(getErrorMessage(errors[0]))
        }

        setCountries(countryRows)
        setCategories(categoryRows)
        setMatrix(createMatrixFromAssignments(countryRows, categoryRows, applicationRows, assignments))
      } catch (error) {
        console.error('Failed to load app matrix data:', error)
        setLoadError(error instanceof Error ? error.message : 'Daten konnten nicht geladen werden.')
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
          <>
            {loadError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Datenbankhinweis: {loadError}
              </div>
            )}
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
                        {matrix[category.id]?.[country.id]?.length ? (
                          <ul className="space-y-1">
                            {matrix[category.id][country.id].map((applicationName, index) => (
                              <li key={`${applicationName}-${index}`} className="flex items-start gap-2">
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-500" />
                                <span>{applicationName}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Daten in Textform</h2>
              <div className="mt-4 space-y-4 text-sm text-slate-700">
                {countries.map((country) => (
                  <div key={country.id}>
                    <h3 className="font-semibold text-slate-900">{country.name}</h3>
                    <ul className="mt-1 space-y-1 pl-4">
                      {categories.map((category) => {
                        const applicationNames = matrix[category.id]?.[country.id] ?? []

                        return (
                          <li key={`${country.id}-${category.id}`}>
                            <span className="font-medium">{category.name}:</span>{' '}
                            {applicationNames.length > 0 ? applicationNames.join(', ') : 'keine Applikation'}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="mt-5 text-right text-xs text-slate-400">
          Build-Version {packageJson.version}
        </footer>
      </div>
    </main>
  )
}
