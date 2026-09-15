import logoUrl from '../../assets/factorial-logo.svg'

// The plugin's settings page is the one place editors see it as a thing in
// its own right, so it is also the only place worth branding. DatoCMS has no
// image field for private plugins — `previewImage`/`coverImage` in
// package.json only apply to Marketplace releases.
const PluginHeader = () => (
  <header
    style={{
      alignItems: 'center',
      borderBottom: '1px solid var(--border-color, #e0e0e0)',
      display: 'flex',
      gap: 'var(--spacing-m, 12px)',
      marginBottom: 'var(--spacing-l, 18px)',
      paddingBottom: 'var(--spacing-m, 12px)'
    }}
  >
    {/*
      The mark is a single brand colour (#FF355E) across every path, so it
      stays legible on both the light and dark DatoCMS themes without needing
      a second asset.
    */}
    <img
      alt='Factorial'
      height={24}
      src={logoUrl}
      style={{ display: 'block', flexShrink: 0 }}
      width={120}
    />
    <p style={{ margin: 0, opacity: 0.7 }}>
      Live preview, form validation and demo landing page checks for the
      Factorial DatoCMS project.
    </p>
  </header>
)

export default PluginHeader
