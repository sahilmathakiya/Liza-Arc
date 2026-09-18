import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Input, Label, Select } from '#/components/ui/field'
import type { FloorPlanSearch } from '#/lib/products'

export function FloorPlanFilters({ search }: { search: FloorPlanSearch }) {
  const navigate = useNavigate({ from: '/floor-plans/' })
  const [draft, setDraft] = useState({
    minLengthFt: search.minLengthFt ?? '',
    maxLengthFt: search.maxLengthFt ?? '',
    minWidthFt: search.minWidthFt ?? '',
    maxWidthFt: search.maxWidthFt ?? '',
    minAreaSqFt: search.minAreaSqFt ?? '',
    maxAreaSqFt: search.maxAreaSqFt ?? '',
    sort: search.sort ?? 'createdAt',
    order: search.order ?? 'desc',
  })

  function set(field: keyof typeof draft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function apply() {
    navigate({
      search: {
        minLengthFt: draft.minLengthFt || undefined,
        maxLengthFt: draft.maxLengthFt || undefined,
        minWidthFt: draft.minWidthFt || undefined,
        maxWidthFt: draft.maxWidthFt || undefined,
        minAreaSqFt: draft.minAreaSqFt || undefined,
        maxAreaSqFt: draft.maxAreaSqFt || undefined,
        sort: draft.sort,
        order: draft.order,
      },
    })
  }

  function reset() {
    setDraft({
      minLengthFt: '',
      maxLengthFt: '',
      minWidthFt: '',
      maxWidthFt: '',
      minAreaSqFt: '',
      maxAreaSqFt: '',
      sort: 'createdAt',
      order: 'desc',
    })
    navigate({ search: {} })
  }

  return (
    <div className="rounded-[8px] border border-line bg-surface p-5 shadow-[0_4px_25px_rgba(0,0,0,.14)_inset]">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="filter-length">Length (ft)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="filter-length"
              type="number"
              min={1}
              placeholder="Min"
              aria-label="Minimum length in feet"
              value={draft.minLengthFt}
              onChange={(e) => set('minLengthFt', e.target.value)}
            />
            <Input
              type="number"
              min={1}
              placeholder="Max"
              aria-label="Maximum length in feet"
              value={draft.maxLengthFt}
              onChange={(e) => set('maxLengthFt', e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="filter-width">Width (ft)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="filter-width"
              type="number"
              min={1}
              placeholder="Min"
              aria-label="Minimum width in feet"
              value={draft.minWidthFt}
              onChange={(e) => set('minWidthFt', e.target.value)}
            />
            <Input
              type="number"
              min={1}
              placeholder="Max"
              aria-label="Maximum width in feet"
              value={draft.maxWidthFt}
              onChange={(e) => set('maxWidthFt', e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="filter-area">Floor area (sqft)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="filter-area"
              type="number"
              min={1}
              placeholder="Min"
              aria-label="Minimum floor area in square feet"
              value={draft.minAreaSqFt}
              onChange={(e) => set('minAreaSqFt', e.target.value)}
            />
            <Input
              type="number"
              min={1}
              placeholder="Max"
              aria-label="Maximum floor area in square feet"
              value={draft.maxAreaSqFt}
              onChange={(e) => set('maxAreaSqFt', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <div className="w-44">
          <Label htmlFor="filter-sort">Sort by</Label>
          <Select
            id="filter-sort"
            value={draft.sort}
            onChange={(e) => set('sort', e.target.value)}
          >
            <option value="createdAt">Newest</option>
            <option value="floorAreaSqFt">Floor area</option>
            <option value="lengthFt">Length</option>
            <option value="widthFt">Width</option>
          </Select>
        </div>
        <div className="w-40">
          <Label htmlFor="filter-order">Direction</Label>
          <Select
            id="filter-order"
            value={draft.order}
            onChange={(e) => set('order', e.target.value)}
          >
            <option value="desc">High to low</option>
            <option value="asc">Low to high</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={apply}>Apply filters</Button>
          <Button onClick={reset} variant="secondary">
            Reset
          </Button>
        </div>
      </div>
    </div>
  )
}
