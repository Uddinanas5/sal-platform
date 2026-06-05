export type NotificationTemplateVars = Record<string, string | number | null | undefined>

export function renderNotificationTemplate(template: string, vars: NotificationTemplateVars) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = vars[key]
    return value === null || value === undefined ? match : String(value)
  })
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
