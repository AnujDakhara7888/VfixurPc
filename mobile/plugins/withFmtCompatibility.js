const { withPodfile } = require('@expo/config-plugins');

// fmt 11.0.2 cannot compile its consteval path with Apple Clang 21.
// Upstream report: https://github.com/expo/expo/issues/44229
module.exports = (config) => withPodfile(config, (result) => {
  const marker = '# VfixurPC: fmt 11.0.2 compatibility';
  if (result.modResults.contents.includes(marker)) return result;
  const anchor = 'post_install do |installer|';
  if (!result.modResults.contents.includes(anchor)) {
    throw new Error('Cannot locate the CocoaPods post-install hook for fmt compatibility.');
  }
  const patch = `
    ${marker}
    fmt_header = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_header)
      original = File.read(fmt_header)
      if original.include?('#define FMT_VERSION 110002')
        patched = original.gsub(/^#\\s*define FMT_USE_CONSTEVAL 1$/, '#  define FMT_USE_CONSTEVAL 0')
        if patched != original
          File.chmod(0644, fmt_header)
          File.write(fmt_header, patched)
        end
      end
    end
`;
  result.modResults.contents = result.modResults.contents.replace(anchor, anchor + patch);
  return result;
});
