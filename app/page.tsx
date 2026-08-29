'use client'

import { supabase } from '@/lib/supabaseClient'
import packageJson from '../package.json'
import { useEffect, useMemo, useState } from 'react'

type ViewMode = 'overview' | 'maintenance'

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
        .filter((entry) => entry.country_id === country.id && entry.app_category_id === category.id)
        .map((entry) => entry.application_id)

      matrix[category.id][country.id] = applicationIds
        .map((applicationId) => applications.find((application) => application.id === applicationId)?.name)
        .filter((name): name is string => Boolean(name))
    })
  })

  return matrix
}

function getAssignmentsForSelection(
  countryId: string,
  categoryId: string,
  sourceAssignments: CountryAppAssignment[]
) {
  return sourceAssignments
    .filter((entry) => entry.country_id === countryId && entry.app_category_id === categoryId)
    .map((entry) => entry.application_id)
}

export default function Page() {
  const [view, setView] = useState<ViewMode>('overview')
  const [countries, setCountries] = useState<Country[]>(() => getFallbackCountries())
  const [categories, setCategories] = useState<AppCategory[]>(() => getFallbackCategories())
  const [applications, setApplications] = useState<Application[]>(() => getFallbackApplications())
  const [assignments, setAssignments] = useState<CountryAppAssignment[]>([])
  const [matrix, setMatrix] = useState<Record<string, Record<string, string[]>>>(() => createInitialMatrix())
  const [selectedCountryId, setSelectedCountryId] = useState<string>('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

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

        const storedAssignments =
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
        setApplications(applicationRows)
        setAssignments(storedAssignments)
        setMatrix(createMatrixFromAssignments(countryRows, categoryRows, applicationRows, storedAssignments))

        const nextCountryId = countryRows[0]?.id ?? ''
        const nextCategoryId = categoryRows[0]?.id ?? ''

        if (nextCountryId) {
          setSelectedCountryId((current) => current || nextCountryId)
        }

        if (nextCategoryId) {
          setSelectedCategoryId((current) => current || nextCategoryId)
        }

        if (nextCountryId && nextCategoryId) {
          setSelectedApplicationIds(getAssignmentsForSelection(nextCountryId, nextCategoryId, storedAssignments))
        } else {
          setSelectedApplicationIds([])
        }
      } catch (error) {
        console.error('Failed to load app matrix data:', error)
        setLoadError(error instanceof Error ? error.message : 'Daten konnten nicht geladen werden.')
        setCountries(getFallbackCountries())
        setCategories(getFallbackCategories())
        setApplications(getFallbackApplications())
        setAssignments([])
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

  function updateSelectionForCountryAndCategory(
    countryId: string,
    categoryId: string,
    sourceAssignments: CountryAppAssignment[]
  ) {
    setSelectedApplicationIds(getAssignmentsForSelection(countryId, categoryId, sourceAssignments))
  }

  function handleCountryChanged(countryId: string) {
    setSelectedCountryId(countryId)
    updateSelectionForCountryAndCategory(countryId, selectedCategoryId, assignments)
  }

  function handleCategoryChanged(categoryId: string) {
    setSelectedCategoryId(categoryId)
    updateSelectionForCountryAndCategory(selectedCountryId, categoryId, assignments)
  }

  function toggleApplication(applicationId: string) {
    setSelectedApplicationIds((current) =>
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId]
    )
  }

  async function handleSaveAssignments() {
    if (!selectedCountryId || !selectedCategoryId) {
      return
    }

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const { error: deleteError } = await supabase
        .from('country_app_assignments')
        .delete()
        .eq('country_id', selectedCountryId)
        .eq('app_category_id', selectedCategoryId)

      if (deleteError && !isMissingTableError(deleteError)) {
        throw deleteError
      }

      const rows = selectedApplicationIds.map((applicationId) => ({
        country_id: selectedCountryId,
        app_category_id: selectedCategoryId,
        application_id: applicationId,
      }))

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('country_app_assignments').insert(rows)

        if (insertError && !isMissingTableError(insertError)) {
          throw insertError
        }
      }

      const updatedAssignments = assignments.filter(
        (entry) => !(entry.country_id === selectedCountryId && entry.app_category_id === selectedCategoryId)
      )

      const mergedAssignments = [...updatedAssignments, ...rows]
      setAssignments(mergedAssignments)
      setMatrix(createMatrixFromAssignments(countries, categories, applications, mergedAssignments))
      setSaveMessage('Die Zuordnung wurde gespeichert.')
    } catch (error) {
      console.error('Failed to save application assignment:', error)
      setSaveMessage(
        error instanceof Error ? `Speichern fehlgeschlagen: ${error.message}` : 'Speichern fehlgeschlagen.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">Market Alignment</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{tableTitle}</h1>
          </div>

          <nav className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Ansichten">
            <button
              type="button"
              onClick={() => setView('overview')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                view === 'overview'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Anzeige
            </button>
            <button
              type="button"
              onClick={() => setView('maintenance')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                view === 'maintenance'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Pflege
            </button>
          </nav>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-600">Daten werden geladen...</p>
          </div>
        ) : view === 'maintenance' ? (
          <div className="space-y-5">
            {loadError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Datenbankhinweis: {loadError}
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Land
                  <select
                    value={selectedCountryId}
                    onChange={(event) => handleCountryChanged(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  >
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Kategorie
                  <select
                    value={selectedCategoryId}
                    onChange={(event) => handleCategoryChanged(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Applikationen zuordnen</h2>
                  <span className="text-sm text-slate-500">{selectedApplicationIds.length} ausgewählt</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {applications.map((application) => {
                    const isChecked = selectedApplicationIds.includes(application.id)

                    return (
                      <label
                        key={application.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                          isChecked
                            ? 'border-sky-200 bg-sky-50 text-sky-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleApplication(application.id)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span>{application.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  {saveMessage ? <span className="text-emerald-700">{saveMessage}</span> : 'Bitte Auswahl speichern.'}
                </div>

                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  {isSaving ? 'Wird gespeichert...' : 'Zuordnungen speichern'}
                </button>
              </div>
            </section>
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

          </>
        )}

        <footer className="mt-5 text-right text-xs text-slate-400">
          Build-Version {packageJson.version}
        </footer>
      </div>
    </main>
  )
}
