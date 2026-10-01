import { InputText } from 'primereact/inputtext'
import {
  tiposDeAbordagemApi,
  type CatalogoItem,
  type CatalogoItemBody,
  type CatalogoItemUpdate,
} from '../lib/api'
import { SharedCatalogPage } from '../components/SharedCatalogPage'

interface Form {
  nome: string
}

export function TiposDeAbordagem() {
  return (
    <SharedCatalogPage<CatalogoItem, Form, CatalogoItemBody, CatalogoItemUpdate>
      title="Tipos de Abordagem"
      subtitle="Tipos de abordagem disponíveis no âmbito selecionado. Partilhe o mesmo item com vários hospitais."
      singular="tipo de abordagem"
      api={tiposDeAbordagemApi}
      emptyForm={{ nome: '' }}
      toForm={(row) => ({ nome: row.nome })}
      toCreate={(form, hospitalId) => ({ nome: form.nome, hospitalId })}
      toUpdate={(form) => ({ nome: form.nome })}
      renderFields={(form, patch) => (
        <div className="crud-field">
          <label htmlFor="tipo-abordagem-nome">Nome</label>
          <InputText id="tipo-abordagem-nome" required value={form.nome} onChange={(e) => patch({ nome: e.target.value })} />
        </div>
      )}
    />
  )
}
