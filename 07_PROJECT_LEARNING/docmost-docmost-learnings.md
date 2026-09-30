# Forensic Learning Record (Deep Inspection): docmost/docmost

> **Canonical Artifact**: `07_PROJECT_LEARNING/docmost-docmost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/docmost/docmost](https://github.com/docmost/docmost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:30.302Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `docmost/docmost`
- **Description**: Docmost is an open-source collaborative wiki and documentation software. It is an open-source alternative to Confluence and Notion.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 21832 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/client/eslint.config.mjs`
```
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import pluginQuery from "@tanstack/eslint-plugin-query";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@tanstack/query": pluginQuery,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-useless-escape": "off",
    },
  },
);

```

### Core Architecture Module: `apps/client/postcss.config.js`
```
module.exports = {
  plugins: {
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em",
      },
    },
  },
};

```

### Core Architecture Module: `apps/client/src/App.tsx`
```
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/layouts/global/layout.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import { isCloud } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import { useRedirectToCloudSelect } from "@/ee/hooks/use-redirect-to-cloud-select.tsx";
import { useTrackOrigin } from "@/hooks/use-track-origin";


const SetupWorkspace = lazy(() => import("@/pages/auth/setup-workspace.tsx"));
const LoginPage = lazy(() => import("@/pages/auth/login"));
const Home = lazy(() => import("@/pages/dashboard/home"));
const Page = lazy(() => import("@/pages/page/page"));
const AccountSettings = lazy(
  () => import("@/pages/settings/account/account-settings"),
);
const WorkspaceMembers = lazy(
  () => import("@/pages/settings/workspace/workspace-members"),
);
const WorkspaceSettings = lazy(
  () => import("@/pages/settings/workspace/workspace-settings"),
);
const Groups = lazy(() => import("@/pages/settings/group/groups"));
const GroupInfo = lazy(() => import("./pages/settings/group/group-info"));
const Spaces = lazy(() => import("@/pages/settings/space/spaces.tsx"));
const AccountPreferences = lazy(
  () => import("@/pages/settings/account/account-preferences.tsx"),
);
const SpaceHome = lazy(() => import("@/pages/space/space-home.tsx"));
const PageRedirect = lazy(() => import("@/pages/page/page-redirect.tsx"));
const InviteSignup = lazy(() => import("@/pages/auth/invite-signup.tsx"));
const ForgotPassword = lazy(() => import("@/pages/auth/forgot-password.tsx"));
const PasswordReset = lazy(() => import("./pages/auth/password-reset"));
const Billing = lazy(() => import("@/ee/billing/pages/billing.tsx"));
const CloudLogin = lazy(() => import("@/ee/pages/cloud-login.tsx"));
const CreateWorkspace = lazy(() => import("@/ee/pages/create-workspace.tsx"));
const Security = lazy(() => import("@/ee/security/pages/security.tsx"));
const License = lazy(() => import("@/ee/licence/pages/license.tsx"));
const SharedPage = lazy(() => import("@/pages/share/shared-page.tsx"));
const PdfRenderPage = lazy(() => import("@/ee/pdf-export/pdf-render-page.tsx"));
const Shares = lazy(() => import("@/pages/settings/shares/shares.tsx"));
const ShareLayout = lazy(
  () => import("@/features/share/components/share-layout.tsx"),
);
const ShareRedirect = lazy(() => import("@/pages/share/share-redirect.tsx"));
const PublicSpacePage = lazy(
  () => import("@/pages/public-space/public-space-page.tsx"),
);
const PublicSpaceLayout = lazy(
  () => import("@/features/public-space/components/public-space-layout.tsx"),
);
const PublicSpaceDirectoryPage = lazy(
  () => import("@/pages/public-space/public-space-directory-page.tsx"),
);
const SpacesPage = lazy(() => import("@/pages/spaces/spaces.tsx"));
const MfaChallengePage = lazy(() =>
  import("@/ee/mfa/pages/mfa-challenge-page").then((m) => ({
    default: m.MfaChallengePage,
  })),
);
const MfaSetupRequiredPage = lazy(() =>
  import("@/ee/mfa/pages/mfa-setup-required-page").then((m) => ({
    default: m.MfaSetupRequiredPage,
  })),
);
const SpaceTrash = lazy(() => import("@/pages/space/space-trash.tsx"));
const UserApiKeys = lazy(() => import("@/ee/api-key/pages/user-api-keys"));
const WorkspaceApiKeys = lazy(
  () => import("@/ee/api-key/pages/workspace-api-keys"),
);
const AiSettings = lazy(() => import("@/ee/ai/pages/ai-settings.tsx"));
const BasePage = lazy(() => import("@/ee/base/pages/base-page.tsx"));
const AuditLogs = lazy(() => import("@/ee/audit/pages/audit-logs.tsx"));
const VerifiedPages = lazy(
  () => import("@/ee/page-verification/pages/verified-pages.tsx"),
);
const TemplateList = lazy(() => import("@/ee/template/pages/template-list"));
const TemplateEditor = lazy(
  () => import("@/ee/template/pages/template-editor"),
);
const FavoritesPage = lazy(() => import("@/pages/favorites/favorites-page"));
const AiChat = lazy(() => import("@/ee/ai-chat/pages/ai-chat.tsx"));
const VerifyEmail = lazy(() => import("@/ee/pages/verify-email.tsx"));
const LabelPage = lazy(() => import("@/pages/label/label-page"));
const OAuthConsent = lazy(() => import("@/ee/oauth/pages/oauth-consent.tsx"));

export default function App() {
  const { t } = useTranslation();
  useRedirectToCloudSelect();
  useTrackOrigin();

  useEffect(() => {
    // warm the editor chunk so opening a page doesn't wait on the network
    const timer = setTimeout(() => import("@/pages/page/page"), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route index element={<Navigate to="/home" />} />
        <Route path={"/login"} element={<LoginPage />} />
        <Route path={"/invites/:invitationId"} element={<InviteSignup />} />
        <Route path={"/forgot-password"} element={<ForgotPassword />} />
        <Route path={"/password-reset"} element={<PasswordReset />} />
        <Route path={"/login/mfa"} element={<MfaChallengePage />} />
        <Route path={"/login/mfa/setup"} element={<MfaSetupRequiredPage />} />
        <Route path={"/oauth/consent"} element={<OAuthConsent />} />

        {!isCloud() && (
          <Route path={"/setup/register"} element={<SetupWorkspace />} />
        )}

        {isCloud() && (
          <>
            <Route path={"/create"} element={<CreateWorkspace />} />
            <Route path={"/select"} element={<CloudLogin />} />
            <Route path={"/verify-email"} element={<VerifyEmail />} />
          </>
        )}

        <Route element={<ShareLayout />}>
          <Route
            path={"/share/:shareId/p/:pageSlug"}
            element={<SharedPage />}
          />
          <Route path={"/share/p/:pageSlug"} element={<SharedPage />} />
        </Route>

        <Route path={"/docs"} element={<PublicSpaceDirectoryPage />} />
        <Route element={<PublicSpaceLayout />}>
          <Route path={"/docs/:spaceSlug"} element={<PublicSpacePage />} />
          <Route
            path={"/docs/:spaceSlug/:pageSlug"}
            element={<PublicSpacePage />}
          />
        </Route>

        <Route path={"/pdf-render/:pageId"} element={<PdfRenderPage />} />
        <Route path={"/share/:shareId"} element={<ShareRedirect />} />
        <Route path={"/p/:pageSlug"} element={<PageRedirect />} />

        <Route element={<Layout />}>
          <Route path={"/home"} element={<Home />} />
          <Route path={"/ai"} element={<AiChat />} />
          <Route path={"/ai/chat/:chatId"} element={<AiChat />} />
          <Route path={"/spaces"} element={<SpacesPage />} />
          <Route path={"/favorites"} element={<FavoritesPage />} />
          <Route path={"/labels/:labelName"} element={<LabelPage />} />
          <Route path={"/templates"} element={<TemplateList />} />
          <Route
            path={"/templates/:templateId"}
            element={<TemplateEditor />}
          />
          <Route path={"/s/:spaceSlug"} element={<SpaceHome />} />
          <Route path={"/s/:spaceSlug/trash"} element={<SpaceTrash />} />
          <Route
            path={"/s/:spaceSlug/p/:pageSlug"}
            element={<Page />}
          />

          <Route path={"/base/:pageId"} element={<BasePage />} />

          <Route path={"/settings"}>
            <Route path={"account/profile"} element={<AccountSettings />} />
            <Route
              path={"account/preferences"}
              element={<AccountPreferences />}
            />
            <Route path={"account/api-keys"} element={<UserApiKeys />} />
            <Route
              path={"account/api-keys/authorized-apps"}
              element={<UserApiKeys />}
            />
            <Route path={"workspace"} element={<WorkspaceSettings />} />
            <Route path={"members"} element={<WorkspaceMembers />} />
            <Route path={"api-keys"} element={<WorkspaceApiKeys />} />
            <Route path={"groups"} element={<Groups />} />
            <Route path={"
```

### Core Architecture Module: `apps/client/src/components/common/avatar-uploader.tsx`
```
import React, { useRef } from "react";
import { Menu, Box, Loader } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IconTrash, IconUpload } from "@tabler/icons-react";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { notifications } from "@mantine/notifications";

interface AvatarUploaderProps {
  currentImageUrl?: string | null;
  fallbackName?: string;
  radius?: string | number;
  size?: string | number;
  variant?: string;
  type: AvatarIconType;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function AvatarUploader({
  currentImageUrl,
  fallbackName,
  radius,
  variant,
  size,
  type,
  onUpload,
  onRemove,
  isLoading = false,
  disabled = false,
}: AvatarUploaderProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || disabled) {
      return;
    }

    // Validate file size (max 10MB)
    const maxSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      notifications.show({
        message: t("Image exceeds 10MB limit."),
        color: "red",
      });
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    try {
      await onUpload(file);
    } catch (error) {
      console.error(error);
      notifications.show({
        message: t("Failed to upload image"),
        color: "red",
      });
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("File input ref is null!");
    }
  };

  const actionLabel = {
    [AvatarIconType.AVATAR]: t("Change avatar"),
    [AvatarIconType.SPACE_ICON]: t("Change space icon"),
    [AvatarIconType.WORKSPACE_ICON]: t("Change workspace icon"),
  }[type];

  // Per WCAG 2.5.3 (Label in Name), the accessible name must include the
  // visible text. When no image is set, the avatar renders the name's
  // initials, so prepend the name to the action label.
  const ariaLabel =
    !currentImageUrl && fallbackName
      ? `${fallbackName} – ${actionLabel}`
      : actionLabel;

  const handleRemove = async () => {
    if (disabled) return;

    try {
      await onRemove();
      notifications.show({
        message: t("Image removed successfully"),
      });
    } catch (error) {
      console.error(error);
      notifications.show({
        message: t("Failed to remove image"),
        color: "red",
      });
    }
  };

  return (
    <Box>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/jpg"
        aria-label={ariaLabel}
        tabIndex={-1}
        style={{ display: "none" }}
      />

      <Menu shadow="md" width={200} withArrow disabled={disabled || isLoading}>
        <Menu.Target>
          <Box style={{ position: "relative", display: "inline-block" }}>
            <CustomAvatar
              component="button"
              size={size}
              avatarUrl={currentImageUrl}
              name={fallbackName}
              aria-label={ariaLabel}
              aria-haspopup="menu"
              style={{
                cursor: disabled || isLoading ? "default" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              }}
              radius={radius}
              variant={variant}
              type={type}
            />
            {isLoading && (
              <Box
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 200,
                }}
              >
                <Loader size="sm" />
              </Box>
            )}
          </Box>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconUpload size={16} />}
            disabled={isLoading || disabled}
            onClick={handleUploadClick}
          >
            {t("Upload image")}
          </Menu.Item>

          {currentImageUrl && (
            <Menu.Item
              leftSection={<IconTrash size={16} />}
              color="red"
              onClick={handleRemove}
              disabled={isLoading || disabled}
            >
              {t("Remove image")}
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
}

```

### Core Architecture Module: `apps/client/src/components/common/copy-button.tsx`
```
// Source: https://github.com/mantinedev/mantine/blob/master/packages/@mantine/core/src/components/CopyButton/CopyButton.tsx - MIT
// modified to use the polyfilled clipboard api
import React from "react";
import { useClipboard } from "@/hooks/use-clipboard";
import { useProps } from "@mantine/core";

interface CopyButtonProps {
  /** Children callback, provides current status and copy function as an argument */
  children: (payload: { copied: boolean; copy: () => void }) => React.ReactNode;

  /** Value that is copied to the clipboard when the button is clicked */
  value: string;

  /** Copied status timeout in ms @default `1000` */
  timeout?: number;
}

const defaultProps = {
  timeout: 1000,
} satisfies Partial<CopyButtonProps>;

export function CopyButton(props: CopyButtonProps) {
  const { children, timeout, value, ...others } = useProps(
    "CopyButton",
    defaultProps,
    props,
  );
  const clipboard = useClipboard({ timeout });
  const copy = () => clipboard.copy(value);
  return <>{children({ copy, copied: clipboard.copied, ...others })}</>;
}

CopyButton.displayName = "@mantine/core/CopyButton";

```

### Core Architecture Module: `apps/client/src/components/common/copy.tsx`
```
import { ActionIcon, MantineColor, MantineSize, Tooltip } from "@mantine/core";
import { CopyButton } from "@/components/common/copy-button";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import React from "react";
import { useTranslation } from "react-i18next";

interface CopyProps {
  text: string;
  size?: MantineSize;
  color?: MantineColor;
  /** Override the accessible name (and tooltip) when not yet copied. Lets callers disambiguate adjacent copy buttons for screen readers. */
  label?: string;
}
export default function CopyTextButton({ text, size, label }: CopyProps) {
  const { t } = useTranslation();

  const copyLabel = label ?? t("Copy");

  return (
    <CopyButton value={text} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip
          label={copied ? t("Copied") : copyLabel}
          withArrow
          position="right"
        >
          <ActionIcon
            color={copied ? "teal" : "gray"}
            variant="subtle"
            onClick={copy}
            size={size}
            aria-label={copied ? t("Copied") : copyLabel}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

```

### Core Architecture Module: `apps/client/src/components/common/export-modal.tsx`
```
import {
  Modal,
  Button,
  Group,
  Text,
  Select,
  Switch,
  Divider,
  Tooltip,
  Badge,
} from "@mantine/core";
import {
  exportPage,
  exportPageToDocx,
} from "@/features/page/services/page-service.ts";
import { useState } from "react";
import { ExportFormat } from "@/features/page/types/page.types.ts";
import { notifications } from "@mantine/notifications";
import { exportSpace } from "@/features/space/services/space-service";
import { useTranslation } from "react-i18next";
import { Feature } from "@/ee/features";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";

interface ExportModalProps {
  id: string;
  type: "space" | "page";
  open: boolean;
  onClose: () => void;
}

export default function ExportModal({
  id,
  type,
  open,
  onClose,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.Markdown);
  const [includeChildren, setIncludeChildren] = useState<boolean>(false);
  const [includeAttachments, setIncludeAttachments] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const { t } = useTranslation();
  const upgradeLabel = useUpgradeLabel();
  const isDocx = format === ExportFormat.Docx;
  const docxEntitled = useHasFeature(Feature.DOCX_EXPORT);
  const blockedByLicense = isDocx && !docxEntitled;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (type === "page") {
        if (format === ExportFormat.Docx) {
          await exportPageToDocx({ pageId: id });
        } else {
          await exportPage({
            pageId: id,
            format,
            includeChildren,
            includeAttachments,
          });
        }
      }
      if (type === "space") {
        await exportSpace({ spaceId: id, format, includeAttachments });
      }
      notifications.show({
        message: t("Export successful"),
      });
      onClose();
    } catch (err) {
      notifications.show({
        message: "Export failed:" + err.response?.data.message,
        color: "red",
      });
      console.error("export error", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleChange = (format: ExportFormat) => {
    setFormat(format);
  };

  return (
    <Modal.Root
      opened={open}
      onClose={onClose}
      size={500}
      padding="xl"
      yOffset="10vh"
      xOffset={0}
      mah={400}
      onClick={(e) => e.stopPropagation()}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>{t(`Export ${type}`)}</Modal.Title>
          <Modal.CloseButton aria-label={t("Close")} />
        </Modal.Header>
        <Modal.Body>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="md">{t("Format")}</Text>
            </div>
            <ExportFormatSelection
              format={format}
              onChange={handleChange}
              includeDocx={type === "page"}
              docxEntitled={docxEntitled}
            />
          </Group>

          {type === "page" && !isDocx && (
            <>
              <Divider my="sm" />

              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text size="md">{t("Include subpages")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeChildren(event.currentTarget.checked)
                  }
                  checked={includeChildren}
                />
              </Group>

              <Group justify="space-between" wrap="nowrap" mt="md">
                <div>
                  <Text size="md">{t("Include attachments")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeAttachments(event.currentTarget.checked)
                  }
                  checked={includeAttachments}
                />
              </Group>
            </>
          )}

          {type === "space" && (
            <>
              <Divider my="sm" />

              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text size="md">{t("Include attachments")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeAttachments(event.currentTarget.checked)
                  }
                  checked={includeAttachments}
                />
              </Group>
            </>
          )}

          <Group justify="center" mt="md">
            <Button onClick={onClose} variant="default">
              {t("Cancel")}
            </Button>
            <Tooltip label={upgradeLabel} disabled={!blockedByLicense} withArrow>
              <Button
                onClick={handleExport}
                loading={isExporting}
                disabled={blockedByLicense}
                data-disabled={blockedByLicense || undefined}
              >
                {t("Export")}
              </Button>
            </Tooltip>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

interface ExportFormatSelection {
  format: ExportFormat;
  onChange: (value: string) => void;
  includeDocx?: boolean;
  docxEntitled?: boolean;
}
function ExportFormatSelection({
  format,
  onChange,
  includeDocx,
  docxEntitled,
}: ExportFormatSelection) {
  const { t } = useTranslation();

  const data = [
    { value: "markdown", label: "Markdown" },
    { value: "html", label: "HTML" },
    ...(includeDocx
      ? [{ value: "docx", label: "Word (.docx)", disabled: !docxEntitled }]
      : []),
  ];

  return (
    <Select
      data={data}
      defaultValue={format}
      onChange={onChange}
      styles={{ wrapper: { maxWidth: 140 }, option: { opacity: 1 } }}
      comboboxProps={{ width: 200 }}
      allowDeselect={false}
      withCheckIcon={false}
      aria-label={t("Select export format")}
      renderOption={({ option }) =>
        option.value === "docx" && !docxEntitled ? (
          <div>
            <Text size="sm" c="dimmed">
              {option.label}
            </Text>
            <Badge size="xs" mt={4}>
              {t("Enterprise")}
            </Badge>
          </div>
        ) : (
          <Text size="sm">{option.label}</Text>
        )
      }
    />
  );
}

```

### Core Architecture Module: `apps/client/src/components/common/no-table-results.tsx`
```
import { Table, Text } from "@mantine/core";
import React from "react";
import { useTranslation } from "react-i18next";

interface NoTableResultsProps {
  colSpan: number;
  text?: string;
}
export default function NoTableResults({ colSpan, text }: NoTableResultsProps) {
  const { t } = useTranslation();
  return (
    <Table.Tr>
      <Table.Td colSpan={colSpan}>
        <Text fw={500} c="dimmed" ta="center">
          {text || t("No results found...")}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2414** (2026-08-23): **Bug: filter for unchecked checkboxes in base**
  *Symptoms*: ### Describe the bug  When I create a filter in a base table on a field of type checkbox. The filter should filter all rows where the checkbox is unset.  It simply does not work: all rows with an unset checkbox get nevertheless removed by the filter.  ### Steps to reproduce the behaviour  * a table with a field "Done" of type checkbox * create a new filter ... * select field "Done" * select comparison type "Is" * select value "false" * ISSUE: result is empty although a number of datasets with an unchecked Done field exist * OK filter by "true" results in the expected   ### Expected behaviour  Allow a filter for unset checkboxes.  ### Screenshots / screencast  https://github.com/user-attachments/assets/ddc113a8-e147-419b-a6af-ea6031340d7b  ### Context * DocMost Version: v0.95.0 * Browser: firefox 154  

- **Issue #2407** (2026-08-25): **Multi-select behaviour in filters (usability)**
  *Symptoms*: If I create a new filter based on a select-field and I chose either “Is any of“ or “Is none of“, I cannot select multiple values, but it seems that I have to add multiple filter lines of the same type (which needs a quite complicated interaction, because you have to save the filter in between every time).  ### Proposed change  Allow multi-select within the same filter-rule (checkbox, CTRL-select, comma-separated …)

- **Issue #2401** (2026-08-25): **Subpages list shows "No subpages" on first load in public share view**
  *Symptoms*: When opening a publicly shared page (/share/{shareId}/p/{pageSlug}) that has  subpages, the "Subpages" block within the page body incorrectly shows  "No subpages" on initial load — even though the subpages exist and are  correctly listed in the sidebar tree at the same time.  A manual page refresh immediately fixes the display, showing the correct  list of subpages with their icons and titles.  Steps to reproduce: 1. Create a page with at least one subpage 2. Enable public sharing for the parent page 3. Open the share URL fresh (new tab / first load) 4. Observe: the sidebar tree shows subpages correctly, but the in-body     "Subpages" block shows "No subpages" 5. Refresh the page — the subpages block now displays correctly  Environment: - Reproduced on Docmost v0.90.1 and v0.95.0 - Reproduced on Firefox and Safari (rules out browser-specific cache/cookie    issues)  Expected behavior: The in-body subpages block should reflect the same data as the sidebar on  first load, without requiring a manual refresh.

- **Issue #2399** (2026-08-26): **Escaped brackets \[ before adjacent inline Markdown links get corrupted after HTML export → import round-trip**
  *Symptoms*: ## Description  When a Docmost page contains a sequence of short adjacent Markdown links wrapped in escaped literal brackets — a common pattern for citation-style references, e.g. generated by an AI assistant — the content renders correctly after initial paste, but becomes corrupted after an HTML export → import round-trip (into a different space, and/or a different Docmost instance).  ## Exact source Markdown that reproduces the issue  (extracted via Docmost's own Markdown export of the *original*, still-correct page):  ```markdown ... et qu'**Authentik** agit comme une suite d'identité complète et avancée\. \[[1](https://www.reddit.com/r/selfhosted/comments/1lxodhq/authentik_vs_pocketid_your_opinion_and_experience/?tl=fr), [2](https://www.youtube.com/watch?v=nMHK_rCqDJs&t=31), [3](https://www.youtube.com/watch?v=nm3Oe1TOsaM), [4](https://www.cerbos.dev/blog/authelia-vs-authentik-2026-idp)\] ```  Note the structure: a literal escaped opening bracket `\[`, immediately followed by several `[n](url)` links separated by `, `, closed by a literal escaped `\]`. This pattern repeats multiple times in the same document (once per paragraph/bullet), each with its own set of 1–5 links.  ## Steps to reproduce  1. Paste the above Markdown snippet into a Docmost page (paste-as-Markdown). 2. Confirm it renders correctly: literal `[` then clickable `1`, `2`, `3`, `4` (each linking to its respective URL), separated by commas, then literal `]`. 3. Export the page (or its parent space) as **HT

- **Issue #2340** (2026-08-03): **Users can give themselves edit permission**
  *Symptoms*: Hello,  I have restricted the edit permissions of a page to only myself, and given view permission to a group of users. The users with view permission on that page can still grant themselves edit permission, if they have general edit permissions in that space. And they can even remove my own edit permission on the page. I think this is a security concern, and should be changed, so that the granular page permission is valued higher than space permissions.  Hope I could make the issue clear. If not I can provide screenshots. 

- **Issue #1552** (2026-07-03): **Export: Filenames containing a slash create unintended subdirectories**
  *Symptoms*: **Description:** When a note is titled **Foo 12/2020**, the exported file is saved as **Foo 12/2020.md**. Because / is interpreted as a directory separator by the filesystem, this results in a subfolder **Foo 12/** containing a file named **2020.md** instead of a single file.  **Expected behavior:** Invalid or reserved characters in filenames (e.g. /) should be sanitized and replaced with safe alternatives (e.g. - or _). In this case, the exported file should be named **Foo 12-2020.md** or even **Foo_12-2020.md**, if the space is also sanitized.
  **Post-Mortem & Fix Analysis**:
  > Should be fixed in the latest release.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `b6434371` (2026-09-30)
**Commit Message**: fix: add markdown attribute to details blocks in markdown export (#2533)

**File**: `apps/server/src/collaboration/collaboration.util.spec.ts` (removed, +0/-54)
```diff
@@ -1,54 +0,0 @@
-import { jsonToMarkdown } from './collaboration.util';
-
-const cell = (type: 'tableHeader' | 'tableCell', text: string) => ({
-  type,
-  content: [
-    {
-      type: 'paragraph',
-      content: text ? [{ type: 'text', text }] : [],
-    },
-  ],
-});
-
-const row = (type: 'tableHeader' | 'tableCell', texts: string[]) => ({
-  type: 'tableRow',
-  content: texts.map((text) => cell(type, text)),
-});
-
-const tableDoc = (rows: ReturnType<typeof row>[]) => ({
-  type: 'doc',
-  content: [{ type: 'table', content: rows }],
-});
-
-describe('jsonToMarkdown', () => {
-  it('uses the table header row as the markdown header', () => {
-    const markdown = jsonToMarkdown(
-      tableDoc([
-        row('tableHeader', ['Name', 'Role']),
-        row('tableCell', ['Ada', 'Engineer']),
-      ]),
-    );
-
-    expect(markdown.trim().split('\n')).toEqual([
-      '| Name | Role |',
-      '| --- | --- |',
-      '| Ada | Engineer |',
-    ]);
-  });
-
-  it('adds an empty header when the table has no header row', () => {
-    const markdown = jsonToMarkdown(
-      tableDoc([
-        row('tableCell', ['Ada', 'Engineer']),
-        row('tableCell', ['Alan', 'Mathematician']),
-      ]),
-    );
-
-    expect(markdown.trim().split('\n')).toEqual([
-      '|     |     |',
-      '| --- | --- |',
-      '| Ada | Engineer |',
-      '| Alan | Mathematician |',
-    ]);
-  });
-});
```

**File**: `apps/server/src/integrations/export/html-to-markdown.spec.ts` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+import { htmlToMarkdown } from '@docmost/editor-ext';
+
+const colgroup =
+  '<colgroup><col style="min-width: 25px;" /><col style="min-width: 25px;" /></colgroup>';
+
+describe('htmlToMarkdown', () => {
+  it('uses the table header row as the markdown header', () => {
+    const markdown = htmlToMarkdown(
+      `<table>${colgroup}<tbody>` +
+        '<tr><th><p>Name</p></th><th><p>Role</p></th></tr>' +
+        '<tr><td><p>Ada</p></td><td><p>Engineer</p></td></tr>' +
+        '</tbody></table>',
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '| Name | Role |',
+      '| --- | --- |',
+      '| Ada | Engineer |',
+    ]);
+  });
+
+  it('adds an empty header when the table has no header row', () => {
+    const markdown = htmlToMarkdown(
+      `<table>${colgroup}<tbody>` +
+        '<tr><td><p>Ada</p></td><td><p>Engineer</p></td></tr>' +
+        '<tr><td><p>Alan</p></td><td><p>Mathematician</p></td></tr>' +
+        '</tbody></table>',
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '|     |     |',
+      '| --- | --- |',
+      '| Ada | Engineer |',
+      '| Alan | Mathematician |',
+    ]);
+  });
+
+  it('marks details blocks so their content is parsed as markdown', () => {
+    const markdown = htmlToMarkdown(
+      '<details><summary data-type="detailsSummary">Title</summary>' +
+        '<div data-type="detailsContent"><p>Some <strong>bold</strong></p></div>' +
+        '</details>',
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '<details markdown="1">',
+      '<summary>Title</summary>',
+      '',
+      'Some **bold**',
+      '',
+      '</details>',
+    ]);
+  });
+});
```

**File**: `packages/editor-ext/src/lib/markdown/utils/turndown.utils.ts` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ function preserveDetail(turndownService: _TurndownService) {
         )
         .join('');
 
-      return `\n<details>\n${detailSummary}\n\n${detailsContent}\n\n</details>\n`;
+      return `\n<details markdown="1">\n${detailSummary}\n\n${detailsContent}\n\n</details>\n`;
     },
   });
 }
```

---

### Incident Patch 2: `f4caf0ba` (2026-09-30)
**Commit Message**: fix: preserve table header row in markdown export (#2532)

**File**: `apps/server/src/collaboration/collaboration.util.spec.ts` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+import { jsonToMarkdown } from './collaboration.util';
+
+const cell = (type: 'tableHeader' | 'tableCell', text: string) => ({
+  type,
+  content: [
+    {
+      type: 'paragraph',
+      content: text ? [{ type: 'text', text }] : [],
+    },
+  ],
+});
+
+const row = (type: 'tableHeader' | 'tableCell', texts: string[]) => ({
+  type: 'tableRow',
+  content: texts.map((text) => cell(type, text)),
+});
+
+const tableDoc = (rows: ReturnType<typeof row>[]) => ({
+  type: 'doc',
+  content: [{ type: 'table', content: rows }],
+});
+
+describe('jsonToMarkdown', () => {
+  it('uses the table header row as the markdown header', () => {
+    const markdown = jsonToMarkdown(
+      tableDoc([
+        row('tableHeader', ['Name', 'Role']),
+        row('tableCell', ['Ada', 'Engineer']),
+      ]),
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '| Name | Role |',
+      '| --- | --- |',
+      '| Ada | Engineer |',
+    ]);
+  });
+
+  it('adds an empty header when the table has no header row', () => {
+    const markdown = jsonToMarkdown(
+      tableDoc([
+        row('tableCell', ['Ada', 'Engineer']),
+        row('tableCell', ['Alan', 'Mathematician']),
+      ]),
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '|     |     |',
+      '| --- | --- |',
+      '| Ada | Engineer |',
+      '| Alan | Mathematician |',
+    ]);
+  });
+});
```

**File**: `packages/editor-ext/src/lib/markdown/utils/turndown.utils.ts` (modified, +5/-1)
```diff
@@ -37,7 +37,11 @@ export function htmlToMarkdown(html: string): string {
     footnoteRef,
     footnotesList,
   ]);
-  return turndownService.turndown(html).replaceAll('<br>', ' ');
+  const htmlWithoutColgroups = html.replace(
+    /<colgroup\b[^>]*>[\s\S]*?<\/colgroup>/gi,
+    '',
+  );
+  return turndownService.turndown(htmlWithoutColgroups).replaceAll('<br>', ' ');
 }
 
 function listParagraph(turndownService: _TurndownService) {
```

---

### Incident Patch 3: `a78e52b8` (2026-09-30)
**Commit Message**: fix: copy page labels when duplicating pages (#2531)

**File**: `apps/server/src/core/page/services/page.service.ts` (modified, +9/-1)
```diff
@@ -56,6 +56,7 @@ import { markdownToHtml } from '@docmost/editor-ext';
 import { WatcherService } from '../../watcher/watcher.service';
 import { sql } from 'kysely';
 import { TransclusionService } from '../transclusion/transclusion.service';
+import { LabelRepo } from '@docmost/db/repos/label/label.repo';
 
 @Injectable()
 export class PageService {
@@ -74,6 +75,7 @@ export class PageService {
     private collaborationGateway: CollaborationGateway,
     private readonly watcherService: WatcherService,
     private readonly transclusionService: TransclusionService,
+    private readonly labelRepo: LabelRepo,
   ) {}
 
   async findById(
@@ -715,7 +717,13 @@ export class PageService {
       }),
     );
 
-    await this.db.insertInto('pages').values(insertablePages).execute();
+    await executeTx(this.db, async (trx) => {
+      await trx.insertInto('pages').values(insertablePages).execute();
+      await this.labelRepo.copyLabelsToPages(
+        new Map([...pageMap].map(([oldId, entry]) => [oldId, entry.newPageId])),
+        trx,
+      );
+    });
 
     // Extract transclusions from every duplicated page and persist them in
     // one statement. Duplication bypasses Yjs onStoreDocument; brand-new
```

**File**: `apps/server/src/database/repos/label/label.repo.ts` (modified, +26/-0)
```diff
@@ -176,6 +176,32 @@ export class LabelRepo {
       .execute();
   }
 
+  async copyLabelsToPages(
+    pageIdMap: Map<string, string>,
+    trx?: KyselyTransaction,
+  ): Promise<void> {
+    if (pageIdMap.size === 0) return;
+    const db = dbOrTx(this.db, trx);
+
+    const sourceLabels = await db
+      .selectFrom('pageLabels')
+      .select(['pageId', 'labelId'])
+      .where('pageId', 'in', [...pageIdMap.keys()])
+      .execute();
+    if (sourceLabels.length === 0) return;
+
+    await db
+      .insertInto('pageLabels')
+      .values(
+        sourceLabels.map((row) => ({
+          pageId: pageIdMap.get(row.pageId),
+          labelId: row.labelId,
+        })),
+      )
+      .onConflict((oc) => oc.doNothing())
+      .execute();
+  }
+
   async removeLabelFromPage(
     pageId: string,
     labelId: string,
```

---

### Incident Patch 4: `01a139c3` (2026-09-30)
**Commit Message**: fix: skip page update notifications for users viewing the page (#2530)

* fix: drop malformed awareness before broadcast

* clear interval

* pass userId and avatar to awareness

* fix: skip page update notifications for editors and users viewing the page

**File**: `apps/client/src/features/editor/extensions/extensions.ts` (modified, +2/-0)
```diff
@@ -471,7 +471,9 @@ export const collabExtensions: CollabExtensions = (provider, user) => [
   CollaborationCaret.configure({
     provider,
     user: {
+      id: user.id,
       name: user.name,
+      avatarUrl: user.avatarUrl,
       color: randomElement(userColors),
     },
   }),
```

**File**: `apps/server/src/collaboration/collaboration.gateway.ts` (modified, +7/-1)
```diff
@@ -146,8 +146,14 @@ export class CollaborationGateway {
     eventName: TName,
     documentName: string,
     payload: Parameters<CollabEventHandlers[TName]>[1],
+    onlyIfOpen = false,
   ) {
-    return this.redisSync?.handleEvent(eventName, documentName, payload);
+    return this.redisSync?.handleEvent(
+      eventName,
+      documentName,
+      payload,
+      onlyIfOpen,
+    );
   }
 
   openDirectConnection(documentName: string, context?: any) {
```

**File**: `apps/server/src/collaboration/collaboration.handler.ts` (modified, +11/-0)
```diff
@@ -21,6 +21,17 @@ export class CollaborationHandler {
 
   getHandlers(hocuspocus: Hocuspocus) {
     return {
+      getConnectedUserIds: async (documentName: string) => {
+        const document = hocuspocus.documents.get(documentName);
+        if (!document) return [];
+
+        const userIds = new Set<string>();
+        for (const state of document.awareness.getStates().values()) {
+          const userId = state?.user?.id;
+          if (typeof userId === 'string') userIds.add(userId);
+        }
+        return [...userIds];
+      },
       alterState: async (documentName: string, payload: { pageId: string }) => {
         // dummy
         // this.logger.log('Processing', documentName, payload);
```

**File**: `apps/server/src/collaboration/collaboration.util.ts` (modified, +4/-0)
```diff
@@ -247,3 +247,7 @@ export function jsonToMarkdown(tiptapJson: any): string {
   const html = jsonToHtml(tiptapJson);
   return htmlToMarkdown(html);
 }
+
+export function isRenderableObject(value: unknown): boolean {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
```

**File**: `apps/server/src/collaboration/extensions/persistence.extension.ts` (modified, +48/-5)
```diff
@@ -1,5 +1,6 @@
 import {
   afterUnloadDocumentPayload,
+  beforeHandleAwarenessPayload,
   Extension,
   onChangePayload,
   onLoadDocumentPayload,
@@ -8,7 +9,12 @@ import {
 import * as Y from 'yjs';
 import { Injectable, Logger } from '@nestjs/common';
 import { TiptapTransformer } from '@hocuspocus/transformer';
-import { getPageId, jsonToText, tiptapExtensions } from '../collaboration.util';
+import {
+  getPageId,
+  isRenderableObject,
+  jsonToText,
+  tiptapExtensions,
+} from '../collaboration.util';
 import { PageRepo } from '@docmost/db/repos/page/page.repo';
 import { InjectKysely } from 'nestjs-kysely';
 import { KyselyDB } from '@docmost/db/types/kysely.types';
@@ -132,6 +138,8 @@ export class PersistenceExtension implements Extension {
           return;
         }
 
+        await this.collabHistory.addContributors(pageId, editingUserIds);
+
         let contributorIds = undefined;
         try {
           const existingContributors = page.contributorIds || [];
@@ -162,6 +170,10 @@ export class PersistenceExtension implements Extension {
       });
     } catch (err) {
       this.logger.error(`Failed to update page ${pageId}`, err);
+      page = null;
+      editingUserIds.forEach((userId) =>
+        this.trackContributor(documentName, userId),
+      );
     }
 
     if (page) {
@@ -184,8 +196,6 @@ export class PersistenceExtension implements Extension {
     }
 
     if (page) {
-      await this.collabHistory.addContributors(pageId, editingUserIds);
-
       const mentions = extractMentions(tiptapJson);
 
       const userMentions = extractUserMentions(mentions);
@@ -217,12 +227,45 @@ export class PersistenceExtension implements Extension {
     }
   }
 
+  // Drop malformed awareness before it is broadcast
+  async beforeHandleAwareness({
+    states,
+    context,
+  }: beforeHandleAwarenessPayload) {
+    const user = context?.user;
+
+    for (const [clientId, state] of states) {
+      if (!isRenderableObject(state)) {
+        states.delete(clientId);
+        continue;
+      }
+
+      if ('user' in state && !isRenderableObject(state.user)) {
+        delete state.user;
+      }
+
+      if (state.user && user) {
+        state.user.id = user.id;
+        state.user.avatarUrl = user.avatarUrl ?? null;
+      }
+
+      if (
+        'cursor' in state &&
+        state.cursor !== null &&
+        !isRenderableObject(state.cursor)
+      ) {
+        delete state.cursor;
+      }
+    }
+  }
+
   async onChange(data: onChangePayload) {
-    const documentName = data.documentName;
     const userId = data.context?.user?.id;
-
     if (!userId) return;
+    this.trackContributor(data.documentName, userId);
+  }
 
+  private trackContributor(documentName: string, userId: string) {
     if (!this.contributors.has(documentName)) {
       this.contributors.set(documentName, new Set());
     }
```

---

### Incident Patch 5: `870b71d2` (2026-09-29)
**Commit Message**: fix search limit and performance (#2529)

**File**: `apps/server/src/core/search/dto/search.dto.ts` (modified, +5/-0)
```diff
@@ -6,11 +6,15 @@ import {
   IsOptional,
   IsString,
   IsUUID,
+  MaxLength,
 } from 'class-validator';
 
+export const SEARCH_QUERY_MAX_LENGTH = 200;
+
 export class SearchDTO {
   @IsOptional()
   @IsString()
+  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
   query?: string;
 
   @IsOptional()
@@ -61,6 +65,7 @@ export class SearchPublicSpaceDTO extends SearchDTO {
 
 export class SearchSuggestionDTO {
   @IsString()
+  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
   query: string;
 
   @IsOptional()
```

**File**: `apps/server/src/core/search/search.service.ts` (modified, +22/-6)
```diff
@@ -55,11 +55,6 @@ export class SearchService {
         : sql<number>`ts_rank(tsv, to_tsquery('english', f_unaccent(${searchQuery})))`.as(
             'rank',
           );
-    const highlightColumn = browseByFilters || titleOnly
-      ? sql<string>`''`.as('highlight')
-      : sql<string>`ts_headline('english', text_content, to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
-          'highlight',
-        );
 
     let queryResults = this.db
       .selectFrom('pages')
@@ -73,7 +68,6 @@ export class SearchService {
         'createdAt',
         'updatedAt',
         rankColumn,
-        highlightColumn,
       ])
       .$if(!browseByFilters && !titleOnly, (qb) =>
         qb.where(
@@ -189,10 +183,32 @@ export class SearchService {
       results = results.filter((r: any) => accessibleSet.has(r.id));
     }
 
+    if (!browseByFilters && !titleOnly && results.length > 0) {
+      const highlights = await this.db
+        .selectFrom('pages')
+        .select([
+          'id',
+          sql<string>`ts_headline('english', substring(text_content, 1, 100000), to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
+            'highlight',
+          ),
+        ])
+        .where(
+          'id',
+          'in',
+          results.map((r: any) => r.id),
+        )
+        .execute();
+      const highlightById = new Map(highlights.map((h) => [h.id, h.highlight]));
+      for (const result of results) {
+        result.highlight = highlightById.get(result.id) ?? '';
+      }
+    }
+
     //@ts-ignore
     const searchResults = results.map((result: SearchResponseDto) => {
       result.wholeWord = true
       if (!result.highlight) {
+        result.highlight = '';
         result.matchedText = [];
         return result;
       }
```

**File**: `apps/server/src/ee` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 5e7120dcc86a344f5af09ccda0a29d5784659938
+Subproject commit 9134679e37e8ccd0f79e6f6c05da8e238778420d
```

---

### Incident Patch 6: `6205bbeb` (2026-09-08)
**Commit Message**: fix: page tree reordering

**File**: `apps/client/src/features/page/tree/components/space-tree-node-menu.tsx` (modified, +11/-2)
```diff
@@ -33,6 +33,10 @@ import {
 
 import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
 import { treeModel } from "@/features/page/tree/model/tree-model";
+import {
+  spaceRoots,
+  updateSpaceRoots,
+} from "@/features/page/tree/utils/utils.ts";
 import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
 import type { SpaceTreeNode } from "@/features/page/tree/types.ts";
 import classes from "@/features/page/tree/styles/tree.module.css";
@@ -77,7 +81,10 @@ export function NodeMenu({ node, canEdit }: NodeMenuProps) {
       const duplicatedPage = await duplicatePage({ pageId: node.id });
 
       // figure out parent + insertion index
-      const siblings = treeModel.siblingsOf(data, node.id);
+      const siblings = treeModel.siblingsOf(
+        spaceRoots(data, node.spaceId),
+        node.id,
+      );
       const parentId = siblings?.parentId ?? null;
       const currentIndex = siblings?.index ?? 0;
       const newIndex = currentIndex + 1;
@@ -96,7 +103,9 @@ export function NodeMenu({ node, canEdit }: NodeMenuProps) {
       };
 
       setData((prev) =>
-        treeModel.insert(prev, parentId, treeNodeData, newIndex),
+        updateSpaceRoots(prev, node.spaceId, (roots) =>
+          treeModel.insert(roots, parentId, treeNodeData, newIndex),
+        ),
       );
 
       setTimeout(() => {
```

**File**: `apps/client/src/features/page/tree/components/space-tree.tsx` (modified, +11/-13)
```diff
@@ -16,6 +16,8 @@ import {
   buildTree,
   buildTreeWithChildren,
   mergeRootTrees,
+  spaceRoots,
+  updateSpaceRoots,
 } from "@/features/page/tree/utils/utils.ts";
 import { SpaceTreeNode } from "@/features/page/tree/types.ts";
 import { getPageTitle } from "@/features/page/page.utils";
@@ -66,18 +68,14 @@ export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
     const allItems = pagesData.pages.flatMap((page) => page.items);
     const treeData = buildTree(allItems);
 
-    setData((prev) => {
-      // Keep nodes belonging to other spaces — filteredData filters by spaceId
-      // for rendering, so accumulating is safe. Preserves lazy-loaded children
-      // and open-state when the user returns to a previously-visited space.
-      const otherSpaces = prev.filter((n) => n?.spaceId !== spaceId);
-      const currentSpace = prev.filter((n) => n?.spaceId === spaceId);
-      const refreshed =
-        currentSpace.length > 0
-          ? mergeRootTrees(currentSpace, treeData)
-          : treeData;
-      return [...otherSpaces, ...refreshed];
-    });
+    // Keep nodes belonging to other spaces — filteredData filters by spaceId
+    // for rendering, so accumulating is safe. Preserves lazy-loaded children
+    // and open-state when the user returns to a previously-visited space.
+    setData((prev) =>
+      updateSpaceRoots(prev, spaceId, (roots) =>
+        roots.length > 0 ? mergeRootTrees(roots, treeData) : treeData,
+      ),
+    );
     setIsDataLoaded(true);
   }, [pagesData, hasNextPage, spaceId]);
 
@@ -183,7 +181,7 @@ export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
   );
 
   const filteredData = useMemo(
-    () => data.filter((node) => node?.spaceId === spaceId),
+    () => spaceRoots(data, spaceId),
     [data, spaceId],
   );
 
```

**File**: `apps/client/src/features/page/tree/hooks/use-tree-mutation.ts` (modified, +13/-5)
```diff
@@ -7,6 +7,10 @@ import { useNavigate, useParams } from "react-router-dom";
 import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
 import { treeModel } from "@/features/page/tree/model/tree-model";
 import type { DropOp } from "@/features/page/tree/model/tree-model.types";
+import {
+  spaceRoots,
+  updateSpaceRoots,
+} from "@/features/page/tree/utils/utils.ts";
 import { dropOpToMovePayload } from "./drop-op-to-move-payload";
 import { SpaceTreeNode } from "@/features/page/tree/types.ts";
 import { IPage } from "@/features/page/types/page.types.ts";
@@ -45,7 +49,7 @@ export function useTreeMutation(spaceId: string): UseTreeMutation {
 
   const handleMove = useCallback(
     async (sourceId: string, op: DropOp) => {
-      const before = store.get(treeDataAtom);
+      const before = spaceRoots(store.get(treeDataAtom), spaceId);
       const { tree: after, result } = treeModel.move(before, sourceId, op);
       if (after === before) return;
 
@@ -80,12 +84,12 @@ export function useTreeMutation(spaceId: string): UseTreeMutation {
         } as Partial<SpaceTreeNode>);
       }
 
-      setData(optimistic);
+      setData((prev) => updateSpaceRoots(prev, spaceId, () => optimistic));
 
       try {
         await movePageMutation.mutateAsync(payload);
       } catch {
-        setData(before);
+        setData((prev) => updateSpaceRoots(prev, spaceId, () => before));
         notifications.show({
           message: t("Failed to move page"),
           color: "red",
@@ -157,7 +161,7 @@ export function useTreeMutation(spaceId: string): UseTreeMutation {
       // tree (e.g. lazy-load children on expand) immediately before calling
       // handleCreate hit a stale closure and compute lastIndex against the
       // pre-load tree, requiring a setTimeout-based wait at the call site.
-      const current = store.get(treeDataAtom);
+      const current = spaceRoots(store.get(treeDataAtom), spaceId);
       let lastIndex: number;
       if (parentId === null) {
         lastIndex = current.length;
@@ -166,7 +170,11 @@ export function useTreeMutation(spaceId: string): UseTreeMutation {
         lastIndex = parent?.children?.length ?? 0;
       }
 
-      setData((prev) => treeModel.insert(prev, parentId, newNode, lastIndex));
+      setData((prev) =>
+        updateSpaceRoots(prev, spaceId, (roots) =>
+          treeModel.insert(roots, parentId, newNode, lastIndex),
+        ),
+      );
 
       setTimeout(() => {
         emit({
```

**File**: `apps/client/src/features/page/tree/utils/utils.ts` (modified, +18/-0)
```diff
@@ -220,3 +220,21 @@ export function mergeRootTrees(
 
   return sortPositionKeys(merged);
 }
+
+export function spaceRoots(
+  tree: SpaceTreeNode[],
+  spaceId: string,
+): SpaceTreeNode[] {
+  return tree.filter((node) => node?.spaceId === spaceId);
+}
+
+export function updateSpaceRoots(
+  tree: SpaceTreeNode[],
+  spaceId: string,
+  update: (roots: SpaceTreeNode[]) => SpaceTreeNode[],
+): SpaceTreeNode[] {
+  const roots = spaceRoots(tree, spaceId);
+  const next = update(roots);
+  if (next === roots) return tree;
+  return [...tree.filter((node) => node?.spaceId !== spaceId), ...next];
+}
```

**File**: `apps/client/src/features/websocket/use-tree-socket.ts` (modified, +55/-50)
```diff
@@ -6,6 +6,7 @@ import { WebSocketEvent } from "@/features/websocket/types";
 import { SpaceTreeNode } from "@/features/page/tree/types.ts";
 import { useQueryClient } from "@tanstack/react-query";
 import { treeModel } from "@/features/page/tree/model/tree-model";
+import { updateSpaceRoots } from "@/features/page/tree/utils/utils.ts";
 import localEmitter from "@/lib/local-emitter.ts";
 
 export const useTreeSocket = () => {
@@ -61,65 +62,69 @@ export const useTreeSocket = () => {
           setTreeData((prev) => {
             if (treeModel.find(prev, event.payload.data.id)) return prev;
             const newParentId = event.payload.parentId as string | null;
-            let next = treeModel.insert(
-              prev,
-              newParentId,
-              event.payload.data,
-              event.payload.index,
-            );
-            // Mirror the emitter: flip new parent's hasChildren to true so
-            // the chevron renders on the receiver.
-            if (newParentId) {
-              next = treeModel.update(next, newParentId, {
-                hasChildren: true,
-              } as Partial<SpaceTreeNode>);
-            }
-            return next;
+            return updateSpaceRoots(prev, event.spaceId, (roots) => {
+              let next = treeModel.insert(
+                roots,
+                newParentId,
+                event.payload.data,
+                event.payload.index,
+              );
+              // Mirror the emitter: flip new parent's hasChildren to true so
+              // the chevron renders on the receiver.
+              if (newParentId) {
+                next = treeModel.update(next, newParentId, {
+                  hasChildren: true,
+                } as Partial<SpaceTreeNode>);
+              }
+              return next;
+            });
           });
           break;
         case "moveTreeNode":
-          setTreeData((prev) => {
-            const sourceBefore = treeModel.find(prev, event.payload.id);
-            if (!sourceBefore) return prev;
-            const oldParentId =
-              (sourceBefore as SpaceTreeNode).parentPageId ?? null;
-            const newParentId = event.payload.parentId as string | null;
+          setTreeData((prev) =>
+            updateSpaceRoots(prev, event.spaceId, (roots) => {
+              const sourceBefore = treeModel.find(roots, event.payload.id);
+              if (!sourceBefore) return roots;
+              const oldParentId =
+                (sourceBefore as SpaceTreeNode).parentPageId ?? null;
+              const newParentId = event.payload.parentId as string | null;
 
-            const placed = treeModel.place(prev, event.payload.id, {
-              parentId: newParentId,
-              index: event.payload.index,
-            });
-            // `place` silently returns the same reference if the destination
-            // parent isn't loaded on this client. Falling back to removing the
-            // source keeps the UI consistent (the source will reappear when
-            // the user expands the new parent and lazy-load fetches it).
-            if (placed === prev) {
-              return treeModel.remove(prev, event.payload.id);
-            }
+              const placed = treeModel.place(roots, event.payload.id, {
+                parentId: newParentId,
+                index: event.payload.index,
+              });
+              // `place` silently returns the same reference if the destination
+              // parent isn't loaded on this client. Falling back to removing the
+              // source keeps the UI consistent (the source will reappear when
+              // the user expands the new parent and lazy-load fetches it).
+              if (placed === roots) {
+                return treeModel.remove(roots, event.payload.id);
+              }
 
-            let next = treeModel.update(placed, event.payload.id, {
-              position: event.payload.position,
-              parentPageId: ne
```

---

### Incident Patch 7: `dfc38c87` (2026-09-08)
**Commit Message**: fix: ws relay (#2482)

**File**: `apps/server/src/ws/ws.service.ts` (modified, +15/-0)
```diff
@@ -3,6 +3,8 @@ import { CACHE_MANAGER } from '@nestjs/cache-manager';
 import { Cache } from 'cache-manager';
 import { Server, Socket } from 'socket.io';
 import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
+import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
+import { SpaceRole } from '../common/helpers/types/permission';
 import {
   TREE_EVENTS,
   WS_SPACE_RESTRICTION_CACHE_PREFIX,
@@ -18,6 +20,7 @@ export class WsService {
   constructor(
     private readonly pagePermissionRepo: PagePermissionRepo,
     @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
+    private readonly spaceMemberRepo: SpaceMemberRepo,
   ) {}
 
   setServer(server: Server): void {
@@ -31,6 +34,18 @@ export class WsService {
       return;
     }
 
+    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
+      client.data.userId,
+      data.spaceId,
+    );
+    const canPublish = userSpaceRoles?.some(
+      ({ role }) => role === SpaceRole.ADMIN || role === SpaceRole.WRITER,
+    );
+
+    if (!canPublish) {
+      return;
+    }
+
     if (data.operation === 'refetchRootTreeNodeEvent') {
       client.broadcast.to(room).emit('message', data);
       return;
```

---

### Incident Patch 8: `7c368c86` (2026-09-08)
**Commit Message**: fix: h1 heading weight in editor (#2481)

* fix: h1 heading weight in editor
* cleanup

**File**: `apps/client/src/features/public-space/components/docs/docs.module.css` (modified, +4/-10)
```diff
@@ -15,8 +15,6 @@
   --docs-accent: #2b7af1;
   --docs-accent-soft: color-mix(in srgb, var(--docs-accent) 10%, transparent);
 
-  /* Cloudflare-style single-ink model: one foreground for headings, bold, and
-   * body on a just-off-white page; neither end of the scale is pure. */
   --docs-bg: oklch(99% 0 0);
   --docs-fg: oklch(21% 0 0);
   --docs-content-fg: var(--docs-fg);
@@ -410,7 +408,7 @@
   }
 }
 
-/* Expanded parents read as section headers, Cloudflare-style. */
+/* Expanded parents read as section headers. */
 .treeRow[data-open-parent="true"] {
   color: var(--docs-fg);
   font-weight: 500;
@@ -543,8 +541,6 @@
   }
 }
 
-/* ---------- Sidebar branding experiments (GitBook card / ReadMe line) ---------- */
-
 /* ---------- Footer branding ---------- */
 
 .footer {
@@ -773,13 +769,11 @@
   color: inherit;
 }
 
-/* Modest semibold heading scale (Cloudflare-style); class doubled to outrank
- * the shared editor and .public-typography rules. */
 .root.root :global(.ProseMirror) h1 {
-  font-size: 2.1875rem;
+  font-size: 1.75rem;
   font-weight: 600;
-  letter-spacing: -0.025em;
-  line-height: 1.25;
+  letter-spacing: -0.02em;
+  line-height: 1.3;
 }
 
 .root.root :global(.ProseMirror) h2 {
```

---

### Incident Patch 9: `5792fc7c` (2026-09-08)
**Commit Message**: fix: db lock operations (#2479)

* fix: advisory lock for page move

* fix: lock role count check

**File**: `apps/server/src/core/page/services/page.service.ts` (modified, +99/-53)
```diff
@@ -1,5 +1,6 @@
 import {
   BadRequestException,
+  ConflictException,
   Injectable,
   Logger,
   NotFoundException,
@@ -20,7 +21,7 @@ import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
 import { MovePageDto } from '../dto/move-page.dto';
 import { generateSlugId } from '../../../common/helpers';
 import { getPageTitle } from '../../../common/helpers';
-import { executeTx } from '@docmost/db/utils';
+import { dbOrTx, executeTx } from '@docmost/db/utils';
 import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
 import { v7 as uuid7 } from 'uuid';
 import {
@@ -174,10 +175,14 @@ export class PageService {
     return page;
   }
 
-  async nextPagePosition(spaceId: string, parentPageId?: string) {
+  async nextPagePosition(
+    spaceId: string,
+    parentPageId?: string,
+    trx?: KyselyTransaction,
+  ) {
     let pagePosition: string;
 
-    const lastPageQuery = this.db
+    const lastPageQuery = dbOrTx(this.db, trx)
       .selectFrom('pages')
       .select(['position'])
       .where('spaceId', '=', spaceId)
@@ -391,35 +396,46 @@ export class PageService {
   }
 
   async movePageToSpace(rootPage: Page, spaceId: string, userId: string) {
-    let childPageIds: string[] = [];
+    return executeTx(this.db, async (trx) => {
+      await this.pageRepo.lockPageHierarchySpaces(
+        [rootPage.spaceId, spaceId],
+        trx,
+      );
 
-    const allPages = await this.pageRepo.getPageAndDescendants(rootPage.id, {
-      includeContent: false,
-    });
+      const currentRootPage = await this.pageRepo.findById(rootPage.id, {
+        trx,
+      });
+      if (!currentRootPage || currentRootPage.deletedAt) {
+        throw new NotFoundException('Page to move not found');
+      }
+      if (currentRootPage.spaceId !== rootPage.spaceId) {
+        throw new ConflictException('Page location changed; retry the move');
+      }
 
-    // Filter to only accessible pages while maintaining tree integrity
-    const accessiblePages = await this.filterAccessibleTreePages(
-      allPages,
-      rootPage.id,
-      userId,
-      rootPage.spaceId,
-    );
-    const accessibleIds = new Set(accessiblePages.map((p) => p.id));
-
-    // Find inaccessible pages whose parent is being moved - these need to be orphaned
-    const pagesToOrphan = allPages.filter(
-      (p) =>
-        !accessibleIds.has(p.id) &&
-        p.parentPageId &&
-        accessibleIds.has(p.parentPageId),
-    );
+      const allPages = await this.pageRepo.getPageAndDescendants(
+        currentRootPage.id,
+        { includeContent: false, trx },
+      );
+      const accessiblePages = await this.filterAccessibleTreePages(
+        allPages,
+        currentRootPage.id,
+        userId,
+        currentRootPage.spaceId,
+      );
+      const accessibleIds = new Set(accessiblePages.map((p) => p.id));
+      const pagesToOrphan = allPages.filter(
+        (p) =>
+          !accessibleIds.has(p.id) &&
+          p.parentPageId &&
+          accessibleIds.has(p.parentPageId),
+      );
 
-    await executeTx(this.db, async (trx) => {
       // Orphan inaccessible child pages (make them root pages in original space)
       for (const page of pagesToOrphan) {
         const orphanPosition = await this.nextPagePosition(
-          rootPage.spaceId,
+          currentRootPage.spaceId,
           null,
+          trx,
         );
         await this.pageRepo.updatePage(
           { parentPageId: null, position: orphanPosition },
@@ -429,16 +445,18 @@ export class PageService {
       }
 
       // Update root page
-      const nextPosition = await this.nextPagePosition(spaceId);
+      const nextPosition = await this.nextPagePosition(spaceId, null, trx);
       await this.pageRepo.updatePage(
         { spaceId, parentPageId: null, position: nextPosition },
-        rootPage.id,
+        currentRootPage.id,
         trx,
       );
 
       const pageIdsToMove = accessiblePages.map((p) => p.id);
 
-      childPageId
```

**File**: `apps/server/src/core/space/services/space-member.service.ts` (modified, +67/-66)
```diff
@@ -10,7 +10,7 @@ import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
 import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
 import { AddSpaceMembersDto } from '../dto/add-space-members.dto';
 import { InjectKysely } from 'nestjs-kysely';
-import { Space, SpaceMember, User } from '@docmost/db/types/entity.types';
+import { Space, User } from '@docmost/db/types/entity.types';
 import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
 import { RemoveSpaceMemberDto } from '../dto/remove-space-member.dto';
 import { UpdateSpaceMemberRoleDto } from '../dto/update-space-member-role.dto';
@@ -218,41 +218,18 @@ export class SpaceMemberService {
     dto: RemoveSpaceMemberDto,
     workspaceId: string,
   ): Promise<void> {
-    const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
-    if (!space) {
-      throw new NotFoundException('Space not found');
-    }
+    const memberTypeId = dto.userId
+      ? { userId: dto.userId }
+      : dto.groupId
+        ? { groupId: dto.groupId }
+        : null;
 
-    let spaceMember: SpaceMember = null;
-
-    if (dto.userId) {
-      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
-        dto.spaceId,
-        {
-          userId: dto.userId,
-        },
-      );
-    } else if (dto.groupId) {
-      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
-        dto.spaceId,
-        {
-          groupId: dto.groupId,
-        },
-      );
-    } else {
+    if (!memberTypeId) {
       throw new BadRequestException(
         'Please provide a valid userId or groupId to remove',
       );
     }
 
-    if (!spaceMember) {
-      throw new NotFoundException('Space membership not found');
-    }
-
-    if (spaceMember.role === SpaceRole.ADMIN) {
-      await this.validateLastAdmin(dto.spaceId);
-    }
-
     let affectedUserIds: string[] = [];
     if (dto.userId) {
       affectedUserIds = [dto.userId];
@@ -262,7 +239,29 @@ export class SpaceMemberService {
       );
     }
 
-    await executeTx(this.db, async (trx) => {
+    const { space, spaceMember } = await executeTx(this.db, async (trx) => {
+      const space = await this.spaceRepo.findById(
+        dto.spaceId,
+        workspaceId,
+        { withLock: true, trx },
+      );
+      if (!space) {
+        throw new NotFoundException('Space not found');
+      }
+
+      const spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
+        dto.spaceId,
+        memberTypeId,
+        trx,
+      );
+      if (!spaceMember) {
+        throw new NotFoundException('Space membership not found');
+      }
+
+      if (spaceMember.role === SpaceRole.ADMIN) {
+        await this.validateLastAdmin(dto.spaceId, trx);
+      }
+
       await this.spaceMemberRepo.removeSpaceMemberById(
         spaceMember.id,
         dto.spaceId,
@@ -280,6 +279,8 @@ export class SpaceMemberService {
         dto.spaceId,
         { trx },
       );
+
+      return { space, spaceMember };
     });
 
     this.auditService.log({
@@ -304,48 +305,40 @@ export class SpaceMemberService {
     dto: UpdateSpaceMemberRoleDto,
     workspaceId: string,
   ): Promise<void> {
-    const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
-    if (!space) {
-      throw new NotFoundException('Space not found');
-    }
-
-    let spaceMember: SpaceMember = null;
+    const memberTypeId = dto.userId
+      ? { userId: dto.userId }
+      : dto.groupId
+        ? { groupId: dto.groupId }
+        : null;
 
-    if (dto.userId) {
-      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
-        dto.spaceId,
-        {
-          userId: dto.userId,
-        },
-      );
-    } else if (dto.groupId) {
-      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
-        dto.spaceId,
-        {
-          groupId: dto.groupId,
-        },
-      );
-    } else {
+    if (!memberTypeId) {
       throw new BadRequestException(
         '
```

**File**: `apps/server/src/core/workspace/services/workspace.service.ts` (modified, +113/-76)
```diff
@@ -747,44 +747,61 @@ export class WorkspaceService {
     userRoleDto: UpdateWorkspaceUserRoleDto,
     workspaceId: string,
   ) {
-    const user = await this.userRepo.findById(userRoleDto.userId, workspaceId);
-
     const newRole = userRoleDto.role.toLowerCase();
+    const result = await executeTx(this.db, async (trx) => {
+      const workspace = await this.workspaceRepo.findById(workspaceId, {
+        withLock: true,
+        trx,
+      });
+      if (!workspace) {
+        throw new NotFoundException('Workspace not found');
+      }
 
-    if (!user) {
-      throw new BadRequestException('Workspace member not found');
-    }
+      const user = await this.userRepo.findById(
+        userRoleDto.userId,
+        workspaceId,
+        { trx },
+      );
+      if (!user) {
+        throw new BadRequestException('Workspace member not found');
+      }
 
-    // prevent ADMIN from managing OWNER role
-    if (
-      isAdminActingOnOwner(authUser.role, newRole) ||
-      isAdminActingOnOwner(authUser.role, user.role)
-    ) {
-      throw new ForbiddenException();
-    }
+      if (
+        isAdminActingOnOwner(authUser.role, newRole) ||
+        isAdminActingOnOwner(authUser.role, user.role)
+      ) {
+        throw new ForbiddenException();
+      }
 
-    if (user.role === newRole) {
-      return user;
-    }
+      if (user.role === newRole) {
+        return { changed: false, user };
+      }
 
-    const workspaceOwnerCount = await this.userRepo.roleCountByWorkspaceId(
-      UserRole.OWNER,
-      workspaceId,
-    );
+      if (
+        user.role === UserRole.OWNER &&
+        !user.deletedAt &&
+        !user.deactivatedAt
+      ) {
+        await this.validateLastWorkspaceOwner(workspaceId, trx);
+      }
 
-    if (user.role === UserRole.OWNER && workspaceOwnerCount === 1) {
-      throw new BadRequestException(
-        'There must be at least one workspace owner',
+      await this.userRepo.updateUser(
+        {
+          role: newRole,
+        },
+        user.id,
+        workspaceId,
+        trx,
       );
+
+      return { changed: true, user };
+    });
+
+    if (!result.changed) {
+      return result.user;
     }
 
-    await this.userRepo.updateUser(
-      {
-        role: newRole,
-      },
-      user.id,
-      workspaceId,
-    );
+    const { user } = result;
 
     this.auditService.log({
       event: AuditEvent.USER_ROLE_CHANGED,
@@ -848,47 +865,47 @@ export class WorkspaceService {
     userId: string,
     workspaceId: string,
   ): Promise<void> {
-    const user = await this.userRepo.findById(userId, workspaceId);
-
-    if (!user || user.deletedAt) {
-      throw new BadRequestException('Workspace member not found');
-    }
-
-    if (user.deactivatedAt) {
-      throw new BadRequestException('User is already deactivated');
-    }
+    const user = await executeTx(this.db, async (trx) => {
+      const workspace = await this.workspaceRepo.findById(workspaceId, {
+        withLock: true,
+        trx,
+      });
+      if (!workspace) {
+        throw new NotFoundException('Workspace not found');
+      }
 
-    if (authUser.id === userId) {
-      throw new BadRequestException('You cannot deactivate yourself');
-    }
+      const user = await this.userRepo.findById(userId, workspaceId, { trx });
+      if (!user || user.deletedAt) {
+        throw new BadRequestException('Workspace member not found');
+      }
 
-    if (isAdminActingOnOwner(authUser.role, user.role)) {
-      throw new BadRequestException(
-        'You cannot deactivate a user with owner role',
-      );
-    }
+      if (user.deactivatedAt) {
+        throw new BadRequestException('User is already deactivated');
+      }
 
-    if (user.role === UserRole.OWNER) {
-      const workspaceOwnerCount = await this.userRepo.roleCountByWorkspaceId(
-        UserRole.OWNER,
-        workspaceId,
-      );
+      if (authUser.id === userId) {
+        throw new BadRequestException('You cannot deactivate yourself')
```

**File**: `apps/server/src/database/repos/page/page.repo.ts` (modified, +48/-2)
```diff
@@ -161,6 +161,22 @@ export class PageRepo {
     return result;
   }
 
+  async lockPageHierarchySpaces(
+    spaceIds: string[],
+    trx: KyselyTransaction,
+  ): Promise<void> {
+    const sortedSpaceIds = [...new Set(spaceIds)].sort();
+
+    for (const spaceId of sortedSpaceIds) {
+      await sql`
+        SELECT pg_advisory_xact_lock(
+          hashtext('page-hierarchy'),
+          hashtext(${spaceId})
+        )
+      `.execute(trx);
+    }
+  }
+
   async insertPage(
     insertablePage: InsertablePage,
     trx?: KyselyTransaction,
@@ -489,9 +505,9 @@ export class PageRepo {
 
   async getPageAndDescendants(
     parentPageId: string,
-    opts: { includeContent: boolean },
+    opts: { includeContent: boolean; trx?: KyselyTransaction },
   ) {
-    return this.db
+    return dbOrTx(this.db, opts.trx)
       .withRecursive('page_hierarchy', (db) =>
         db
           .selectFrom('pages')
@@ -535,6 +551,36 @@ export class PageRepo {
       .execute();
   }
 
+  async isPageDescendant(
+    ancestorPageId: string,
+    descendantPageId: string,
+    trx?: KyselyTransaction,
+  ): Promise<boolean> {
+    const result = await dbOrTx(this.db, trx)
+      .withRecursive('page_ancestors', (db) =>
+        db
+          .selectFrom('pages')
+          .select(['id', 'parentPageId'])
+          .where('id', '=', descendantPageId)
+          .union((exp) =>
+            exp
+              .selectFrom('pages as parent')
+              .select(['parent.id', 'parent.parentPageId'])
+              .innerJoin(
+                'page_ancestors as ancestor',
+                'ancestor.parentPageId',
+                'parent.id',
+              ),
+          ),
+      )
+      .selectFrom('page_ancestors')
+      .select('id')
+      .where('id', '=', ancestorPageId)
+      .executeTakeFirst();
+
+    return Boolean(result);
+  }
+
   /**
    * Get page and all descendants, excluding restricted pages and their subtrees.
    * More efficient than getPageAndDescendants + filtering because:
```

**File**: `apps/server/src/database/repos/space/space.repo.ts` (modified, +10/-1)
```diff
@@ -25,7 +25,11 @@ export class SpaceRepo {
   async findById(
     spaceId: string,
     workspaceId: string,
-    opts?: { includeMemberCount?: boolean; trx?: KyselyTransaction },
+    opts?: {
+      includeMemberCount?: boolean;
+      withLock?: boolean;
+      trx?: KyselyTransaction;
+    },
   ): Promise<Space> {
     const db = dbOrTx(this.db, opts?.trx);
 
@@ -41,6 +45,11 @@ export class SpaceRepo {
     } else {
       query = query.where(sql`LOWER(slug)`, '=', sql`LOWER(${spaceId})`);
     }
+
+    if (opts?.withLock && opts?.trx) {
+      query = query.forUpdate();
+    }
+
     return query.executeTakeFirst();
   }
 
```

---

### Incident Patch 10: `94907274` (2026-09-08)
**Commit Message**: fix: align input shortcuts (#2467)

* align input shortcuts

* minor fix

* minor fix

**File**: `apps/client/src/ee/base/components/row-detail-modal/fields/detail-field.tsx` (modified, +4/-1)
```diff
@@ -18,6 +18,7 @@ export type FieldProps = {
   rowId: string;
   readOnly: boolean;
   onChange: (value: unknown) => void;
+  onEditingChange?: (editing: boolean) => void;
 };
 
 type FieldShellProps = {
@@ -99,9 +100,10 @@ type DetailFieldProps = {
   row: IBaseRow;
   readOnly: boolean;
   onUpdate: (propertyId: string, value: unknown) => void;
+  onEditingChange: (editing: boolean) => void;
 };
 
-export function DetailField({ property, row, readOnly, onUpdate }: DetailFieldProps) {
+export function DetailField({ property, row, readOnly, onUpdate, onEditingChange }: DetailFieldProps) {
   const descriptor = getDescriptor(property.type);
   const value = descriptor?.systemAccessor
     ? descriptor.systemAccessor(row)
@@ -112,6 +114,7 @@ export function DetailField({ property, row, readOnly, onUpdate }: DetailFieldPr
     rowId: row.id,
     readOnly,
     onChange: (next: unknown) => onUpdate(property.id, next),
+    onEditingChange
   };
 
   switch (property.type) {
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/fields/field-long-text.tsx` (modified, +12/-2)
```diff
@@ -9,7 +9,13 @@ const normalize = (s: string) => {
   return trimmed.length ? trimmed : null;
 };
 
-export function FieldLongText({ property, value, readOnly, onChange }: FieldProps) {
+export function FieldLongText({
+  property,
+  value,
+  readOnly,
+  onChange,
+  onEditingChange,
+}: FieldProps) {
   const text = toText(value);
   const [draft, setDraft] = useState(text);
   const [focused, setFocused] = useState(false);
@@ -23,6 +29,7 @@ export function FieldLongText({ property, value, readOnly, onChange }: FieldProp
 
   const commit = () => {
     setFocused(false);
+    onEditingChange?.(false);
     if (cancelRef.current) {
       cancelRef.current = false;
       setDraft(text);
@@ -50,7 +57,10 @@ export function FieldLongText({ property, value, readOnly, onChange }: FieldProp
         className={classes.fieldTextarea}
         classNames={{ input: classes.fieldTextareaInput }}
         value={draft}
-        onFocus={() => setFocused(true)}
+        onFocus={() => {
+          setFocused(true);
+          onEditingChange?.(true);
+        }}
         onChange={(e) => setDraft(e.currentTarget.value)}
         onBlur={commit}
         onKeyDown={(e) => {
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/fields/field-number.tsx` (modified, +9/-1)
```diff
@@ -11,7 +11,13 @@ import classes from "@/ee/base/styles/row-detail-modal.module.css";
 const toDraft = (value: unknown) =>
   typeof value === "number" ? String(value) : "";
 
-export function FieldNumber({ property, value, readOnly, onChange }: FieldProps) {
+export function FieldNumber({
+  property,
+  value,
+  readOnly,
+  onChange,
+  onEditingChange,
+}: FieldProps) {
   const typeOptions = property.typeOptions as NumberTypeOptions | undefined;
   const numValue = typeof value === "number" ? value : null;
   const [draft, setDraft] = useState(toDraft(value));
@@ -36,6 +42,7 @@ export function FieldNumber({ property, value, readOnly, onChange }: FieldProps)
 
   const commit = () => {
     setFocused(false);
+    onEditingChange?.(false);
     if (cancelRef.current) {
       cancelRef.current = false;
       setDraft(toDraft(value));
@@ -54,6 +61,7 @@ export function FieldNumber({ property, value, readOnly, onChange }: FieldProps)
         onFocus={() => {
           setDraft(toDraft(value));
           setFocused(true);
+          onEditingChange?.(true);
         }}
         onChange={(e) => {
           const v = e.target.value;
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/fields/field-text.tsx` (modified, +12/-2)
```diff
@@ -5,7 +5,13 @@ import classes from "@/ee/base/styles/row-detail-modal.module.css";
 
 const toText = (value: unknown) => (typeof value === "string" ? value : "");
 
-export function FieldText({ property, value, readOnly, onChange }: FieldProps) {
+export function FieldText({
+  property,
+  value,
+  readOnly,
+  onChange,
+  onEditingChange,
+}: FieldProps) {
   const text = toText(value);
   const [draft, setDraft] = useState(text);
   const [focused, setFocused] = useState(false);
@@ -20,6 +26,7 @@ export function FieldText({ property, value, readOnly, onChange }: FieldProps) {
 
   const commit = () => {
     setFocused(false);
+    onEditingChange?.(false);
     if (cancelRef.current) {
       cancelRef.current = false;
       setDraft(text);
@@ -54,7 +61,10 @@ export function FieldText({ property, value, readOnly, onChange }: FieldProps) {
         className={classes.fieldInput}
         value={draft}
         maxLength={1000}
-        onFocus={() => setFocused(true)}
+        onFocus={() => {
+          setFocused(true);
+          onEditingChange?.(true);
+        }}
         onChange={(e) => setDraft(e.currentTarget.value)}
         onBlur={commit}
         onKeyDown={(e) => {
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/property-row.tsx` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@ type PropertyRowProps = {
   onMenuOpenChange: (opened: boolean) => void;
   onMenuDirtyChange: (dirty: boolean) => void;
   onUpdate: (propertyId: string, value: unknown) => void;
+  onEditingChange?: (editing: boolean) => void;
   autoFocusValue?: boolean;
   onAutoFocused?: () => void;
 };
@@ -29,6 +30,7 @@ export function PropertyRow({
   onMenuOpenChange,
   onMenuDirtyChange,
   onUpdate,
+  onEditingChange,
   autoFocusValue,
   onAutoFocused,
 }: PropertyRowProps) {
@@ -112,6 +114,7 @@ export function PropertyRow({
         row={row}
         readOnly={!canEdit}
         onUpdate={onUpdate}
+        onEditingChange={onEditingChange}
       />
     </div>
   );
```

#### Recent Merged Pull Requests:
- **PR #2535** (closed): test/cd (@JingzeGuo)
- **PR #2533** (2026-09-30): fix: add markdown attribute to details blocks in markdown export (@Philipinho)
- **PR #2532** (2026-09-30): fix: preserve table header row in markdown export (@Philipinho)
- **PR #2531** (2026-09-30): fix: copy page labels when duplicating pages (@Philipinho)
- **PR #2530** (2026-09-30): fix: skip page update notifications for users viewing the page (@Philipinho)
- **PR #2529** (2026-09-29): fix search limit and performance (@Philipinho)
- **PR #2528** (2026-09-29): chore(deps): package updates (@Philipinho)
- **PR #2524** (closed): Update/iac (@jiashunkang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
