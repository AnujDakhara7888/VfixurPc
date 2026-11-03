import { readFileSync } from 'fs';
import { join } from 'path';

// Contract checks only; execute against a staging PostgreSQL snapshot before release.
describe('Targeted FAQ cleanup migration', () => {
  const sql = readFileSync(join(__dirname, '20260914-remove-confirmed-test-faq.sql'), 'utf8');
  it('deletes only the confirmed exact question and archives its full row', () => {
    expect(sql).toContain("DELETE FROM faq_nodes WHERE question = 'Why laptop are good to use' RETURNING *");
    expect(sql).toContain('to_jsonb(removed)');
    expect(sql).not.toMatch(/\b(?:ILIKE|CASCADE|TRUNCATE)\b/i);
  });
  it('aborts ambiguous matches or children and locks against concurrent changes', () => {
    expect(sql).toContain('IF matches > 1');
    expect(sql).toContain('child.parent_id = target.id');
    expect(sql).toContain('LOCK TABLE faq_nodes IN SHARE ROW EXCLUSIVE MODE');
    expect(sql.match(/RAISE EXCEPTION/g)).toHaveLength(2);
  });
});
