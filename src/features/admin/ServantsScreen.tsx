/**
 * Admin Servants screen — list every servant (active + deactivated),
 * invite a new one (magic-link via the `invite-servant` Edge Function),
 * and toggle role / active state through the lifecycle RPCs in
 * 028_admin_servant_rpcs.sql. Reached via Settings → Admin → Servants.
 */
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingSkeleton,
  Modal,
  Select,
  Snackbar,
  Stack,
  Text,
  useTokens,
} from '@/design';
import {
  AdminInviteError,
  deactivateServant,
  inviteServant,
  listAllServants,
  reactivateServant,
  updateServantRole,
} from '@/services/api/adminServants';
import type { ServantRow } from '@/services/api/servants';

type Snack = { message: string; tone: 'success' | 'error' } | null;

export function ServantsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [snack, setSnack] = useState<Snack>(null);

  const list = useQuery({
    queryKey: ['admin', 'servants'],
    queryFn: listAllServants,
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['admin', 'servants'] });
  }, [qc]);

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'servant' }) =>
      updateServantRole(id, role),
    onSuccess: () => {
      setSnack({ message: t('admin.servants.successUpdated'), tone: 'success' });
      refresh();
    },
    onError: (e) => setSnack({ message: mapServantError(e, t), tone: 'error' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateServant(id),
    onSuccess: () => {
      setSnack({ message: t('admin.servants.successUpdated'), tone: 'success' });
      refresh();
    },
    onError: (e) => setSnack({ message: mapServantError(e, t), tone: 'error' }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateServant(id),
    onSuccess: () => {
      setSnack({ message: t('admin.servants.successUpdated'), tone: 'success' });
      refresh();
    },
    onError: (e) => setSnack({ message: mapServantError(e, t), tone: 'error' }),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        <Button onPress={() => setInviteOpen(true)} variant="primary">
          {t('admin.servants.invite')}
        </Button>
      </View>

      {list.isLoading ? (
        <Stack gap="sm" padding="lg">
          {Array.from({ length: 5 }, (_, i) => (
            <LoadingSkeleton key={i} height={72} radius="lg" />
          ))}
        </Stack>
      ) : list.isError ? (
        <EmptyState icon="alertCircle" title={t('admin.servants.errors.generic')} />
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState icon="users" title={t('admin.servants.title')} />
      ) : (
        <FlatList
          data={list.data ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
            gap: spacing.sm,
          }}
          renderItem={({ item }) => (
            <ServantRowCard
              servant={item}
              onPromote={() => roleMutation.mutate({ id: item.id, role: 'admin' })}
              onDemote={() => roleMutation.mutate({ id: item.id, role: 'servant' })}
              onDeactivate={() => deactivateMutation.mutate(item.id)}
              onReactivate={() => reactivateMutation.mutate(item.id)}
              busy={
                roleMutation.isPending ||
                deactivateMutation.isPending ||
                reactivateMutation.isPending
              }
            />
          )}
        />
      )}

      <InviteModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => {
          setInviteOpen(false);
          setSnack({ message: t('admin.servants.successInvited'), tone: 'success' });
          refresh();
        }}
        onError={(message) => setSnack({ message, tone: 'error' })}
      />

      <Snackbar visible={snack !== null} onDismiss={() => setSnack(null)} duration={3500}>
        {snack?.message ?? ''}
      </Snackbar>
    </View>
  );
}

function ServantRowCard({
  servant,
  onPromote,
  onDemote,
  onDeactivate,
  onReactivate,
  busy,
}: {
  servant: ServantRow;
  onPromote: () => void;
  onDemote: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const isActive = servant.deactivated_at == null;
  const name = servant.display_name?.trim() || servant.email;
  return (
    <Card padding="md">
      <Stack gap="sm">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyLg" style={{ fontWeight: '600' }}>
              {name}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {servant.email}
            </Text>
          </View>
          <Badge variant={servant.role === 'admin' ? 'priorityHigh' : 'neutral'}>
            {t(
              servant.role === 'admin' ? 'admin.servants.roleAdmin' : 'admin.servants.roleServant',
            )}
          </Badge>
          <Badge variant={isActive ? 'success' : 'warning'}>
            {t(isActive ? 'admin.servants.stateActive' : 'admin.servants.stateDeactivated')}
          </Badge>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {isActive ? (
            <>
              {servant.role === 'servant' ? (
                <Button onPress={onPromote} disabled={busy} variant="secondary">
                  {t('admin.servants.promote')}
                </Button>
              ) : (
                <Button onPress={onDemote} disabled={busy} variant="secondary">
                  {t('admin.servants.demote')}
                </Button>
              )}
              <Button onPress={onDeactivate} disabled={busy} variant="destructive">
                {t('admin.servants.deactivate')}
              </Button>
            </>
          ) : (
            <Button onPress={onReactivate} disabled={busy} variant="secondary">
              {t('admin.servants.reactivate')}
            </Button>
          )}
        </View>
      </Stack>
    </Card>
  );
}

function InviteModal({
  visible,
  onClose,
  onSuccess,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'servant'>('servant');
  const mutation = useMutation({
    mutationFn: () =>
      inviteServant({
        email,
        displayName: displayName || undefined,
        role,
        // Resolved per-runtime: `exp://<lan-ip>:8081/--/auth/callback`
        // in Expo Go, `stminaconnect://auth/callback` in dev/prod
        // builds. Must be allow-listed in `auth.additional_redirect_urls`.
        redirectTo: Linking.createURL('/auth/callback'),
      }),
    onSuccess: () => {
      setEmail('');
      setDisplayName('');
      setRole('servant');
      onSuccess();
    },
    onError: (e) => onError(mapServantError(e, t)),
  });
  return (
    <Modal visible={visible} onDismiss={onClose}>
      <Stack gap="md">
        <Text variant="headingMd">{t('admin.servants.invite')}</Text>
        <Input
          label={t('admin.servants.inviteEmailLabel')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Input
          label={t('admin.servants.inviteDisplayNameLabel')}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <Select
          value={role}
          onChange={(v) => setRole(v as 'admin' | 'servant')}
          options={[
            { value: 'servant', label: t('admin.servants.roleServant') },
            { value: 'admin', label: t('admin.servants.roleAdmin') },
          ]}
          accessibilityLabel={t('admin.servants.inviteRoleLabel')}
        />
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onPress={onClose} disabled={mutation.isPending}>
            {t('admin.servants.inviteCancel')}
          </Button>
          <Button
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={mutation.isPending || email.trim() === ''}
          >
            {t('admin.servants.inviteSubmit')}
          </Button>
        </View>
      </Stack>
    </Modal>
  );
}

function mapServantError(e: unknown, t: TFunction): string {
  if (e instanceof AdminInviteError) {
    switch (e.code) {
      case 'invalid_email':
        return t('admin.servants.errors.invalidEmail');
      case 'already_registered':
        return t('admin.servants.errors.alreadyRegistered');
      default:
        return t('admin.servants.errors.generic');
    }
  }
  const msg = (e as Error)?.message ?? '';
  if (/last active admin/i.test(msg)) return t('admin.servants.errors.lastAdmin');
  if (/own account/i.test(msg)) return t('admin.servants.errors.selfDeactivate');
  return t('admin.servants.errors.generic');
}
