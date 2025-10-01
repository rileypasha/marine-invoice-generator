/**
 * Unit tests for ChangedValue component
 *
 * Tests visual diff rendering and edge case handling
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ChangedValue,
  AddedValue,
  RemovedValue,
  buildDiffIndex,
  getDelta,
  hasChangeRequestedStatus,
} from '../ChangedValue';
import { PatchOperation } from '../../../types/diff.types';

describe('ChangedValue', () => {
  describe('No diff scenarios', () => {
    it('should render value normally when no diff provided', () => {
      render(
        <ChangedValue
          path="/customerName"
          value="John Doe"
          status="change_requested"
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByRole('insertion')).not.toBeInTheDocument();
      expect(screen.queryByRole('deletion')).not.toBeInTheDocument();
    });

    it('should render value normally when status is not change_requested', () => {
      const diff = buildDiffIndex([
        { op: 'replace', path: '/customerName', value: 'Jane Doe' }
      ]);

      render(
        <ChangedValue
          path="/customerName"
          value="Jane Doe"
          diff={diff}
          status="approved"
        />
      );

      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.queryByRole('insertion')).not.toBeInTheDocument();
    });

    it('should render value normally when path not in diff', () => {
      const diff = buildDiffIndex([
        { op: 'replace', path: '/vesselName', value: 'SS Marine' }
      ]);

      render(
        <ChangedValue
          path="/customerName"
          value="John Doe"
          diff={diff}
          status="change_requested"
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByRole('insertion')).not.toBeInTheDocument();
    });
  });

  describe('Added values', () => {
    it('should render green bold for added values', () => {
      const diff = buildDiffIndex([
        { op: 'add', path: '/customerName', value: 'John Doe' }
      ]);

      render(
        <ChangedValue
          path="/customerName"
          value="John Doe"
          diff={diff}
          status="change_requested"
        />
      );

      const insertion = screen.getByRole('insertion');
      expect(insertion).toBeInTheDocument();
      expect(insertion).toHaveClass('no-underline');
      expect(insertion.parentElement).toHaveClass('text-green-600', 'font-semibold');
    });

    it('should show + prefix for added values', () => {
      const diff = buildDiffIndex([
        { op: 'add', path: '/total', value: 1500 }
      ]);

      const { container } = render(
        <ChangedValue
          path="/total"
          value="$1,500.00"
          diff={diff}
          status="change_requested"
        />
      );

      expect(container.textContent).toContain('+');
    });

    it('should have correct aria-label for accessibility', () => {
      const diff = buildDiffIndex([
        { op: 'add', path: '/notes', value: 'New note' }
      ]);

      render(
        <ChangedValue
          path="/notes"
          value="New note"
          diff={diff}
          status="change_requested"
        />
      );

      expect(screen.getByRole('insertion')).toHaveAttribute(
        'aria-label',
        'Added: New note'
      );
    });
  });

  describe('Removed values', () => {
    it('should render red bold strikethrough for removed values', () => {
      const diff = buildDiffIndex([
        { op: 'remove', path: '/vesselName', value: 'SS Old' }
      ]);

      render(
        <ChangedValue
          path="/vesselName"
          value="Current value ignored"
          diff={diff}
          status="change_requested"
        />
      );

      const deletion = screen.getByRole('deletion');
      expect(deletion).toBeInTheDocument();
      expect(deletion.parentElement).toHaveClass(
        'text-red-600',
        'font-semibold',
        'line-through'
      );
    });

    it('should show − prefix for removed values', () => {
      const diff = buildDiffIndex([
        { op: 'remove', path: '/notes', value: 'Old note' }
      ]);

      const { container } = render(
        <ChangedValue
          path="/notes"
          value="ignored"
          diff={diff}
          status="change_requested"
        />
      );

      expect(container.textContent).toContain('−');
    });

    it('should display the removed value from diff', () => {
      const diff = buildDiffIndex([
        { op: 'remove', path: '/customerEmail', value: 'old@example.com' }
      ]);

      render(
        <ChangedValue
          path="/customerEmail"
          value="new@example.com"
          diff={diff}
          status="change_requested"
        />
      );

      expect(screen.getByText('old@example.com')).toBeInTheDocument();
    });
  });

  describe('Changed values (replace)', () => {
    it('should show old→new for changed values', () => {
      const diff = buildDiffIndex([
        { op: 'replace', path: '/total', value: 1000 }
      ]);

      render(
        <ChangedValue
          path="/total"
          value="$1,500.00"
          diff={diff}
          status="change_requested"
        />
      );

      expect(screen.getByRole('deletion')).toBeInTheDocument();
      expect(screen.getByRole('insertion')).toBeInTheDocument();
    });

    it('should render old value in red strikethrough', () => {
      const diff = buildDiffIndex([
        { op: 'replace', path: '/customerName', value: 'Old Name' }
      ]);

      render(
        <ChangedValue
          path="/customerName"
          value="New Name"
          diff={diff}
          status="change_requested"
        />
      );

      const deletion = screen.getByRole('deletion');
      expect(deletion.parentElement).toHaveClass('text-red-600', 'line-through');
      expect(screen.getByText('Old Name')).toBeInTheDocument();
    });

    it('should render new value in green', () => {
      const diff = buildDiffIndex([
        { op: 'replace', path: '/subtotal', value: 900 }
      ]);

      render(
        <ChangedValue
          path="/subtotal"
          value="$1,350.00"
          diff={diff}
          status="change_requested"
        />
      );

      const insertion = screen.getByRole('insertion');
      expect(insertion.parentElement).toHaveClass('text-green-600');
      expect(screen.getByText('$1,350.00')).toBeInTheDocument();
    });

    it('should show → arrow between old and new', () => {
      const diff = buildDiffIndex([
        { op: 'replace', path: '/vesselWeight', value: 100 }
      ]);

      const { container } = render(
        <ChangedValue
          path="/vesselWeight"
          value="150 tons"
          diff={diff}
          status="change_requested"
        />
      );

      expect(container.textContent).toContain('→');
    });
  });

  describe('Render modes', () => {
    it('should use inline mode by default', () => {
      const diff = buildDiffIndex([
        { op: 'add', path: '/title', value: 'Invoice' }
      ]);

      const { container } = render(
        <ChangedValue
          path="/title"
          value="Invoice"
          diff={diff}
          status="change_requested"
        />
      );

      expect(container.querySelector('.inline-flex')).toBeInTheDocument();
    });

    it('should use block mode when specified', () => {
      const diff = buildDiffIndex([
        { op: 'replace', path: '/notes', value: 'Old notes' }
      ]);

      const { container } = render(
        <ChangedValue
          path="/notes"
          value="New notes"
          diff={diff}
          status="change_requested"
          renderMode="block"
        />
      );

      expect(container.querySelector('.flex-col')).toBeInTheDocument();
    });
  });

  describe('Value formatting', () => {
    it('should handle undefined value gracefully', () => {
      const diff = buildDiffIndex([
        { op: 'remove', path: '/notes', value: undefined }
      ]);

      render(
        <ChangedValue
          path="/notes"
          value="current"
          diff={diff}
          status="change_requested"
        />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('should handle null value gracefully', () => {
      const diff = buildDiffIndex([
        { op: 'remove', path: '/notes', value: null }
      ]);

      render(
        <ChangedValue
          path="/notes"
          value="current"
          diff={diff}
          status="change_requested"
        />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('should stringify object values', () => {
      const diff = buildDiffIndex([
        { op: 'replace', path: '/metadata', value: { old: 'data' } }
      ]);

      render(
        <ChangedValue
          path="/metadata"
          value={{ new: 'data' }}
          diff={diff}
          status="change_requested"
        />
      );

      expect(screen.getByText(/old.*data/)).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const diff = buildDiffIndex([
        { op: 'add', path: '/title', value: 'Test' }
      ]);

      const { container } = render(
        <ChangedValue
          path="/title"
          value="Test"
          diff={diff}
          status="change_requested"
          className="custom-class"
        />
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });
});

describe('AddedValue', () => {
  it('should render with insertion role', () => {
    render(<AddedValue value="New value" />);

    expect(screen.getByRole('insertion')).toBeInTheDocument();
  });

  it('should display the value', () => {
    render(<AddedValue value="Test content" />);

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should have green styling', () => {
    const { container } = render(<AddedValue value="Test" />);

    expect(container.firstChild).toHaveClass('text-green-600', 'font-semibold');
  });
});

describe('RemovedValue', () => {
  it('should render with deletion role', () => {
    render(<RemovedValue value="Old value" />);

    expect(screen.getByRole('deletion')).toBeInTheDocument();
  });

  it('should display the value', () => {
    render(<RemovedValue value="Removed content" />);

    expect(screen.getByText('Removed content')).toBeInTheDocument();
  });

  it('should have red strikethrough styling', () => {
    const { container } = render(<RemovedValue value="Test" />);

    expect(container.firstChild).toHaveClass(
      'text-red-600',
      'font-semibold',
      'line-through'
    );
  });
});

describe('buildDiffIndex', () => {
  it('should create index from patch operations', () => {
    const patch: PatchOperation[] = [
      { op: 'add', path: '/customerName', value: 'John' },
      { op: 'replace', path: '/total', value: 1000 },
    ];

    const index = buildDiffIndex(patch);

    expect(index.size).toBe(2);
    expect(index.has('/customerName')).toBe(true);
    expect(index.has('/total')).toBe(true);
  });

  it('should handle null patch', () => {
    const index = buildDiffIndex(null);

    expect(index.size).toBe(0);
  });

  it('should handle undefined patch', () => {
    const index = buildDiffIndex(undefined);

    expect(index.size).toBe(0);
  });

  it('should handle empty patch array', () => {
    const index = buildDiffIndex([]);

    expect(index.size).toBe(0);
  });
});

describe('getDelta', () => {
  it('should retrieve operation by path', () => {
    const patch: PatchOperation[] = [
      { op: 'replace', path: '/customerName', value: 'John' },
    ];
    const index = buildDiffIndex(patch);

    const delta = getDelta(index, '/customerName');

    expect(delta).toEqual({
      op: 'replace',
      path: '/customerName',
      value: 'John',
    });
  });

  it('should return undefined for missing path', () => {
    const index = buildDiffIndex([]);

    const delta = getDelta(index, '/nonexistent');

    expect(delta).toBeUndefined();
  });
});

describe('hasChangeRequestedStatus', () => {
  it('should return true for change_requested status', () => {
    expect(hasChangeRequestedStatus('change_requested')).toBe(true);
  });

  it('should return false for other statuses', () => {
    expect(hasChangeRequestedStatus('approved')).toBe(false);
    expect(hasChangeRequestedStatus('requested')).toBe(false);
    expect(hasChangeRequestedStatus('draft')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(hasChangeRequestedStatus(undefined)).toBe(false);
  });
});