export function deliveryFailure(status: number): { blocked: boolean; retry: boolean } {
  if (status === 403) return { blocked: true, retry: false };
  if (status === 429 || status >= 500) return { blocked: false, retry: true };
  return { blocked: false, retry: false };
}

export function shouldAlertAfterRetries(status: number, retried: number): boolean {
  return status >= 500 && Number.isFinite(retried) && retried >= 3;
}
