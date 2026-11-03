import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';

// Exercise handlers without adding a second frontend test runner. This lightweight
// hook harness is not a substitute for browser/device rendering and navigation QA.
function screen(file: string, imports: Record<string, unknown>, globals = {}) {
  const state: any[] = [];
  let cursor = 0;
  const jsx = (type: any, props: any) => ({ type, props });
  const react = {
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: any) => { state[index] = value; }];
    },
    useRef: (initial: any) => {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
  };
  const output = { exports: {} as any };
  const source = readFileSync(resolve(__dirname, '../../..', file), 'utf8');
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } });
  runInNewContext(outputText, {
    exports: output.exports, module: output,
    require: (name: string) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name in imports) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    process: { env: { NEXT_PUBLIC_API_URL: 'https://test.invalid/api/v1/' } },
    AbortSignal, ...globals,
  });
  return () => { cursor = 0; return output.exports.default({ navigation: { goBack: jest.fn(), navigate: jest.fn() } }); };
}

function find(tree: any, type: string): any {
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.type === type) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child, type);
    if (found) return found;
  }
}

function findAll(tree: any, type: string, matches: any[] = []): any[] {
  if (!tree || typeof tree !== 'object') return matches;
  if (tree.type === type) matches.push(tree);
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) findAll(child, type, matches);
  return matches;
}

describe('Deletion client handlers', () => {
  function mobile(clear = jest.fn().mockResolvedValue(undefined)) {
    const deletion = jest.fn().mockResolvedValue({});
    const alert = jest.fn();
    const render = screen('mobile/src/screens/profile/DeleteAccountScreen.tsx', {
      'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'Link', Alert: { alert } },
      '@/components/LargeHeader': { default: 'Header' },
      '@/components/Input': { default: 'Input' },
      '@/components/Button': { default: 'Button' },
      '@/api/client': { authApi: { deleteAccount: deletion }, clearTokens: clear, getApiErrorMessage: () => 'Incorrect password' },
      'react-native-toast-message': { default: { show: jest.fn() } },
      'expo-notifications': { setBadgeCountAsync: jest.fn().mockResolvedValue(true) },
    });
    find(render(), 'Input').props.onChangeText('secret');
    find(render(), 'Button').props.onPress();
    return { render, deletion, clear, confirm: alert.mock.calls[0][2][1].onPress };
  }

  it('waits for explicit mobile confirmation, then deletes and clears the session', async () => {
    const flow = mobile();
    expect(flow.deletion).not.toHaveBeenCalled();
    await flow.confirm();
    expect(flow.deletion).toHaveBeenCalledWith('secret');
    expect(flow.clear).toHaveBeenCalledTimes(1);
  });

  it('does not log out after failed mobile reauthentication', async () => {
    const flow = mobile();
    flow.deletion.mockRejectedValue(new Error('Incorrect password'));
    await flow.confirm();
    expect(flow.clear).not.toHaveBeenCalled();
    expect(find(flow.render(), 'Button').props.loading).toBe(false);
  });

  it('retries only local logout after successful deletion and a storage failure', async () => {
    const clear = jest.fn().mockRejectedValueOnce(new Error('storage')).mockResolvedValue(undefined);
    const flow = mobile(clear);
    await flow.confirm();
    const button = find(flow.render(), 'Button');
    expect(button.props.label).toBe('Retry signing out');
    await button.props.onPress();
    expect(flow.deletion).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it('ignores duplicate destructive callbacks while a request is pending', async () => {
    const flow = mobile();
    await Promise.all([flow.confirm(), flow.confirm()]);
    expect(flow.deletion).toHaveBeenCalledTimes(1);
  });

  function web() {
    const fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ user: { role: 'CUSTOMER' }, accessToken: 'isolated-token' }) })
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    const render = screen('admin/src/app/account-deletion/page.tsx', {}, { fetch });
    const inputs = findAll(render(), 'input');
    for (const [index, value] of ['customer', 'secret', 'DELETE'].entries()) {
      inputs[index].props.onChange({ target: { value } });
    }
    return { fetch, render, submit: () => find(render(), 'form').props.onSubmit({ preventDefault() {} }) };
  }

  it('uses isolated web auth and the configured versioned API URL, without cookies or refresh', async () => {
    const flow = web();
    await flow.submit();
    expect(flow.fetch).toHaveBeenCalledTimes(2);
    expect(flow.fetch.mock.calls[0][0]).toBe('https://test.invalid/api/v1/auth/login');
    const [url, options] = flow.fetch.mock.calls[1];
    expect(url).toBe('https://test.invalid/api/v1/auth/account');
    expect(options.method).toBe('DELETE');
    expect(options.headers.Authorization).toBe('Bearer isolated-token');
    expect(JSON.parse(options.body)).toEqual({ password: 'secret', confirmation: 'DELETE' });
    for (const [, opts] of flow.fetch.mock.calls) expect(opts.credentials).toBe('omit');
    expect(find(flow.render(), 'form')).toBeUndefined();
  });

  it('does not delete after an unsuccessful web login or refresh a 401', async () => {
    const flow = web();
    flow.fetch.mockReset().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Invalid credentials' }) });
    await flow.submit();
    expect(flow.fetch).toHaveBeenCalledTimes(1);
    expect(find(flow.render(), 'form')).toBeDefined();
  });

  it('verifies the email OTP before deleting a customer account on the web', async () => {
    const flow = web();
    flow.fetch.mockReset()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ requiresOtp: true, challengeId: 'challenge-id', maskedEmail: 'cu***@example.com' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { role: 'CUSTOMER' }, accessToken: 'verified-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await flow.submit();
    const inputs = findAll(flow.render(), 'input');
    inputs[2].props.onChange({ target: { value: '123456' } });
    await flow.submit();

    expect(flow.fetch.mock.calls.map(call => call[0])).toEqual([
      'https://test.invalid/api/v1/auth/login',
      'https://test.invalid/api/v1/auth/login/verify-otp',
      'https://test.invalid/api/v1/auth/account',
    ]);
    expect(JSON.parse(flow.fetch.mock.calls[1][1].body)).toEqual({ challengeId: 'challenge-id', code: '123456' });
    expect(flow.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer verified-token');
  });
});
