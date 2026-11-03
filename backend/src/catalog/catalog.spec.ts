import { CatalogService } from './catalog.module';
import defaults from './catalog.defaults.json';
import { applyRequirements } from './requirements';
describe('Service catalogue', () => {
  it.each([['data', ['deviceType']], ['backup', ['customerType', 'backupFor', 'dataAmount', 'users']]])('restores required %s questions in saved catalogues', (id, required) => {
    const definition = applyRequirements({ id, fields: [] });
    expect(definition.fields.map(field => field.id)).toEqual(required);
    for (const field of definition.fields) {
      expect(field.required).toBe(true);
      if (field.type === 'select') expect(field.options).toContain('Not sure');
    }
  });
  it('does not let required questions become hidden or numeric-only, and preserves optional custom fields', () => {
    const input = { id: 'backup', fields: [
      { id: 'users', type: 'number', required: false, showWhen: { field: 'x', values: ['y'] } },
      { id: 'custom', type: 'text', label: 'Custom' },
    ] };
    const output = applyRequirements(input);
    expect(output.fields[0]).toMatchObject({ type: 'text', required: true });
    expect(output.fields[0].showWhen).toBeUndefined();
    expect(output.fields[1]).toEqual(input.fields[1]);
    expect(input.fields[0].type).toBe('number');
    expect(applyRequirements(output)).toEqual(output);
  });
  it('contains the 11 owner service flows with different fulfilment modes', () => {
    expect(defaults).toHaveLength(11);
    expect(defaults.find((d) => d.id === 'cctv')?.modes).toEqual(['ON_SITE']);
    expect(
      defaults
        .find((d) => d.id === 'custom')
        ?.fields.find((f) => f.id === 'budget'),
    ).toMatchObject({ required: true, type: 'number' });
    expect(
      defaults.find((d) => d.id === 'mac')?.fields.find((f) => f.id === 'chip'),
    ).toMatchObject({ options: ['Intel', 'Apple Silicon', 'Not sure'] });
  });
  it('allows saved admin definitions to disable or edit a default category', async () => {
    const s = new CatalogService({
      find: async () => [
        { id: 'laptop', definition: { ...defaults[0], enabled: false } },
      ],
    } as any);
    expect((await s.list()).some((d) => d.id === 'laptop')).toBe(false);
    expect((await s.list(true)).some((d) => d.id === 'laptop')).toBe(true);
  });
  it('rejects invalid service modes and malformed questions', async () => {
    const s = new CatalogService({ save: jest.fn() } as any);
    await expect(
      s.save('laptop', { ...defaults[0], modes: ['invalid'] }),
    ).rejects.toThrow();
    await expect(
      s.save('laptop', {
        ...defaults[0],
        fields: [{ id: 'brand', type: 'select', label: 'Brand' }],
      }),
    ).rejects.toThrow();
  });
});
