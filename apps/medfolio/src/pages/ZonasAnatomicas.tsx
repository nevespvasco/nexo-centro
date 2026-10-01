import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import {
  zonasAnatomicasApi,
  type ZonaAnatomica,
  type ZonaAnatomicaBody,
  type ZonaAnatomicaUpdate,
} from '../lib/api'
import { SharedCatalogPage } from '../components/SharedCatalogPage'

interface Form {
  nome: string
  descricao: string | null
}

const emptyForm: Form = { nome: '', descricao: null }

// Nota: a reordenação por arrastar (reorderZonasAnatomicas) só faz sentido num
// único hospital e será reintroduzida quando o âmbito estiver reduzido a um só.
export function ZonasAnatomicas() {
  return (
    <SharedCatalogPage<ZonaAnatomica, Form, ZonaAnatomicaBody, ZonaAnatomicaUpdate>
      title="Zonas Anatómicas"
      subtitle="Zonas anatómicas disponíveis no âmbito selecionado. Partilhe o mesmo item com vários hospitais."
      singular="zona anatómica"
      api={zonasAnatomicasApi}
      emptyForm={emptyForm}
      globalFilterFields={['nome', 'descricao']}
      toForm={(row) => ({ nome: row.nome, descricao: row.descricao })}
      toCreate={(form, hospitalId) => ({ nome: form.nome, descricao: form.descricao, hospitalId })}
      toUpdate={(form) => ({ nome: form.nome, descricao: form.descricao })}
      extraColumns={
        <Column header="Descrição" body={(row: ZonaAnatomica) => row.descricao ?? '—'} />
      }
      renderFields={(form, patch) => (
        <>
          <div className="crud-field">
            <label htmlFor="zona-nome">Nome</label>
            <InputText id="zona-nome" required value={form.nome} onChange={(e) => patch({ nome: e.target.value })} />
          </div>
          <div className="crud-field">
            <label htmlFor="zona-descricao">Descrição</label>
            <InputText id="zona-descricao" value={form.descricao ?? ''} onChange={(e) => patch({ descricao: e.target.value || null })} />
          </div>
        </>
      )}
    />
  )
}
