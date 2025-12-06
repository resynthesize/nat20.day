import { useState, useRef, useEffect } from 'react'
import { useParty } from '@/hooks/useParty'
import { SkeletonBox } from '@/components/organisms/shared/skeleton'

interface PartySelectorProps {
  onCreateParty: () => void
}

export function PartySelector({ onCreateParty }: PartySelectorProps) {
  const { parties, currentParty, setCurrentParty, loading } = useParty()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target
      if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (loading) {
    return (
      <SkeletonBox
        width={140}
        height={34}
        style={{ borderRadius: 'var(--radius-sm)' }}
      />
    )
  }

  if (parties.length === 0) {
    return (
      <button type="button" className="party-selector-button create" onClick={onCreateParty}>
        + Create Party
      </button>
    )
  }

  return (
    <div className="party-selector" ref={dropdownRef}>
      <button
        type="button"
        className="party-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="party-name">{currentParty?.name || 'Select Party'}</span>
        <span className="party-selector-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="party-dropdown" role="listbox">
          {parties.map((party) => (
            <button
              key={party.id}
              type="button"
              className={`party-option ${party.id === currentParty?.id ? 'selected' : ''}`}
              onClick={() => {
                setCurrentParty(party.id)
                setIsOpen(false)
              }}
              role="option"
              aria-selected={party.id === currentParty?.id}
            >
              <span className="party-option-name">{party.name}</span>
              {party.id === currentParty?.id && <span className="party-check">✓</span>}
            </button>
          ))}
          <div className="party-dropdown-divider" />
          <button
            type="button"
            className="party-option create-option"
            onClick={() => {
              setIsOpen(false)
              onCreateParty()
            }}
          >
            + Create New Party
          </button>
        </div>
      )}
    </div>
  )
}
