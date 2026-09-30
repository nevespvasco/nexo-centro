import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { Toast } from 'primereact/toast'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import { Checkbox } from 'primereact/checkbox'
import type { CreateAtividadeCientifica, TipoAtividade } from '@nexo-centro/schemas'
import {
  ApiError,
  createAtividadeCientifica,
  deleteAtividadeCientifica,
  downloadAtividade,
  exportAtividades,
  getAtividadesCientificas,
  updateAtividadeCientifica,
  type AtividadeCientifica as Atividade,
} from '../lib/api'
import { formatDatePT, fromISODate, toISODate } from '../lib/date'
import '../styles/crud.scss'

const TIPO_OPTIONS: { label: string; value: TipoAtividade }[] = [
  { label: 'Artigo', value: 'artigo' },
  { label: 'Comunicação', value: 'comunicacao' },
  { label: 'Congresso', value: 'congresso' },
  { label: 'Poster', value: 'poster' },
  { label: 'Outro', value: 'outro' },
]

const tipoLabel = (tipo: TipoAtividade) => TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo

const emptyForm: CreateAtividadeCientifica = {
  titulo: '',
  tipo: 'artigo',
  data: toISODate(new Date()),
  autorPrincipal: false,
  posicaoAutor: null,
  fatorImpacto: null,
}

export function AtividadeCientifica() {
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Atividade | null>(null)
  const [form, setForm] = useState<CreateAtividadeCientifica>(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [removerFicheiro, setRemoverFicheiro] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  function load() {
    setLoading(true)
    getAtividadesCientificas()
      .then(setRows)
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as atividades.' }),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
    setRemoverFicheiro(false)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: Atividade) {
    setEditing(row)
    setForm({
      titulo: row.titulo,
      tipo: row.tipo,
      data: row.data,
      autorPrincipal: row.autorPrincipal,
      posicaoAutor: row.posicaoAutor,
      fatorImpacto: row.fatorImpacto === null ? null : Number(row.fatorImpacto),
      descricao: row.descricao,
      revistaConferencia: row.revistaConferencia,
      localizacao: row.localizacao,
      categoria: row.categoria,
      autores: row.autores,
      doi: row.doi,
      isbn: row.isbn,
      link: row.link,
      observacoes: row.observacoes,
    })
    setFile(null)
    setRemoverFicheiro(false)
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateAtividadeCientifica(editing.id, { ...form, removerFicheiro: removerFicheiro || undefined }, file)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Atividade atualizada.' })
      } else {
        await createAtividadeCientifica(form, file)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Atividade criada.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar a atividade.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: Atividade) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.titulo}"?`,
      header: 'Eliminar atividade',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteAtividadeCientifica(row.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Atividade eliminada.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar a atividade.',
          })
        }
      },
    })
  }

  async function handleDownload(row: Atividade) {
    try {
      await downloadAtividade(row.id)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível descarregar o ficheiro.' })
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportAtividades()
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível exportar as atividades.' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Atividade Científica</h1>
      <p className="page__subtitle">Artigos, comunicações, posters e outra produção científica.</p>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar atividades..." />
        </span>
        <Button label="Exportar" icon="pi pi-file-excel" outlined loading={exporting} onClick={handleExport} />
        <Button label="Criar" icon="pi pi-plus" onClick={openCreate} />
      </div>

      <div className="crud-table">
        <DataTable
          responsiveLayout="stack"
          breakpoint="767px"
          value={rows}
          loading={loading}
          globalFilter={filter}
          globalFilterFields={['titulo']}
          emptyMessage="Nenhuma atividade encontrada."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="titulo" header="Título" sortable />
          <Column header="Tipo" body={(row: Atividade) => tipoLabel(row.tipo)} />
          <Column header="Data" body={(row: Atividade) => formatDatePT(row.data)} sortable sortField="data" />
          <Column header="Autor principal" body={(row: Atividade) => (row.autorPrincipal ? 'Sim' : '—')} />
          <Column header="Posição" body={(row: Atividade) => row.posicaoAutor ?? '—'} />
          <Column header="Fator de impacto" body={(row: Atividade) => row.fatorImpacto ?? '—'} />
          <Column
            header=""
            style={{ width: '130px' }}
            body={(row: Atividade) => (
              <div className="crud-actions">
                {row.ficheiroPath && (
                  <Button
                    icon="pi pi-download"
                    text
                    rounded
                    aria-label="Descarregar"
                    onClick={() => handleDownload(row)}
                  />
                )}
                <Button icon="pi pi-pencil" text rounded aria-label="Editar" onClick={() => openEdit(row)} />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  severity="danger"
                  aria-label="Eliminar"
                  onClick={() => confirmDelete(row)}
                />
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog
        header={editing ? 'Editar atividade' : 'Criar atividade'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '560px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="atividade-titulo">Título</label>
            <InputText
              id="atividade-titulo"
              required
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-tipo">Tipo</label>
            <Dropdown
              inputId="atividade-tipo"
              value={form.tipo}
              options={TIPO_OPTIONS}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-data">Data</label>
            <Calendar
              inputId="atividade-data"
              required
              dateFormat="dd/mm/yy"
              value={fromISODate(form.data)}
              onChange={(e) => setForm((f) => ({ ...f, data: e.value ? toISODate(e.value) : f.data }))}
            />
          </div>
          <div className="crud-field crud-field--inline">
            <Checkbox
              inputId="atividade-autor"
              checked={form.autorPrincipal ?? false}
              onChange={(e) => setForm((f) => ({ ...f, autorPrincipal: e.checked ?? false }))}
            />
            <label htmlFor="atividade-autor">Autor principal</label>
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-posicao">Posição do autor</label>
            <InputNumber
              inputId="atividade-posicao"
              value={form.posicaoAutor}
              min={1}
              max={100}
              onChange={(e) => setForm((f) => ({ ...f, posicaoAutor: e.value ?? null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-fator">Fator de impacto</label>
            <InputNumber
              inputId="atividade-fator"
              value={form.fatorImpacto}
              mode="decimal"
              minFractionDigits={0}
              maxFractionDigits={3}
              min={0}
              onChange={(e) => setForm((f) => ({ ...f, fatorImpacto: e.value ?? null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-revista">Revista / Conferência</label>
            <InputText
              id="atividade-revista"
              value={form.revistaConferencia ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, revistaConferencia: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-autores">Autores</label>
            <InputText
              id="atividade-autores"
              value={form.autores ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, autores: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-doi">DOI</label>
            <InputText
              id="atividade-doi"
              value={form.doi ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-isbn">ISBN</label>
            <InputText
              id="atividade-isbn"
              value={form.isbn ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-link">Link</label>
            <InputText
              id="atividade-link"
              type="url"
              value={form.link ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-localizacao">Localização</label>
            <InputText
              id="atividade-localizacao"
              value={form.localizacao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, localizacao: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-categoria">Categoria</label>
            <InputText
              id="atividade-categoria"
              value={form.categoria ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-descricao">Descrição</label>
            <InputTextarea
              id="atividade-descricao"
              rows={3}
              value={form.descricao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="atividade-observacoes">Observações</label>
            <InputTextarea
              id="atividade-observacoes"
              rows={3}
              value={form.observacoes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label>Ficheiro</label>
            {editing?.ficheiroOriginalName && !removerFicheiro && !file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                <i className="pi pi-file" />
                <span>{editing.ficheiroOriginalName}</span>
                <Button
                  type="button"
                  icon="pi pi-times"
                  text
                  rounded
                  severity="danger"
                  size="small"
                  aria-label="Remover ficheiro"
                  onClick={() => setRemoverFicheiro(true)}
                />
              </div>
            )}
            <input
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setRemoverFicheiro(false)
              }}
            />
          </div>
          {formError && <div className="crud-form__error">{formError}</div>}
          <div className="crud-form__actions">
            <Button type="button" label="Cancelar" text onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button type="submit" label="Guardar" loading={saving} />
          </div>
        </form>
      </Dialog>
    </div>
  )
}
