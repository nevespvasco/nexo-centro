import { InputText } from 'primereact/inputtext'
import {
  funcoesCirurgiaoApi,
  type CatalogoItem,
  type CatalogoItemBody,
  type CatalogoItemUpdate,
} from '../lib/api'
import { SharedCatalogPage } from '../components/SharedCatalogPage'

interface Form {
  nome: string
}

export function FuncoesCirurgiao() {
  return (
    <SharedCatalogPage<CatalogoItem, Form, CatalogoItemBody, CatalogoItemUpdate>
      title="Funções de Cirurgião"
      subtitle="Funções disponíveis no âmbito selecionado. Partilhe o mesmo item com vários hospitais."
      singular="função de cirurgião"
      api={funcoesCirurgiaoApi}
      emptyForm={{ nome: '' }}
      toForm={(row) => ({ nome: row.nome })}
      toCreate={(form, hospitalId) => ({ nome: form.nome, hospitalId })}
      toUpdate={(form) => ({ nome: form.nome })}
      renderFields={(form, patch) => (
        <div className="crud-field">
          <label htmlFor="funcao-nome">Nome</label>
          <InputText id="funcao-nome" required value={form.nome} onChange={(e) => patch({ nome: e.target.value })} />
        </div>
      )}
    />
  )
}
