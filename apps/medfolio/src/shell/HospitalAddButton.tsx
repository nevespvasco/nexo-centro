import { Tooltip } from 'primereact/tooltip'

interface HospitalAddButtonProps {
  onClick: () => void
}

export function HospitalAddButton({ onClick }: HospitalAddButtonProps) {
  return (
    <>
      <Tooltip target=".hospital-avatar--add" position="right" content="Adicionar outro hospital" />
      <button
        type="button"
        className="hospital-avatar hospital-avatar--add"
        aria-label="Adicionar outro hospital"
        onClick={onClick}
      >
        <i className="pi pi-plus" />
      </button>
    </>
  )
}
