import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { Toast } from 'primereact/toast'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import type { HospitalMembership } from '@nexo-centro/schemas'
import { ApiError, type SharedCatalogApi, type SharedCatalogRow } from '../lib/api'
import { useHospitalScope } from '../lib/hospitalScope'
import { HospitalScopePicker } from './HospitalScopePicker'
import '../styles/crud.scss'

export interface SharedCatalogPageProps<
  TRow extends SharedCatalogRow,
  TForm,
  TCreate,
  TUpdate,
> {
  title: string
  subtitle: string
  /** Nome singular do item, para mensagens ("Especialidade criada."). */
  singular: string
  api: SharedCatalogApi<TRow, TCreate, TUpdate>
  emptyForm: TForm
  toForm: (row: TRow) => TForm
  toCreate: (form: TForm, hospitalId: string) => TCreate
  toUpdate: (form: TForm) => TUpdate
  /** Campos de conteúdo do formulário (nome + específicos do catálogo). */
  renderFields: (form: TForm, patch: (partial: Partial<TForm>) => void) => ReactNode
  /** Colunas de conteúdo entre "Nome" e "Hospitais". */
  extraColumns?: ReactNode
  /** Filtro global da tabela por estes campos. */
  globalFilterFields?: string[]
}

export function SharedCatalogPage<
  TRow extends SharedCatalogRow,
  TForm,
  TCreate,
  TUpdate,
>({
  title,
  subtitle,
  singular,
  api,
  emptyForm,
  toForm,
  toCreate,
  toUpdate,
  renderFields,
  extraColumns,
  globalFilterFields = ['nome'],
}: SharedCatalogPageProps<TRow, TForm, TCreate, TUpdate>) {
  const { scope, setScope, hospitals, selectedHospitals, label, loadingHospitals, scopeError, accessVersion, refreshHospitals } =
    useHospitalScope()
  const scopeKey = scope.kind === 'all' ? 'all' : scope.ids.join(',')
  const toast = useRef<Toast>(null)
  const requestVersion = useRef(0)
  const [rows, setRows] = useState<TRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TRow | null>(null)
  const [form, setForm] = useState<TForm>(emptyForm)
  const [writeHospitalId, setWriteHospitalId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [manageRow, setManageRow] = useState<TRow | null>(null)
  const [addHospitalId, setAddHospitalId] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)

  function load() {
    if (loadingHospitals) return
    const version = ++requestVersion.current
    setLoading(true)
    setRows([])
    api
      .list(scope)
      .then((result) => {
        if (version === requestVersion.current) setRows(result)
      })
      .catch((error) => {
        if (version !== requestVersion.current) return
        if (error instanceof ApiError && error.status === 403) void refreshHospitals()
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: `Não foi possível carregar ${title.toLocaleLowerCase('pt')}.` })
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false)
      })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(), [scopeKey, loadingHospitals, accessVersion])

  function patch(partial: Partial<TForm>) {
    setForm((f) => ({ ...f, ...partial }))
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setWriteHospitalId(selectedHospitals.length === 1 ? selectedHospitals[0].id : null)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: TRow) {
    setEditing(row)
    setForm(toForm(row))
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!editing && !writeHospitalId) {
      setFormError(`Escolha o hospital ${singular === 'zona anatómica' ? 'da' : 'do'} ${singular}.`)
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.update(editing.id, toUpdate(form))
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Alterações guardadas.' })
      } else {
        await api.create(toCreate(form, writeHospitalId!))
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Item criado.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: TRow) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome}"?`,
      header: `Eliminar ${singular}`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await api.remove(row.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Item eliminado.' })
          load()
        } catch (err) {
          toast.current?.show({ severity: 'error', summary: 'Erro', detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar.' })
        }
      },
    })
  }

  async function doAssociate() {
    if (!manageRow || !addHospitalId) return
    setManaging(true)
    try {
      await api.associate(manageRow.id, addHospitalId)
      const updated = (await api.list(scope)).find((r) => r.id === manageRow.id) ?? null
      setRows((prev) => prev.map((r) => (updated && r.id === updated.id ? updated : r)))
      setManageRow(updated)
      setAddHospitalId(null)
      toast.current?.show({ severity: 'success', summary: 'Associado', detail: 'Hospital associado.' })
    } catch (err) {
      toast.current?.show({ severity: 'error', summary: 'Erro', detail: err instanceof ApiError ? err.message : 'Não foi possível associar.' })
    } finally {
      setManaging(false)
    }
  }

  async function doDisassociate(hospitalId: string) {
    if (!manageRow) return
    setManaging(true)
    try {
      await api.disassociate(manageRow.id, hospitalId)
      // Se o item deixou de estar no âmbito atual, recarrega tudo.
      const list = await api.list(scope)
      const updated = list.find((r) => r.id === manageRow.id) ?? null
      setRows(list)
      setManageRow(updated)
      toast.current?.show({ severity: 'success', summary: 'Removido', detail: 'Associação removida.' })
      if (!updated) setManageRow(null)
    } catch (err) {
      toast.current?.show({ severity: 'error', summary: 'Erro', detail: err instanceof ApiError ? err.message : 'Não foi possível remover a associação.' })
    } finally {
      setManaging(false)
    }
  }

  const associatableHospitals = (row: TRow): HospitalMembership[] => {
    const current = new Set(row.hospitais.map((h) => h.id))
    return hospitals.filter((h) => !current.has(h.id))
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">{title}</h1>
      <p className="page__subtitle">{subtitle}</p>
      <HospitalScopePicker scope={scope} hospitals={hospitals} label={label} onChange={setScope} />
      {scopeError && <div className="crud-form__error" role="alert">{scopeError}</div>}
      <div role="status">{rows.length.toLocaleString('pt-PT')} itens · {selectedHospitals.length} hospitais</div>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar..." />
        </span>
        <Button label="Criar" icon="pi pi-plus" onClick={openCreate} disabled={hospitals.length === 0} />
      </div>

      <div className="crud-table">
        <DataTable
          responsiveLayout="stack"
          breakpoint="767px"
          value={rows}
          loading={loading}
          globalFilter={filter}
          globalFilterFields={globalFilterFields}
          emptyMessage="Nenhum item encontrado."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="nome" header="Nome" sortable />
          {extraColumns}
          <Column
            header="Hospitais"
            body={(row: TRow) =>
              row.isGlobal ? (
                <Tag value="Global" severity="info" />
              ) : (
                <div className="catalog-hospitais">
                  {row.hospitais.map((h) => (
                    <Tag key={h.id} value={h.nome} />
                  ))}
                  {row.hospitais.length === 0 && '—'}
                </div>
              )
            }
          />
          <Column
            header=""
            style={{ width: '150px' }}
            body={(row: TRow) => (
              <div className="crud-actions">
                <Button icon="pi pi-pencil" text rounded aria-label="Editar" disabled={!row.editable} onClick={() => openEdit(row)} />
                <Button
                  icon="pi pi-building"
                  text
                  rounded
                  aria-label="Gerir hospitais"
                  disabled={!row.editable || row.isGlobal}
                  onClick={() => { setManageRow(row); setAddHospitalId(null) }}
                />
                <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Eliminar" disabled={!row.editable} onClick={() => confirmDelete(row)} />
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog header={editing ? `Editar ${singular}` : `Criar ${singular}`} visible={dialogOpen} onHide={() => setDialogOpen(false)} style={{ width: '480px' }}>
        <form className="crud-form" onSubmit={handleSubmit}>
          {!editing && (
            <div className="crud-field">
              <label htmlFor="catalog-hospital">Hospital</label>
              <Dropdown inputId="catalog-hospital" filter value={writeHospitalId} options={hospitals} optionLabel="nome" optionValue="id" placeholder="Escolher hospital" onChange={(e) => setWriteHospitalId(e.value)} />
              <small>O item é criado neste hospital. Pode partilhá-lo com outros depois.</small>
            </div>
          )}
          <fieldset disabled={!editing && !writeHospitalId} style={{ border: 0, padding: 0, margin: 0 }}>
            {renderFields(form, patch)}
          </fieldset>
          {formError && <div className="crud-form__error">{formError}</div>}
          <div className="crud-form__actions">
            <Button type="button" label="Cancelar" text onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button type="submit" label="Guardar" loading={saving} disabled={!editing && !writeHospitalId} />
          </div>
        </form>
      </Dialog>

      <Dialog header={`Hospitais de "${manageRow?.nome ?? ''}"`} visible={!!manageRow} onHide={() => setManageRow(null)} style={{ width: 'min(92vw, 480px)' }}>
        <p>Este item é o mesmo em todos os hospitais associados: uma alteração aparece em todos.</p>
        <div className="catalog-manage__list">
          {manageRow?.hospitais.map((h) => (
            <div key={h.id} className="catalog-manage__item">
              <span>{h.nome}</span>
              <Button icon="pi pi-times" text rounded severity="danger" aria-label={`Remover ${h.nome}`} loading={managing} onClick={() => doDisassociate(h.id)} />
            </div>
          ))}
          {manageRow && manageRow.hospitais.length === 0 && <p role="status">Sem hospitais associados.</p>}
        </div>
        <div className="catalog-manage__add">
          <Dropdown
            value={addHospitalId}
            options={manageRow ? associatableHospitals(manageRow) : []}
            optionLabel="nome"
            optionValue="id"
            filter
            placeholder="Associar a outro hospital…"
            onChange={(e) => setAddHospitalId(e.value)}
            disabled={!manageRow || associatableHospitals(manageRow).length === 0}
          />
          <Button label="Associar" icon="pi pi-plus" disabled={!addHospitalId} loading={managing} onClick={doAssociate} />
        </div>
      </Dialog>
    </div>
  )
}
