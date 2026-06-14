import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ShareButton } from './ShareButton'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('ShareButton', () => {
  it('renders its label and shares the message on click', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share: shareFn })
    render(<ShareButton className="link-btn" label="↗ invite a friend" message={() => 'come help'} />)
    fireEvent.click(screen.getByRole('button', { name: '↗ invite a friend' }))
    await waitFor(() => expect(shareFn).toHaveBeenCalled())
    expect(shareFn.mock.calls[0][0].text).toBe('come help')
    // native sheet gives its own feedback — the label must not change
    expect(screen.getByRole('button', { name: '↗ invite a friend' })).toBeInTheDocument()
  })

  it('confirms a silent clipboard copy, then restores the label', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(<ShareButton className="link-btn" label="↗ share" message={() => 'msg'} />)
    fireEvent.click(screen.getByRole('button'))
    await act(() => vi.advanceTimersByTimeAsync(0)) // flush the async share()
    expect(screen.getByRole('button')).toHaveTextContent('✓ copied')

    await act(() => vi.advanceTimersByTimeAsync(2_500))
    expect(screen.getByRole('button')).toHaveTextContent('↗ share')
  })
})
