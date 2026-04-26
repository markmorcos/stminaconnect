/**
 * RemoveMemberDialog — soft-delete confirmation. Admin-only.
 *
 * UX safeguard: the admin must type the member's full name verbatim
 * for the Confirm button to enable. Match is case-sensitive and
 * whitespace-trimmed. This is the typed-confirmation pattern called
 * out in the design (decision § 8) — soft-delete is irreversible
 * (PII is scrubbed) so a slipped tap must not be enough.
 *
 * This is the *general churn* path. GDPR Article 17 hard-erasure is a
 * separate flow introduced in `add-gdpr-compliance` and must not be
 * conflated.
 */
import { useState } from 'react';
import { Dialog, Portal, Button as PaperButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { Input, Stack, Text, useTokens } from '@/design';

export interface RemoveMemberDialogProps {
  visible: boolean;
  fullName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  busy?: boolean;
}

export function RemoveMemberDialog({
  visible,
  fullName,
  onCancel,
  onConfirm,
  busy = false,
}: RemoveMemberDialogProps) {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const [typed, setTyped] = useState('');

  const matches = typed.trim() === fullName.trim() && fullName.trim().length > 0;

  const reset = () => setTyped('');

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={() => {
          reset();
          onCancel();
        }}
      >
        <Dialog.Title>{t('persons.delete.dialogTitle')}</Dialog.Title>
        <Dialog.Content>
          <Stack gap="sm">
            <Text variant="body">{t('persons.delete.dialogBody', { name: fullName })}</Text>
            <Input
              label={t('persons.delete.typedConfirmPlaceholder', { name: fullName })}
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="words"
              accessibilityLabel={t('persons.delete.typedConfirmA11y', { name: fullName })}
            />
          </Stack>
        </Dialog.Content>
        <Dialog.Actions>
          <PaperButton
            onPress={() => {
              reset();
              onCancel();
            }}
            disabled={busy}
          >
            {t('persons.delete.cancel')}
          </PaperButton>
          <PaperButton
            onPress={async () => {
              await onConfirm();
              reset();
            }}
            disabled={!matches || busy}
            textColor={colors.error}
            loading={busy}
          >
            {t('persons.delete.confirm')}
          </PaperButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
