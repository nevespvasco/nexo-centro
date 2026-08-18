interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="page">
      <h1 className="page__title">{title}</h1>
      <p className="page__subtitle">Esta secção está em construção.</p>
    </div>
  )
}
