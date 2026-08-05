/**
 * Material Icons glyph. Names match `@expo/vector-icons`' MaterialIcons set
 * used in the Expo app, so screens port across without renaming icons.
 *
 * Icon names with an `-outline` or `_outline` suffix are automatically
 * rendered using the "Material Icons Outlined" font so the correct glyph
 * appears without callers needing to know about the font variant.
 */
export function Icon({
  name,
  size = 24,
  color,
  className,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  // Normalise hyphens → underscores (Material Icons uses underscores).
  const normalised = name.replace(/-/g, '_');
  // Outlined variants live in a separate font class.
  const isOutlined = normalised.endsWith('_outline') || normalised.endsWith('_outlined');
  const fontClass = isOutlined ? 'material-icons-outlined' : 'material-icons';
  // Strip the suffix so the ligature lookup hits the right glyph name.
  const ligature = isOutlined
    ? normalised.replace(/_outlined?$/, '')
    : normalised;

  return (
    <span
      className={`${fontClass}${className ? ` ${className}` : ''}`}
      style={{ fontSize: size, color }}
      aria-hidden="true"
    >
      {ligature}
    </span>
  );
}
