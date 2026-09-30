import { useEffect, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Toast } from 'primereact/toast'
import type { CirurgiasPorArea as Report, CirurgiasPorAreaTipo } from '@nexo-centro/schemas'
import { getCirurgiasPorArea } from '../lib/api'
import '../styles/crud.scss'

const TIPO_LABEL: Record<string, string> = { benigno: 'Benigno', maligno: 'Maligno' }
const grupoLabel = (g: CirurgiasPorAreaTipo) => (g.tipo ? TIPO_LABEL[g.tipo] : 'Sem classificação')

export function CirurgiasPorArea() {
  const toast = useRef<Toast>(null)
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCirurgiasPorArea()
      .then(setData)
      .catch(() => setError('Não foi possível carregar o relatório.'))
      .finally(() => setLoading(false))
  }, [])

  function exportCsv() {
    if (!data) return
    const lines = ['Zona anatómica;Classificação;Diagnóstico;Procedimento;Total']
    for (const zona of data.zonas) {
      for (const grupo of zona.grupos) {
        for (const linha of grupo.linhas) {
          lines.push(
            [
              zona.zonaAnatomicaNome,
              grupoLabel(grupo),
              linha.diagnosticoNome,
              linha.procedimentoNome,
              String(linha.total),
            ]
              .map((v) => `"${v.replace(/"/g, '""')}"`)
              .join(';'),
          )
        }
      }
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cirurgias_por_area.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.current?.show({ severity: 'success', summary: 'Exportado', detail: 'Relatório exportado (CSV).' })
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <h1 className="page__title">Cirurgias por Área</h1>
      <p className="page__subtitle">
        Distribuição das intervenções por zona anatómica e classificação da lesão.
      </p>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <ProgressSpinner style={{ width: 48, height: 48 }} />
        </div>
      )}
      {error && <div className="crud-form__error">{error}</div>}

      {data && (
        <>
          <div className="report-toolbar">
            <span className="report-total">Total de intervenções: {data.total}</span>
            <Button
              label="Exportar CSV"
              icon="pi pi-download"
              outlined
              onClick={exportCsv}
              disabled={data.total === 0}
            />
          </div>

          {data.zonas.length === 0 && <p className="page__subtitle">Ainda não há intervenções registadas.</p>}

          {data.zonas.map((zona) => (
            <div key={zona.zonaAnatomicaId ?? zona.zonaAnatomicaNome} className="report-zona">
              <div className="report-zona__head">
                <span className="report-zona__name">{zona.zonaAnatomicaNome}</span>
                <span className="report-zona__count">{zona.total} intervenções</span>
              </div>
              {zona.grupos.map((grupo) => (
                <div key={grupoLabel(grupo)}>
                  <div className="report-grupo__head">
                    {grupoLabel(grupo)} · {grupo.total}
                  </div>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Diagnóstico</th>
                        <th>Procedimento</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.linhas.map((linha) => (
                        <tr key={`${linha.diagnosticoNome} ${linha.procedimentoNome}`}>
                          <td>{linha.diagnosticoNome}</td>
                          <td>{linha.procedimentoNome}</td>
                          <td>{linha.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
