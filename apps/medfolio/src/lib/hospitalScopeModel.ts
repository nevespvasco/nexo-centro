export type HospitalScope = { kind: 'all' } | { kind: 'selected'; ids: string[] }

export function scopeParams(scope: HospitalScope): URLSearchParams {
  const params = new URLSearchParams()
  params.set('scope', scope.kind)
  if (scope.kind === 'selected') scope.ids.forEach((id) => params.append('hospitalId', id))
  return params
}
