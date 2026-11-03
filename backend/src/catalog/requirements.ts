import defaults from './catalog.defaults.json';

// Restore mandatory questions even when an older saved catalogue omitted them.
export function applyRequirements(definition: any) {
  const required: Record<string, string[]> = { data: ['deviceType'], backup: ['customerType', 'backupFor', 'dataAmount', 'users'] };
  const fields = [...(definition.fields ?? [])];
  for (const id of required[definition.id] ?? []) {
    if (!fields.some(field => field.id === id)) {
      fields.push(defaults.find(service => service.id === definition.id)!.fields.find(field => field.id === id));
    }
  }
  return { ...definition, fields: fields.map((field: any) => {
    if (!required[definition.id]?.includes(field.id)) return field;
    const canonical = defaults.find(service => service.id === definition.id)!.fields.find(f => f.id === field.id)!;
    const { showWhen, ...visibleField } = field;
    return { ...visibleField, type: canonical.type, required: true,
      ...(canonical.type === 'select'
        ? { options: [...new Set([...(field.options?.length ? field.options : canonical.options ?? []), 'Not sure'])] } : {}),
      ...(field.id === 'users' ? { type: 'text', label: 'Number of users / devices (or Not sure)' } : {}) };
  }) };
}
