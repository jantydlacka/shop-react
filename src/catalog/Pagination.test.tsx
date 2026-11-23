import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { Pagination } from './Pagination'

const to = (page: number) => ({ search: page === 1 ? '' : `?strana=${page}` })
const renderPagination = (currentPage: number, lastPage: number) =>
  render(
    <MemoryRouter>
      <Pagination currentPage={currentPage} lastPage={lastPage} to={to} />
    </MemoryRouter>,
  )

test('is hidden for a single page', () => {
  renderPagination(1, 1)
  expect(screen.queryByRole('navigation', { name: 'Stránkování' })).toBeNull()
})

test('first page has Další and no Předchozí', () => {
  renderPagination(1, 2)
  const nav = screen.getByRole('navigation', { name: 'Stránkování' })
  expect(nav).toHaveTextContent('Strana 1 z 2')
  expect(screen.queryByRole('link', { name: 'Předchozí' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Další' })).toHaveAttribute('href', '/?strana=2')
})

test('last page has Předchozí and no Další', () => {
  renderPagination(2, 2)
  expect(screen.getByRole('link', { name: 'Předchozí' })).toHaveAttribute('href', '/')
  expect(screen.queryByRole('link', { name: 'Další' })).toBeNull()
})

test('announces the current page', () => {
  renderPagination(2, 3)
  expect(screen.getByText('Strana 2 z 3')).toHaveAttribute('aria-current', 'page')
})
