import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WateringCan } from './WateringCan'

const NOW = 1_700_000_000_000
const MIN = 60_000

describe('WateringCan', () => {
  it('shows how many tends are left', () => {
    render(<WateringCan tokens={5} maxTokens={5} nextTokenAt={0} now={NOW} />)
    expect(screen.getByText('5 tends left')).toBeInTheDocument()
  })

  it('fills the can in proportion to the remaining tends', () => {
    const { container } = render(
      <WateringCan tokens={5} maxTokens={5} nextTokenAt={0} now={NOW} />,
    )
    const water = container.querySelector('.wcan-water')!
    const full = Number(water.getAttribute('height'))
    expect(full).toBeGreaterThan(0)

    const { container: half } = render(
      <WateringCan tokens={2} maxTokens={4} nextTokenAt={NOW + MIN} now={NOW} />,
    )
    const halfWater = half.querySelector('.wcan-water')!
    expect(Number(halfWater.getAttribute('height'))).toBeCloseTo(full / 2)
  })

  it('adds the refill countdown when down to the last tend', () => {
    render(<WateringCan tokens={1} maxTokens={5} nextTokenAt={NOW + 2 * MIN} now={NOW} />)
    expect(screen.getByText('1 tend left — refills in 2m')).toBeInTheDocument()
  })

  it('shows only the countdown when empty', () => {
    const { container } = render(
      <WateringCan tokens={0} maxTokens={5} nextTokenAt={NOW + 3 * MIN} now={NOW} />,
    )
    expect(screen.getByText('refills in 3m')).toBeInTheDocument()
    const water = container.querySelector('.wcan-water')!
    expect(Number(water.getAttribute('height'))).toBe(0)
  })

  it('keeps the accessible summary of the can', () => {
    render(<WateringCan tokens={2} maxTokens={5} nextTokenAt={NOW + MIN} now={NOW} />)
    expect(
      screen.getByLabelText('2 of 5 tends left in your watering can'),
    ).toBeInTheDocument()
  })

  it('does not show a countdown while the can is full', () => {
    render(<WateringCan tokens={5} maxTokens={5} nextTokenAt={0} now={NOW} />)
    expect(screen.queryByText(/refills/)).not.toBeInTheDocument()
  })
})
