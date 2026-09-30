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
import type { CreateFormacao, TipoFormacao, TipoParticipacao } from '@nexo-centro/schemas'
import {
  ApiError,
  createFormacao,
  deleteFormacao,
  downloadFormacao,
  exportFormacoes,
  getFormacoes,
  updateFormacao,
  type Formacao as FormacaoRow,
} from '../lib/api'
import { formatDatePT, fromISODate, toISODate } from '../lib/date'
import '../styles/crud.scss'

const TIPO_OPTIONS: { label: string; value: TipoFormacao }[] = [
  { label: 'Curso', value: 'curso' },
  { label: 'Congresso', value: 'congresso' },
  { label: 'Pós-graduação', value: 'pos_graduacao' },
  { label: 'Mestrado', value: 'mestrado' },
  { label: 'Doutoramento', value: 'doutoramento' },
  { label: 'Outro', value: 'outro' },
]

const PARTICIPACAO_OPTIONS: { label: string; value: TipoParticipacao }[] = [
  { label: 'Participante', value: 'participante' },
  { label: 'Orador', value: 'orador' },
  { label: 'Organizador', value: 'organizador' },
  { label: 'Moderador', value: 'moderador' },
]

const tipoLabel = (tipo: TipoFormacao) => TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo

const emptyForm: CreateFormacao = {
  titulo: '',
  tipo: 'curso',
  dataInicio: toISODate(new Date()),
  dataFim: null,
  duracaoHoras: null,
  creditos: null,
}

export function Formacoes() {
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<FormacaoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FormacaoRow | null>(null)
  const [form, setForm] = useState<CreateFormacao>(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [removerCertificado, setRemoverCertificado] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  function load() {
    setLoading(true)
    getFormacoes()
      .then(setRows)
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as formações.' }),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
    setRemoverCertificado(false)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: FormacaoRow) {
    setEditing(row)
    setForm({
      titulo: row.titulo,
      tipo: row.tipo,
      dataInicio: row.dataInicio,
      dataFim: row.dataFim,
      duracaoHoras: row.duracaoHoras,
      creditos: row.creditos === null ? null : Number(row.creditos),
      descricao: row.descricao,
      entidadeOrganizadora: row.entidadeOrganizadora,
      localizacao: row.localizacao,
      categoria: row.categoria,
      tipoParticipacao: row.tipoParticipacao as TipoParticipacao | null | undefined,
      temaApresentacao: row.temaApresentacao,
      observacoes: row.observacoes,
    })
    setFile(null)
    setRemoverCertificado(false)
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateFormacao(editing.id, { ...form, removerCertificado: removerCertificado || undefined }, file)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Formação atualizada.' })
      } else {
        await createFormacao(form, file)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Formação criada.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar a formação.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: FormacaoRow) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.titulo}"?`,
      header: 'Eliminar formação',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteFormacao(row.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Formação eliminada.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar a formação.',
          })
        }
      },
    })
  }

  async function handleDownload(row: FormacaoRow) {
    try {
      await downloadFormacao(row.id)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível descarregar o certificado.' })
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportFormacoes()
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível exportar as formações.' })
    } finally {
      setExporting(false)
    }
  }

  const periodo = (row: FormacaoRow) =>
    row.dataFim && row.dataFim !== row.dataInicio
      ? `${formatDatePT(row.dataInicio)} — ${formatDatePT(row.dataFim)}`
      : formatDatePT(row.dataInicio)

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Formações</h1>
      <p className="page__subtitle">Cursos, congressos e formação avançada.</p>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar formações..." />
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
          emptyMessage="Nenhuma formação encontrada."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="titulo" header="Título" sortable />
          <Column header="Tipo" body={(row: FormacaoRow) => tipoLabel(row.tipo)} />
          <Column header="Período" body={periodo} />
          <Column header="Duração (h)" body={(row: FormacaoRow) => row.duracaoHoras ?? '—'} />
          <Column header="Créditos" body={(row: FormacaoRow) => row.creditos ?? '—'} />
          <Column
            header=""
            style={{ width: '130px' }}
            body={(row: FormacaoRow) => (
              <div className="crud-actions">
                {row.certificadoPath && (
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
        header={editing ? 'Editar formação' : 'Criar formação'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '560px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="formacao-titulo">Título</label>
            <InputText
              id="formacao-titulo"
              required
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-tipo">Tipo</label>
            <Dropdown
              inputId="formacao-tipo"
              value={form.tipo}
              options={TIPO_OPTIONS}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-inicio">Data de início</label>
            <Calendar
              inputId="formacao-inicio"
              required
              dateFormat="dd/mm/yy"
              value={fromISODate(form.dataInicio)}
              onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.value ? toISODate(e.value) : f.dataInicio }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-fim">Data de fim (opcional)</label>
            <Calendar
              inputId="formacao-fim"
              dateFormat="dd/mm/yy"
              showButtonBar
              value={fromISODate(form.dataFim)}
              onChange={(e) => setForm((f) => ({ ...f, dataFim: e.value ? toISODate(e.value) : null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-horas">Duração (horas)</label>
            <InputNumber
              inputId="formacao-horas"
              value={form.duracaoHoras}
              min={1}
              max={10000}
              onChange={(e) => setForm((f) => ({ ...f, duracaoHoras: e.value ?? null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-creditos">Créditos</label>
            <InputNumber
              inputId="formacao-creditos"
              value={form.creditos}
              mode="decimal"
              minFractionDigits={0}
              maxFractionDigits={2}
              min={0}
              onChange={(e) => setForm((f) => ({ ...f, creditos: e.value ?? null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-entidade">Entidade organizadora</label>
            <InputText
              id="formacao-entidade"
              value={form.entidadeOrganizadora ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, entidadeOrganizadora: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-localizacao">Localização</label>
            <InputText
              id="formacao-localizacao"
              value={form.localizacao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, localizacao: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-categoria">Categoria</label>
            <InputText
              id="formacao-categoria"
              value={form.categoria ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-participacao">Tipo de participação</label>
            <Dropdown
              inputId="formacao-participacao"
              value={form.tipoParticipacao ?? null}
              options={PARTICIPACAO_OPTIONS}
              showClear
              placeholder="Selecionar..."
              onChange={(e) => setForm((f) => ({ ...f, tipoParticipacao: e.value ?? null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-tema">Tema da apresentação</label>
            <InputText
              id="formacao-tema"
              value={form.temaApresentacao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, temaApresentacao: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-descricao">Descrição</label>
            <InputTextarea
              id="formacao-descricao"
              rows={3}
              value={form.descricao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="formacao-observacoes">Observações</label>
            <InputTextarea
              id="formacao-observacoes"
              rows={3}
              value={form.observacoes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value || null }))}
            />
          </div>
          <div className="crud-field">
            <label>Certificado</label>
            {editing?.certificadoOriginalName && !removerCertificado && !file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                <i className="pi pi-file" />
                <span>{editing.certificadoOriginalName}</span>
                <Button
                  type="button"
                  icon="pi pi-times"
                  text
                  rounded
                  severity="danger"
                  size="small"
                  aria-label="Remover certificado"
                  onClick={() => setRemoverCertificado(true)}
                />
              </div>
            )}
            <input
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setRemoverCertificado(false)
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
