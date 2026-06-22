import { useEffect, useRef, useState } from 'react'
import { PROFILE_OPTIONS, useAddTerminal } from '../hooks/useAddTerminal'

export function AddTerminalButton(): React.JSX.Element {
  const { canAdd, isAdding, addTerminalWithProfile } = useAddTerminal()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const handleSelectProfile = (profile: (typeof PROFILE_OPTIONS)[number]['profile']): void => {
    setOpen(false)
    void addTerminalWithProfile(profile)
  }

  return (
    <div className="add-terminal" ref={rootRef}>
      <button
        type="button"
        className="btn btn--ghost"
        disabled={!canAdd || isAdding}
        title={canAdd ? 'Yeni terminal ekle' : 'Önce bir proje seçin'}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        + Terminal
      </button>

      {open ? (
        <div className="add-terminal__menu" role="menu" aria-label="Terminal profili">
          <p className="add-terminal__menu-title">Profil seçin</p>
          <div className="add-terminal__menu-options">
            {PROFILE_OPTIONS.map((option) => (
              <button
                key={option.profile}
                type="button"
                role="menuitem"
                className="btn btn--profile"
                disabled={isAdding}
                onClick={() => handleSelectProfile(option.profile)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
