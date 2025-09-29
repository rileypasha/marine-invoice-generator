import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { VesselsTable } from '../../src/components/vessels/VesselsTable';

// Mock the hooks
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

describe('VesselsTable Dropdown Menu', () => {
  const mockVessels = [
    {
      id: '1',
      name: 'Test Vessel',
      length_ft: 100,
      weight_tons: 500,
      type: 'Cargo',
      invoice_count: 2,
      invoice_total: 5000,
    },
  ];

  const defaultProps = {
    vessels: mockVessels,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onViewInvoices: jest.fn(),
    onNewInvoice: jest.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <VesselsTable {...defaultProps} {...props} />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dropdown Menu Behavior', () => {
    test('dropdown button has proper accessibility attributes', () => {
      renderComponent();

      const dropdownButton = screen.getByRole('button', { name: /row actions/i });

      expect(dropdownButton).toHaveAttribute('aria-label', 'Row actions');
      expect(dropdownButton).toHaveAttribute('aria-haspopup', 'menu');
      expect(dropdownButton).toHaveAttribute('data-row-actions', 'trigger');
    });

    test('dropdown menu opens when button is clicked', async () => {
      renderComponent();

      const dropdownButton = screen.getByRole('button', { name: /row actions/i });
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText('New invoice')).toBeInTheDocument();
        expect(screen.getByText('View invoices')).toBeInTheDocument();
        expect(screen.getByText('Edit vessel')).toBeInTheDocument();
        expect(screen.getByText('Delete vessel')).toBeInTheDocument();
      });
    });

    test('clicking dropdown button does not trigger row selection', async () => {
      const onRowSelect = jest.fn();
      renderComponent({ onRowSelect });

      const dropdownButton = screen.getByRole('button', { name: /row actions/i });
      fireEvent.click(dropdownButton);

      expect(onRowSelect).not.toHaveBeenCalled();
    });

    test('menu actions trigger correct callbacks', async () => {
      renderComponent();

      const dropdownButton = screen.getByRole('button', { name: /row actions/i });
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText('New invoice')).toBeInTheDocument();
      });

      // Test New invoice action
      fireEvent.click(screen.getByText('New invoice'));
      expect(defaultProps.onNewInvoice).toHaveBeenCalledWith(mockVessels[0]);

      // Reopen menu for next test
      fireEvent.click(dropdownButton);
      await waitFor(() => {
        expect(screen.getByText('View invoices')).toBeInTheDocument();
      });

      // Test View invoices action
      fireEvent.click(screen.getByText('View invoices'));
      expect(defaultProps.onViewInvoices).toHaveBeenCalledWith(mockVessels[0]);
    });

    test('delete action triggers with vessel data', async () => {
      renderComponent();

      const dropdownButton = screen.getByRole('button', { name: /row actions/i });
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText('Delete vessel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Delete vessel'));
      expect(defaultProps.onDelete).toHaveBeenCalledWith(mockVessels[0]);
    });

    test('columns array is stable and prevents unnecessary re-renders', () => {
      const { rerender } = renderComponent();

      const firstDropdownButton = screen.getByRole('button', { name: /row actions/i });

      // Rerender with same props
      rerender(
        <BrowserRouter>
          <VesselsTable {...defaultProps} />
        </BrowserRouter>
      );

      const secondDropdownButton = screen.getByRole('button', { name: /row actions/i });

      // Button should be the same element (no re-render of columns)
      expect(firstDropdownButton).toBe(secondDropdownButton);
    });

    test('menu stays open with rapid clicks', async () => {
      renderComponent();

      const dropdownButton = screen.getByRole('button', { name: /row actions/i });

      // Rapid clicks
      fireEvent.click(dropdownButton);
      fireEvent.click(dropdownButton);
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText('New invoice')).toBeInTheDocument();
      });

      // Menu should still be open and functional
      expect(screen.getByText('View invoices')).toBeInTheDocument();
      expect(screen.getByText('Edit vessel')).toBeInTheDocument();
      expect(screen.getByText('Delete vessel')).toBeInTheDocument();
    });
  });

  describe('Event Propagation', () => {
    test('dropdown button click does not propagate to parent elements', () => {
      const parentClickHandler = jest.fn();

      render(
        <BrowserRouter>
          <div onClick={parentClickHandler}>
            <VesselsTable {...defaultProps} />
          </div>
        </BrowserRouter>
      );

      const dropdownButton = screen.getByRole('button', { name: /row actions/i });
      fireEvent.click(dropdownButton);

      expect(parentClickHandler).not.toHaveBeenCalled();
    });

    test('dropdown button pointer events do not propagate', () => {
      const parentPointerHandler = jest.fn();

      render(
        <BrowserRouter>
          <div onPointerDown={parentPointerHandler}>
            <VesselsTable {...defaultProps} />
          </div>
        </BrowserRouter>
      );

      const dropdownButton = screen.getByRole('button', { name: /row actions/i });
      fireEvent.pointerDown(dropdownButton);

      expect(parentPointerHandler).not.toHaveBeenCalled();
    });
  });
});