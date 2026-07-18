// ─── Generic "slot" system ──────────────────────────────────────────────────
// A slot is a free-text title + a capacity + a list of registered member
// names. Used both standalone (Orga tab) and attached to a checklist item
// (itemId set). Pure logic, no React/Supabase dependency — kept portable in
// case this becomes a building block of a future dedicated app.

export function createSlot({ title, capacity, createdBy, itemId = null }) {
  return {
    id: Date.now(),
    title,
    capacity,
    members: [],
    itemId,
    showInOrga: false,
    createdBy,
    createdAt: new Date().toISOString(),
  }
}

export function getSlotStatus(slot) {
  if (slot.members.length === 0) return 'uncovered'
  if (slot.members.length < slot.capacity) return 'partial'
  return 'full'
}

export function canJoin(slot, name) {
  return !slot.members.includes(name) && slot.members.length < slot.capacity
}

export function joinSlot(slot, name) {
  if (!canJoin(slot, name)) return slot
  return { ...slot, members: [...slot.members, name] }
}

export function leaveSlot(slot, name) {
  return { ...slot, members: slot.members.filter(m => m !== name) }
}
