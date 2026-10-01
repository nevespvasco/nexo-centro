import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import {
  especialidadesApi,
  type EspecialidadeBody,
  type EspecialidadeRow,
  type EspecialidadeUpdate,
} from '../lib/api'
import { SharedCatalogPage } from '../components/SharedCatalogPage'

interface Form {
  nome: string
  descricao: string | null
}

const emptyForm: Form = { nome: '', descricao: null }

export function Especialidades() {
  return (
    <SharedCatalogPage<EspecialidadeRow, Form, EspecialidadeBody, EspecialidadeUpdate>
      title="Especialidades"
      subtitle="Especialidades disponíveis no âmbito selecionado. Partilhe o mesmo item com vários hospitais."
      singular="especialidade"
      api={especialidadesApi}
      emptyForm={emptyForm}
      globalFilterFields={['nome', 'descricao']}
      toForm={(row) => ({ nome: row.nome, descricao: row.descricao })}
      toCreate={(form, hospitalId) => ({ nome: form.nome, descricao: form.descricao, hospitalId })}
      toUpdate={(form) => ({ nome: form.nome, descricao: form.descricao })}
      extraColumns={
        <Column header="Descrição" body={(row: EspecialidadeRow) => row.descricao ?? '—'} />
      }
      renderFields={(form, patch) => (
        <>
          <div className="crud-field">
            <label htmlFor="esp-nome">Nome</label>
            <InputText id="esp-nome" required value={form.nome} onChange={(e) => patch({ nome: e.target.value })} />
          </div>
          <div className="crud-field">
            <label htmlFor="esp-descricao">Descrição</label>
            <InputText id="esp-descricao" value={form.descricao ?? ''} onChange={(e) => patch({ descricao: e.target.value || null })} />
          </div>
        </>
      )}
    />
  )
}
