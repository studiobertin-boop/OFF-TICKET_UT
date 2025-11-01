/**
 * Debounce function to delay execution until after a specified wait time
 * Useful for optimizing search input handlers to reduce API calls
 *
 * @param func - The function to debounce
 * @param wait - The delay in milliseconds
 * @returns A debounced version of the function
 *
 * @example
 * const debouncedSearch = debounce((searchTerm: string) => {
 *   console.log('Searching for:', searchTerm)
 * }, 300)
 *
 * debouncedSearch('hello') // Will only execute after 300ms of no more calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function debounced(...args: Parameters<T>) {
    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      func(...args)
    }, wait)
  }
}
