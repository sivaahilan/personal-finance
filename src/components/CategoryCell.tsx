export function CategoryCell({ category, subcategory, colour, onClick }: { category: string | null; subcategory: string | null; colour: string; onClick?: () => void }) {
  if (!category) {
    return (
      <span className="cat-cell none" onClick={onClick} role={onClick ? 'button' : undefined}>
        Uncategorised
      </span>
    )
  }
  return (
    <span className="cat-cell" onClick={onClick} role={onClick ? 'button' : undefined} title="Change category">
      <span className="dot" style={{ background: colour }} />
      <span>{category}</span>
      {subcategory && <span className="sub">/ {subcategory}</span>}
    </span>
  )
}
