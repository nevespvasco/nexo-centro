import { InputText } from 'primereact/inputtext'
import {
  tiposDeCirurgiaApi,
  type CatalogoItem,
  type CatalogoItemBody,
  type CatalogoItemUpdate,
} from '../lib/api'
import { SharedCatalogPage } from '../components/SharedCatalogPage'

interface Form {
  nome: string
}

export function TiposDeCirurgia() {
  return (
    <SharedCatalogPage<CatalogoItem, Form, CatalogoItemBody, CatalogoItemUpdate>
      title="Tipos de Cirurgia"
      subtitle="Tipos de cirurgia disponíveis no âmbito selecionado. Partilhe o mesmo item com vários hospitais."
      singular="tipo de cirurgia"
      api={tiposDeCirurgiaApi}
      emptyForm={{ nome: '' }}
      toForm={(row) => ({ nome: row.nome })}
      toCreate={(form, hospitalId) => ({ nome: form.nome, hospitalId })}
      toUpdate={(form) => ({ nome: form.nome })}
      renderFields={(form, patch) => (
        <div className="crud-field">
          <label htmlFor="tipo-cirurgia-nome">Nome</label>
          <InputText id="tipo-cirurgia-nome" required value={form.nome} onChange={(e) => patch({ nome: e.target.value })} />
        </div>
      )}
    />
  )
}
