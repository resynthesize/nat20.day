import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParty } from '@/hooks/useParty'
import {
  generateHourlyOptions,
  generateHalfHourOptions,
  formatTimeDisplay,
  sortTimes,
} from '@/lib/time-utils'
import { TIME_PRESETS } from '@/lib/constants'

export function TimePresetsSelector() {
  const { currentParty, refreshParties } = useParty()

  // UI state
  const [showHalfHours, setShowHalfHours] = useState(false)
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [draggedTime, setDraggedTime] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track if dragging from available vs selected
  const dragSourceRef = useRef<'available' | 'selected' | null>(null)

  // All available times based on toggle
  const allTimeOptions = showHalfHours ? generateHalfHourOptions() : generateHourlyOptions()

  // Sync with party settings
  useEffect(() => {
    if (currentParty?.time_options) {
      setSelectedTimes(currentParty.time_options)
      // Check if any half-hour times exist
      const hasHalfHours = currentParty.time_options.some((t) => t.endsWith(':30'))
      setShowHalfHours(hasHalfHours)
    }
  }, [currentParty?.time_options])

  // Drag handlers for available times
  const handleDragStartFromAvailable = (time: string) => {
    setDraggedTime(time)
    dragSourceRef.current = 'available'
  }

  // Drag handlers for selected times (reordering)
  const handleDragStartFromSelected = (time: string) => {
    setDraggedTime(time)
    dragSourceRef.current = 'selected'
  }

  const handleDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault()
    if (index !== undefined) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDropOnSelected = (e: React.DragEvent, dropIndex?: number) => {
    e.preventDefault()
    setDragOverIndex(null)

    if (!draggedTime) return

    if (dragSourceRef.current === 'available') {
      // Adding from available
      if (!selectedTimes.includes(draggedTime)) {
        if (dropIndex !== undefined) {
          // Insert at specific position
          const newTimes = [...selectedTimes]
          newTimes.splice(dropIndex, 0, draggedTime)
          setSelectedTimes(newTimes)
        } else {
          // Add to end, sorted
          setSelectedTimes((prev) => sortTimes([...prev, draggedTime]))
        }
      }
    } else if (dragSourceRef.current === 'selected' && dropIndex !== undefined) {
      // Reordering within selected
      const currentIndex = selectedTimes.indexOf(draggedTime)
      if (currentIndex !== -1 && currentIndex !== dropIndex) {
        const newTimes = [...selectedTimes]
        newTimes.splice(currentIndex, 1)
        const adjustedIndex = currentIndex < dropIndex ? dropIndex - 1 : dropIndex
        newTimes.splice(adjustedIndex, 0, draggedTime)
        setSelectedTimes(newTimes)
      }
    }

    setDraggedTime(null)
    dragSourceRef.current = null
  }

  const handleDragEnd = () => {
    setDraggedTime(null)
    setDragOverIndex(null)
    dragSourceRef.current = null
  }

  const handleAddTime = (time: string) => {
    if (!selectedTimes.includes(time)) {
      setSelectedTimes((prev) => sortTimes([...prev, time]))
    }
  }

  const handleRemoveTime = (time: string) => {
    setSelectedTimes((prev) => prev.filter((t) => t !== time))
  }

  const handleSave = async () => {
    if (!currentParty) return

    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('parties')
        .update({
          time_options: selectedTimes,
          default_time_presets: selectedTimes.slice(0, TIME_PRESETS.MAX_PRESETS),
        })
        .eq('id', currentParty.id)

      if (updateError) throw updateError
      await refreshParties()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save time presets')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    JSON.stringify(selectedTimes) !== JSON.stringify(currentParty?.time_options ?? [])

  return (
    <div className="time-presets-settings">
      <h3>Session Time Presets</h3>
      <p className="form-hint">
        Select times and drag to reorder. The first {TIME_PRESETS.MAX_PRESETS} become quick-select
        buttons in the scheduler.
      </p>

      {error && <div className="admin-error">{error}</div>}

      {/* Half-hour toggle */}
      <label className="time-presets-toggle">
        <input
          type="checkbox"
          checked={showHalfHours}
          onChange={(e) => setShowHalfHours(e.target.checked)}
        />
        <span>Show :30 half-hour options</span>
      </label>

      {/* Available times grid */}
      <div className="time-presets-available">
        <h4>Available Times</h4>
        <div className="time-presets-grid">
          {allTimeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`time-preset-option ${selectedTimes.includes(option.value) ? 'selected' : ''}`}
              draggable
              onDragStart={() => handleDragStartFromAvailable(option.value)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                if (selectedTimes.includes(option.value)) {
                  handleRemoveTime(option.value)
                } else {
                  handleAddTime(option.value)
                }
              }}
              disabled={saving}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected times (drop zone) */}
      <div
        className={`time-presets-selected ${draggedTime && dragSourceRef.current === 'available' ? 'drag-active' : ''}`}
        onDragOver={(e) => handleDragOver(e)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDropOnSelected(e)}
      >
        <h4>Selected Presets ({selectedTimes.length})</h4>
        <p className="form-hint">
          First {TIME_PRESETS.MAX_PRESETS} appear as buttons. Drag to reorder.
        </p>
        <div className="time-presets-selected-list">
          {selectedTimes.length === 0 ? (
            <div className="time-presets-empty">Drag times here or click to add</div>
          ) : (
            selectedTimes.map((time, index) => (
              <div
                key={time}
                className={`time-presets-selected-item ${index < TIME_PRESETS.MAX_PRESETS ? 'preset' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                draggable
                onDragStart={() => handleDragStartFromSelected(time)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDropOnSelected(e, index)}
              >
                <span className="time-presets-selected-label">
                  {index < TIME_PRESETS.MAX_PRESETS && (
                    <span className="preset-badge">{index + 1}</span>
                  )}
                  {formatTimeDisplay(time)}
                </span>
                <button
                  type="button"
                  className="time-presets-remove"
                  onClick={() => handleRemoveTime(time)}
                  disabled={saving}
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        className="form-button"
        onClick={handleSave}
        disabled={saving || !hasChanges}
      >
        {saving ? 'Saving...' : 'Save Time Presets'}
      </button>
    </div>
  )
}
