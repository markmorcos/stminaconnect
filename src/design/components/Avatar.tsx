/**
 * Avatar — initials + deterministic palette color.
 *
 * Sizes: `sm` (32), `md` (40), `lg` (56). Background color is
 * `avatarPalette[fnv1a(id) % 8]`. Initials are the first grapheme of
 * `firstName` plus the first grapheme of `lastName`, Unicode-aware
 * (so Arabic names render their first letter, not nothing).
 *
 * a11y: announces "Avatar for {firstName} {lastName}".
 */
import { View, type ViewStyle } from 'react-native';

import { avatarColorIndex, avatarInitials } from '../avatarHash';
import { useTokens } from '../ThemeProvider';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Stable identifier driving the palette pick (person id, email, etc.). */
  id: string;
  firstName: string;
  lastName?: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const DIMENSIONS: Record<AvatarSize, number> = { sm: 32, md: 40, lg: 56 };
const FONT_SIZE: Record<AvatarSize, number> = { sm: 13, md: 14, lg: 18 };

export function Avatar({ id, firstName, lastName, size = 'md', style }: AvatarProps) {
  const { avatarPalette, colors } = useTokens();
  const dim = DIMENSIONS[size];
  const initials = avatarInitials(firstName, lastName);
  const bg = avatarPalette[avatarColorIndex(id, avatarPalette.length)];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Avatar for ${firstName}${lastName ? ` ${lastName}` : ''}`}
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        color={colors.textInverse}
        style={{ fontSize: FONT_SIZE[size], fontWeight: '600', lineHeight: FONT_SIZE[size] * 1.1 }}
      >
        {initials}
      </Text>
    </View>
  );
}
