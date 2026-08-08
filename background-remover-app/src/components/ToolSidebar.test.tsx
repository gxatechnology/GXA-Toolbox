import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolSidebar } from './ToolSidebar';

describe('ToolSidebar', () => {
  it('renders every required editor tool and sends the strict tool id', () => {
    const change = vi.fn();
    render(<ToolSidebar active="auto" onChange={change} />);
    ['Auto', 'Erase', 'Restore', 'Refine Edge', 'Background', 'Crop', 'Adjust', 'Effects', 'Design', 'Layers'].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Restore'));
    expect(change).toHaveBeenCalledWith('restore');
  });
});
