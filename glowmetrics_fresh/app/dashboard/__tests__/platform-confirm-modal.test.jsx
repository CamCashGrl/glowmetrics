/**
 * Uploads are never stored as platform 'Unknown'. When /api/upload can't
 * identify a file's platform it saves nothing and returns
 * code 'platform_required' (covered in app/api/upload/__tests__/platform-label.test.js).
 * The dashboard then asks the creator to confirm the platform in
 * PlatformConfirmModal and re-sends the same file with that platform.
 */
const fs = require('fs')
const path = require('path')
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import PlatformConfirmModal, { CONFIRMABLE_PLATFORMS, PLATFORM_CONFIRM_TITLE, PLATFORM_CONFIRM_BODY } from '../PlatformConfirmModal'

const setup = (props = {}) => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const utils = render(<PlatformConfirmModal open fileName="tips_export.csv" onConfirm={onConfirm} onCancel={onCancel} {...props} />)
  return { onConfirm, onCancel, ...utils }
}

describe('PlatformConfirmModal', () => {
  test('renders nothing when closed', () => {
    render(<PlatformConfirmModal open={false} onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('shows the confirm-platform message and the file name', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(PLATFORM_CONFIRM_TITLE).toBe("We couldn't identify this platform")
    expect(PLATFORM_CONFIRM_BODY).toBe('Please confirm the platform.')
    expect(screen.getByText(PLATFORM_CONFIRM_TITLE)).toBeInTheDocument()
    expect(screen.getByText(PLATFORM_CONFIRM_BODY)).toBeInTheDocument()
    expect(screen.getByTestId('platform-confirm-file')).toHaveTextContent('tips_export.csv')
  })

  test('offers exactly the supported platforms and never an Unknown option', () => {
    setup()
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.textContent)).toEqual(expect.arrayContaining(['CBChaturbate', 'BCBongaCams', 'MFCMyFreeCams']))
    expect(radios).toHaveLength(3)
    expect(CONFIRMABLE_PLATFORMS.map(p => p.id)).toEqual(['Chaturbate', 'BongaCams', 'MyFreeCams'])
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument()
  })

  test('nothing is pre-selected: Confirm is disabled until the creator picks', () => {
    const { onConfirm } = setup()
    screen.getAllByRole('radio').forEach(r => expect(r).toHaveAttribute('aria-checked', 'false'))
    const submit = screen.getByTestId('platform-confirm-submit')
    expect(submit).toBeDisabled()
    fireEvent.click(submit)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  test('confirming sends the chosen platform', () => {
    const { onConfirm, onCancel } = setup()
    fireEvent.click(screen.getByTestId('platform-confirm-BongaCams'))
    expect(screen.getByTestId('platform-confirm-BongaCams')).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByTestId('platform-confirm-submit'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('BongaCams')
    expect(onCancel).not.toHaveBeenCalled()
  })

  test('Cancel, Escape and the backdrop cancel; clicks inside the dialog do not', () => {
    const { onCancel, onConfirm } = setup()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('platform-confirm-cancel'))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('platform-confirm-backdrop'))
    expect(onCancel).toHaveBeenCalledTimes(3)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  test('Free-plan locked platforms are labelled but stay selectable (existing upgrade preview handles them)', () => {
    const { onConfirm } = setup({ lockedPlatforms: ['MyFreeCams'] })
    const mfc = screen.getByTestId('platform-confirm-MyFreeCams')
    expect(mfc).toHaveTextContent('Pro')
    expect(screen.getByTestId('platform-confirm-Chaturbate')).not.toHaveTextContent('Pro')
    fireEvent.click(mfc)
    fireEvent.click(screen.getByTestId('platform-confirm-submit'))
    expect(onConfirm).toHaveBeenCalledWith('MyFreeCams')
  })

  test('re-opening clears the previous choice', () => {
    const props = { fileName: 'a.csv', onConfirm: jest.fn(), onCancel: jest.fn() }
    const { rerender } = render(<PlatformConfirmModal open {...props} />)
    fireEvent.click(screen.getByTestId('platform-confirm-Chaturbate'))
    rerender(<PlatformConfirmModal open={false} {...props} />)
    rerender(<PlatformConfirmModal open {...props} />)
    expect(screen.getByTestId('platform-confirm-Chaturbate')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('platform-confirm-submit')).toBeDisabled()
  })
})

describe('dashboard upload wiring (app/dashboard/page.js)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'page.js'), 'utf8')

  test('platform_required opens the confirm popup only when no platform was sent', () => {
    expect(src).toMatch(/result\.code === 'platform_required' && !forcePlatform\)\s*\{[\s\S]{0,600}setPlatformConfirm\(\{ file, dateOrder \}\)/)
  })

  test('confirming re-sends the same file with the confirmed platform', () => {
    expect(src).toMatch(/onConfirm=\{\(platform\) => \{[\s\S]{0,600}handleCSV\(pending\.file, platform, pending\.dateOrder \|\| null\)/)
  })

  test('the confirmed platform is not stored as the menu default for the next file', () => {
    const block = src.slice(src.indexOf('<PlatformConfirmModal'), src.indexOf('{/* UPGRADE MODAL */}'))
    expect(block).not.toMatch(/setUploadPlatform\(/)
  })

  test('cancel clears the pending file and resets the import screen', () => {
    expect(src).toMatch(/onCancel=\{\(\) => \{ setPlatformConfirm\(null\); resetImport\(\) \}\}/)
  })
})
