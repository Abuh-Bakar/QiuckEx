import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getBuildMetadata,
  formatEnvironment,
  formatNetwork,
} from '../utils/build-metadata';

/**
 * FE-38 — Contributor preview-environment banner.
 *
 * Shows a persistent banner in every non-production build (preview / testnet /
 * staging / development) so contributors always know which environment they are
 * looking at. The environment name, network and branch are read from the
 * build/environment config (`getBuildMetadata`), so screenshots, bug reports and
 * support threads always carry the right context, and the banner updates
 * whenever the environment changes.
 *
 * Renders nothing in production, so production users never see preview-only
 * messaging.
 */
export function PreviewEnvironmentBanner() {
  const insets = useSafeAreaInsets();
  const meta = getBuildMetadata();

  // Production builds never show preview messaging.
  if (meta.environment === 'production') {
    return null;
  }

  const summary = `${formatEnvironment(meta.environment)} · ${formatNetwork(
    meta.network,
  )}`;
  const branch =
    meta.gitBranch && meta.gitBranch !== 'Unknown' ? meta.gitBranch : null;
  const label = branch ? `${summary} · ${branch}` : summary;

  return (
    <View
      testID="preview-environment-banner"
      accessibilityLabel={`Preview environment: ${label}`}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.content}>
        <Ionicons name="flask" size={16} color={TEXT_COLOR} />
        <Text testID="preview-environment-banner-text" style={styles.text}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// Fixed, high-contrast "preview" colours (amber) so the banner is unmistakable
// regardless of the active theme — it is a build indicator, not themed chrome.
const BACKGROUND_COLOR = '#f59e0b';
const TEXT_COLOR = '#1f2937';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: BACKGROUND_COLOR,
    zIndex: 1000,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 6,
  },
  text: {
    color: TEXT_COLOR,
    fontSize: 13,
    fontWeight: '700',
  },
});
