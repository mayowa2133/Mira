import { memo } from 'react';
import { type ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Mira's icons (`docs/02-design/design-system.md` §6 — Icons).
 *
 * > Thin line icons, 1.5px stroke, 24×24 default. No filled icons except the
 * > favourite heart in its active state and the active tab indicator.
 *
 * Drawn here rather than pulled from an icon library on purpose. Every general
 * set carries a house accent — Material's geometry reads Android, SF Symbols
 * read iOS system app — and the closet grid is the one surface where the
 * chrome has to disappear behind the clothing.
 *
 * The `hanger`, `looks` and `mira` glyphs are wardrobe-specific and do not
 * exist in any general set, which is the other reason.
 */
export type IconName =
  | 'home'
  | 'hanger'
  | 'mira'
  | 'looks'
  | 'person'
  | 'heart'
  | 'close'
  | 'filter'
  | 'plus'
  | 'chevronRight'
  | 'chevronLeft'
  | 'check'
  | 'search'
  | 'mail'
  | 'receipt'
  | 'camera'
  | 'tag'
  | 'link'
  | 'image'
  | 'pencil';

export type IconProps = {
  name: IconName;
  /** 24 by default (§6). */
  size?: number;
  color: ColorValue;
  /**
   * Only the favourite heart and the active tab may be filled (§6). Passing
   * this on anything else is a design bug, not a styling choice.
   *
   * Every fillable glyph is drawn as a closed path so this reads as a solid
   * shape rather than as a wedge between the ends of an open stroke. `person`
   * is the one to watch: its body is an arc, and filling it closes the chord —
   * which is what a filled person icon looks like, but only by luck, so do not
   * reopen that path.
   */
  filled?: boolean;
};

/**
 * 1.5 at 24pt, scaled proportionally.
 *
 * A fixed 1.5 would thicken visibly at 20pt and disappear at 32pt; the ratio is
 * what keeps a row of icons at mixed sizes looking like one set.
 */
const strokeFor = (size: number): number => (1.5 * size) / 24;

function IconComponent({ name, size = 24, color, filled = false }: IconProps) {
  const stroke = strokeFor(size);
  // Every path is authored in a 24×24 box and scaled by the viewBox, so the
  // geometry below can be read against the spec without arithmetic.
  const common = {
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: filled ? color : ('none' as const),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {name === 'home' ? (
        <Path d="M3.5 10.2 12 3.75l8.5 6.45V19a1.25 1.25 0 0 1-1.25 1.25h-14A1.25 1.25 0 0 1 4 19v-8.8Z" {...common} />
      ) : null}

      {/* A hanger, not a folder or a shirt: the closet is a rail. */}
      {name === 'hanger' ? (
        <>
          <Path d="M12 8.5a2 2 0 1 1 2-2c0 1.2-2 1.1-2 2Z" {...common} />
          <Path d="M12 8.5 3.6 15.1a1.1 1.1 0 0 0 .7 2h15.4a1.1 1.1 0 0 0 .7-2L12 8.5Z" {...common} />
        </>
      ) : null}

      {/* A mirror, which is what Mira is — never a sparkle or a chat bubble
          (design-system.md §9, D-010). */}
      {name === 'mira' ? (
        <>
          <Circle cx={12} cy={11} r={6.75} {...common} />
          <Path d="M12 17.75V21M9 21h6" {...common} />
        </>
      ) : null}

      {name === 'looks' ? (
        <>
          <Path d="M4 4.75h6.5v6.5H4zM13.5 4.75H20v6.5h-6.5zM4 12.75h6.5v6.5H4zM13.5 12.75H20v6.5h-6.5z" {...common} />
        </>
      ) : null}

      {name === 'person' ? (
        <>
          <Circle cx={12} cy={8.25} r={3.75} {...common} />
          <Path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" {...common} />
        </>
      ) : null}

      {name === 'heart' ? (
        <Path
          d="M12 20.25s-7.75-4.6-7.75-10a4.4 4.4 0 0 1 7.75-2.85A4.4 4.4 0 0 1 19.75 10c0 5.4-7.75 10.25-7.75 10.25Z"
          {...common}
        />
      ) : null}

      {name === 'close' ? <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...common} /> : null}

      {name === 'filter' ? (
        <Path d="M4.25 7h15.5M7 12h10M10 17h4" {...common} />
      ) : null}

      {name === 'plus' ? <Path d="M12 5.25v13.5M5.25 12h13.5" {...common} /> : null}

      {name === 'chevronRight' ? <Path d="M9.5 5.5 16 12l-6.5 6.5" {...common} /> : null}

      {name === 'chevronLeft' ? <Path d="M14.5 5.5 8 12l6.5 6.5" {...common} /> : null}

      {name === 'check' ? <Path d="m5 12.5 4.5 4.5L19 7" {...common} /> : null}

      {name === 'search' ? (
        <>
          <Circle cx={11} cy={11} r={6.25} {...common} />
          <Path d="M15.6 15.6 20 20" {...common} />
        </>
      ) : null}

      {name === 'mail' ? (
        <>
          <Path d="M3.75 6.25h16.5v11.5H3.75z" {...common} />
          <Path d="m3.75 7 8.25 6 8.25-6" {...common} />
        </>
      ) : null}

      {name === 'receipt' ? (
        <>
          <Path d="M5.75 3.75h12.5v16.5l-2.1-1.5-2.1 1.5-2.1-1.5-2.1 1.5-2.1-1.5-2 1.5z" {...common} />
          <Path d="M9 8h6M9 11.5h6" {...common} />
        </>
      ) : null}

      {name === 'camera' ? (
        <>
          <Path d="M3.75 8.25h3.5l1.5-2h6.5l1.5 2h3.5v10.5H3.75z" {...common} />
          <Circle cx={12} cy={13.25} r={3.25} {...common} />
        </>
      ) : null}

      {name === 'tag' ? (
        <>
          <Path d="M11.4 3.75H20.25v8.85l-8.4 8.4a1.2 1.2 0 0 1-1.7 0L3 13.85a1.2 1.2 0 0 1 0-1.7z" {...common} />
          <Circle cx={16.25} cy={7.75} r={1.4} {...common} />
        </>
      ) : null}

      {name === 'image' ? (
        <>
          <Path d="M3.75 4.75h16.5v14.5H3.75z" {...common} />
          <Path d="m3.75 16 4.5-4.5 3.75 3.75 3-3 5.25 5.25" {...common} />
          <Circle cx={9} cy={9} r={1.5} {...common} />
        </>
      ) : null}

      {name === 'pencil' ? (
        <>
          <Path d="M16.5 3.9a1.9 1.9 0 0 1 2.7 2.7L8.4 17.4l-3.6.9.9-3.6z" {...common} />
          <Path d="m14.6 5.8 3.6 3.6" {...common} />
        </>
      ) : null}

      {name === 'link' ? (
        <>
          <Path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.3 1.3" {...common} />
          <Path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.3-1.3" {...common} />
        </>
      ) : null}
    </Svg>
  );
}

export const Icon = memo(IconComponent);
