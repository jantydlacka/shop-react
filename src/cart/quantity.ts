/** Parses a typed quantity; returns the number, or the field message when it is not 1..max. */
export function parseQuantity(text: string, max: number): { value: number } | { error: string } {
  const value = Number(text)
  if (text.trim() === '' || !Number.isInteger(value) || value < 1 || value > max) {
    return { error: `Zadejte počet od 1 do ${max}.` }
  }
  return { value }
}
