import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageTitle } from './PageTitle';

describe('PageTitle', () => {
  it('renders title text', () => {
    render(<PageTitle title="New Invoice" />);

    expect(screen.getByRole('heading', { name: 'New Invoice' })).toBeInTheDocument();
  });

  it('renders optional subtitle', () => {
    render(
      <PageTitle
        title="New Invoice"
        subtitle="Create a new invoice for your customer"
      />
    );

    expect(screen.getByText('Create a new invoice for your customer')).toBeInTheDocument();
  });

  it('renders right-side action buttons', () => {
    render(
      <PageTitle
        title="New Invoice"
        rightActions={
          <button>Save</button>
        }
      />
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageTitle title="Test" className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('truncates long titles properly', () => {
    render(<PageTitle title="Very Long Title That Should Be Truncated" />);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('truncate');
  });

  it('maintains proper layout with actions', () => {
    render(
      <PageTitle
        title="Test Title"
        rightActions={
          <>
            <button>Action 1</button>
            <button>Action 2</button>
          </>
        }
      />
    );

    expect(screen.getByRole('button', { name: 'Action 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action 2' })).toBeInTheDocument();
  });
});
