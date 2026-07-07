import { expect, test } from '@playwright/test';

test('reporting an incident gets triaged and dispatched live', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Incident Queue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unit Status Board' })).toBeVisible();

  await page.getByRole('button', { name: 'Report Incident' }).click();

  // .first(): a rerun against a warm `wrangler dev` (reuseExistingServer) can carry
  // over a still-open incident from a prior run's Durable Object state.
  const row = page.getByTestId('incident-row').filter({ hasText: 'Visitor Reported Incident' }).first();
  await expect(row).toBeVisible();
  // The 3s alarm tick can beat Playwright's poll to the punch and dispatch the
  // incident before 'pending' is ever observed, so accept either as the
  // starting state and only assert the terminal one with a real timeout.
  await expect(row).toContainText(/pending|dispatched/);
  await expect(row).toContainText('dispatched', { timeout: 20_000 });
});
