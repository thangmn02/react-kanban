import { expect, test } from '@playwright/test';

test('AI planning sends current task context and requires review before saving', async ({ page }) => {
  const steps = ['Tìm mã đơn hàng trong email xác nhận', 'Mở liên kết theo dõi đơn hàng', 'Gửi vị trí kiện hàng cho khách hàng'];
  let received: Record<string, unknown> | undefined;
  await page.route('**/api/task-breakdown', async (route) => {
    received = route.request().postDataJSON();
    await route.fulfill({ json: { steps } });
  });
  await page.goto('/workspaces/local-mock-workspace/boards/local-mock-board');
  await page.getByRole('button', { name: 'Add task', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create task' });
  const title = 'Khách hàng phàn nàn vì giao hàng chậm';
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await dialog.locator('[contenteditable="true"]').fill('Khách đã gửi email. Cần tìm mã đơn hàng trước khi trả lời.');
  await dialog.getByLabel('Due date', { exact: true }).fill('2026-10-10');
  await dialog.getByRole('textbox', { name: 'Label name' }).fill('Giao hàng');
  await dialog.getByRole('button', { name: 'Add label', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Checklist item', exact: true }).fill('Đọc email của khách');
  await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
  await dialog.getByRole('button', { name: 'Suggest steps with AI' }).click();
  await expect(dialog.getByLabel('Step 1', { exact: true })).toHaveValue(steps[0]);
  expect(received).toMatchObject({ workspaceId: 'local-mock-workspace', language: 'en', draftContext: {
    title, description: 'Khách đã gửi email. Cần tìm mã đơn hàng trước khi trả lời.', dueDate: '2026-10-10',
    boardTitle: 'HVAC Editor', columnTitle: 'List 1', labels: ['Giao hàng'], existingSteps: ['Đọc email của khách'],
  } });
  await expect(dialog.locator(`input[value="${steps[0]}"]`)).toHaveCount(0);
  await dialog.getByLabel('Step 1', { exact: true }).fill('Tìm mã đơn hàng trong email mới nhất');
  await dialog.getByRole('button', { name: 'Add to checklist' }).click();
  await expect(dialog.getByText('Steps added to your checklist.')).toBeVisible();
  await expect(dialog.locator('input[value="Tìm mã đơn hàng trong email mới nhất"]')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: `Open task: ${title}`, exact: true }).click();
  await expect(page.locator('input[value="Tìm mã đơn hàng trong email mới nhất"]')).toHaveCount(1);
  await expect(page.locator('input[value="Đọc email của khách"]')).toBeVisible();
});
