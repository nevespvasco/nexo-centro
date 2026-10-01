import { useEffect, useMemo, useState } from 'react'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import {
  listEspecialidades,
  procedimentosApi,
  type EspecialidadeRow,
  type Procedimento,
  type ProcedimentoBody,
  type ProcedimentoUpdate,
} from '../lib/api'
import { SharedCatalogPage } from '../components/SharedCatalogPage'

interface Form {
  nome: string
  especialidadeId: string
}

const emptyForm: Form = { nome: '', especialidadeId: '' }

export function Procedimentos() {
  // Especialidades de todos os hospitais do utilizador, para o dropdown e para
  // mostrar o nome na tabela. O servidor valida a disponibilidade no hospital
  // de destino ao criar/associar.
  const [especialidades, setEspecialidades] = useState<EspecialidadeRow[]>([])
  useEffect(() => {
    listEspecialidades({ kind: 'all' }).then(setEspecialidades).catch(() => null)
  }, [])
  const nomePorId = useMemo(
    () => new Map(especialidades.map((e) => [e.id, e.nome])),
    [especialidades],
  )

  return (
    <SharedCatalogPage<Procedimento, Form, ProcedimentoBody, ProcedimentoUpdate>
      title="Procedimentos"
      subtitle="Procedimentos disponíveis no âmbito selecionado. Partilhe o mesmo item com vários hospitais."
      singular="procedimento"
      api={procedimentosApi}
      emptyForm={emptyForm}
      toForm={(row) => ({ nome: row.nome, especialidadeId: row.especialidadeId ?? '' })}
      toCreate={(form, hospitalId) => ({ nome: form.nome, especialidadeId: form.especialidadeId, hospitalId })}
      toUpdate={(form) => ({ nome: form.nome, especialidadeId: form.especialidadeId })}
      extraColumns={
        <Column
          header="Especialidade"
          body={(row: Procedimento) => (row.especialidadeId ? nomePorId.get(row.especialidadeId) ?? '—' : '—')}
        />
      }
      renderFields={(form, patch) => (
        <>
          <div className="crud-field">
            <label htmlFor="proc-nome">Nome</label>
            <InputText id="proc-nome" required value={form.nome} onChange={(e) => patch({ nome: e.target.value })} />
          </div>
          <div className="crud-field">
            <label htmlFor="proc-especialidade">Especialidade</label>
            <Dropdown
              inputId="proc-especialidade"
              value={form.especialidadeId}
              options={especialidades}
              optionLabel="nome"
              optionValue="id"
              filter
              placeholder="Selecionar…"
              onChange={(e) => patch({ especialidadeId: e.value })}
            />
          </div>
        </>
      )}
    />
  )
}
