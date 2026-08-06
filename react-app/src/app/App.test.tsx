import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';

describe('ACC application shell', () => {
  it('renders the header and foundation content', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: 'ACC home' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Personal mode' })).toBeInTheDocument();
    expect(screen.getByText(/existing data remain untouched/i)).toBeInTheDocument();
  });

  it('switches the placeholder between Personal and Work', async () => {
    const user = userEvent.setup();
    render(<App />);

    const personal = screen.getByRole('button', { name: 'Personal' });
    const work = screen.getByRole('button', { name: 'Work' });

    expect(personal).toHaveAttribute('aria-pressed', 'true');
    await user.click(work);

    expect(work).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Work mode' })).toBeInTheDocument();
  });

  it('applies an explicitly selected theme', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
