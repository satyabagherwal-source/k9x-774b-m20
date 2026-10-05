# Forensic Learning Record (Deep Inspection): SimonSchubert/LinuxCommandLibrary

> **Canonical Artifact**: `07_PROJECT_LEARNING/simonschubert-linuxcommandlibrary-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SimonSchubert/LinuxCommandLibrary](https://github.com/SimonSchubert/LinuxCommandLibrary))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:55:43.090Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SimonSchubert/LinuxCommandLibrary`
- **Description**: 2M+ app downloads, 500k+ monthly website visitors, Linux basics, tips and formatted man pages
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2034 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `linuxApp/src/AppConfig.cpp`
```
#include "AppConfig.h"

#include "TomlFile.h"

#include <QDir>

QString AppConfig::path()
{
    const QByteArray xdg = qgetenv("XDG_CONFIG_HOME");
    const QString base = xdg.isEmpty() ? QDir::homePath() + "/.config" : QString::fromUtf8(xdg);
    return base + "/lcl/config.toml";
}

AppConfig::AppConfig(QObject* parent)
    : QObject(parent)
{
    const TomlFile toml = TomlFile::read(path());

    m_followOmarchy = toml.boolean({}, QStringLiteral("follow_omarchy"), m_followOmarchy);
    m_fontFamily = toml.value({}, QStringLiteral("font_family"), m_fontFamily);
    m_fontScale = qBound(0.5, toml.number({}, QStringLiteral("font_scale"), m_fontScale), 4.0);
    m_compactBelow = toml.integer({}, QStringLiteral("compact_below"), m_compactBelow);

    const QString section = toml.value({}, QStringLiteral("start_section")).toLower();
    if (section == QLatin1String("basics"))
        m_startSection = 0;
    else if (section == QLatin1String("tips"))
        m_startSection = 1;
    else if (section == QLatin1String("commands"))
        m_startSection = 2;

    for (const char* key : { "accent", "selection", "muted", "background", "dark_background",
                             "lighter_background", "foreground", "bright_foreground" }) {
        const QString name = QString::fromLatin1(key);
        if (toml.contains(QStringLiteral("colors"), name))
            m_colors.insert(name, toml.value(QStringLiteral("colors"), name));
    }
}

```

### Core Architecture Module: `linuxApp/src/AppConfig.h`
```
#pragma once

#include <QHash>
#include <QObject>
#include <QString>

/**
 * User settings from $XDG_CONFIG_HOME/lcl/config.toml (default ~/.config/lcl/config.toml).
 *
 * Deliberately does not duplicate the palette: colours come from the active Omarchy
 * theme so switching themes restyles the app for free. This file is for what Omarchy
 * has no opinion on — type scale, the layout breakpoint, which section opens first —
 * plus an escape hatch to pin colours or stop following the theme entirely.
 *
 * Every key is optional and the file need not exist.
 */
class AppConfig : public QObject {
    Q_OBJECT
    Q_PROPERTY(int compactBelow MEMBER m_compactBelow CONSTANT)
    Q_PROPERTY(int startSection MEMBER m_startSection CONSTANT)

public:
    explicit AppConfig(QObject* parent = nullptr);

    bool followOmarchy() const { return m_followOmarchy; }
    QString fontFamily() const { return m_fontFamily; }
    qreal fontScale() const { return m_fontScale; }
    /** Explicit colour overrides, applied on top of the theme. Keys match colors.toml. */
    QHash<QString, QString> colorOverrides() const { return m_colors; }

    static QString path();

private:
    bool m_followOmarchy = true;
    QString m_fontFamily = QStringLiteral("monospace");
    qreal m_fontScale = 1.0;
    int m_compactBelow = 700;
    // 0 Basics, 1 Tips, 2 Commands.
    int m_startSection = 2;
    QHash<QString, QString> m_colors;
};

```

### Core Architecture Module: `linuxApp/src/IconProvider.cpp`
```
#include "IconProvider.h"

#include <QFile>
#include <QPainter>
#include <QSvgRenderer>

IconProvider::IconProvider()
    : QQuickImageProvider(QQuickImageProvider::Image)
{
    const QByteArray dir = qgetenv("LCL_ICONS_DIR");
    m_dir = dir.isEmpty() ? QStringLiteral("/usr/share/lcl/icons") : QString::fromUtf8(dir);
}

QImage IconProvider::requestImage(const QString& id, QSize* size, const QSize& requestedSize)
{
    const int slash = id.lastIndexOf('/');
    const QString name = slash > 0 ? id.left(slash) : id;
    const QColor tint = slash > 0 ? QColor('#' + id.mid(slash + 1)) : QColor();

    const QSize target = requestedSize.isValid() && !requestedSize.isEmpty()
        ? requestedSize
        : QSize(24, 24);
    if (size)
        *size = target;

    QImage image(target, QImage::Format_ARGB32_Premultiplied);
    image.fill(Qt::transparent);

    // Shared icons come from /icons; anything the mobile apps define in code rather
    // than as an SVG (the back arrow) is bundled with this app instead.
    QFile file(m_dir + "/" + name + ".svg");
    if (!file.open(QIODevice::ReadOnly)) {
        file.setFileName(":/icons/" + name + ".svg");
        if (!file.open(QIODevice::ReadOnly))
            return image;
    }

    QSvgRenderer renderer(file.readAll());
    if (!renderer.isValid())
        return image;

    QPainter painter(&image);
    painter.setRenderHint(QPainter::Antialiasing, true);
    renderer.render(&painter);

    // Recolour by compositing over the rendered alpha. Painting the fill through the
    // mask works whatever the source declares; only 78 of the 188 shared icons carry
    // the hardcoded white fill that a text substitution would have relied on.
    if (tint.isValid()) {
        painter.setCompositionMode(QPainter::CompositionMode_SourceIn);
        painter.fillRect(image.rect(), tint);
    }

    return image;
}

```

### Core Architecture Module: `linuxApp/src/IconProvider.h`
```
#pragma once

#include <QQuickImageProvider>
#include <QString>

/**
 * Serves the shared /icons SVGs tinted to an arbitrary colour.
 *
 * The icons are single monochrome paths, so they have to be recoloured to follow the
 * Omarchy palette. Tinting is done here rather than with a QtQuick MultiEffect because
 * shader effects do not run under the software renderer, which is what a VM or a
 * machine without working GPU drivers falls back to.
 *
 * URL form: image://icons/<name>/<rrggbb>, e.g. image://icons/ic_puzzle/7aa2f7
 */
class IconProvider : public QQuickImageProvider {
public:
    IconProvider();

    QImage requestImage(const QString& id, QSize* size, const QSize& requestedSize) override;

private:
    QString m_dir;
};

```

### Core Architecture Module: `linuxApp/src/LclBridge.cpp`
```
#include "LclBridge.h"

#include "liblcl_api.h"

namespace {

liblcl_ExportedSymbols* lib()
{
    static liblcl_ExportedSymbols* symbols = liblcl_symbols();
    return symbols;
}

// Every const char* the Kotlin side returns is owned by us and must be disposed.
QString take(const char* value)
{
    if (!value)
        return QString();
    const QString result = QString::fromUtf8(value);
    lib()->DisposeString(value);
    return result;
}

auto& lclApi()
{
    return lib()->kotlin.root.com.linuxcommandlibrary.app.nativeapi.LclApi;
}

auto api()
{
    static auto instance = lclApi()._instance();
    return instance;
}

// Blocks are fetched the same way for sections, groups and tips; only the three
// accessors differ.
template <typename Kind, typename Text>
QVariantList collectBlocks(int count, Kind kind, Text text)
{
    QVariantList blocks;
    blocks.reserve(count);
    for (int i = 0; i < count; ++i) {
        blocks.append(QVariantMap {
            { QStringLiteral("kind"), take(kind(i)) },
            { QStringLiteral("text"), take(text(i)) },
        });
    }
    return blocks;
}

} // namespace

void lclStart()
{
    lclApi().start(api());
}

// --- Commands ---

int CommandsModel::countNow() const
{
    return lclApi().resultCount(api());
}

QVariant CommandsModel::data(const QModelIndex& index, int role) const
{
    if (!has(index) || role != NameRole)
        return {};
    return take(lclApi().resultName(api(), index.row()));
}

QHash<int, QByteArray> CommandsModel::roleNames() const
{
    return { { NameRole, "name" } };
}

void CommandsModel::setQuery(const QString& query)
{
    if (query == m_query)
        return;
    m_query = query;
    lclApi().setQuery(api(), query.toUtf8().constData());
    resetTo(lclApi().resultCount(api()));
    emit queryChanged();
}

// --- Command sections ---

int SectionsModel::countNow() const
{
    return lclApi().sectionCount(api());
}

QVariant SectionsModel::data(const QModelIndex& index, int role) const
{
    if (!has(index) || role != TitleRole)
        return {};
    return take(lclApi().sectionTitle(api(), index.row()));
}

QVariantList SectionsModel::blocksAt(int index) const
{
    return collectBlocks(
        lclApi().sectionBlockCount(api(), index),
        [index](int block) { return lclApi().sectionBlockKind(api(), index, block); },
        [index](int block) { return lclApi().sectionBlockText(api(), index, block); });
}

void SectionsModel::setCommand(const QString& command)
{
    if (command == m_command)
        return;
    m_command = command;
    // The selection is pushed once here, so the row reads below are index-only.
    lclApi().selectCommand(api(), command.toUtf8().constData());
    resetTo(lclApi().sectionCount(api()));
    emit commandChanged();
}

// --- Basics categories ---

int CategoriesModel::countNow() const
{
    return lclApi().categoryCount(api());
}

QVariant CategoriesModel::data(const QModelIndex& index, int role) const
{
    if (!has(index))
        return {};
    if (role == IdRole)
        return take(lclApi().categoryId(api(), index.row()));
    if (role == TitleRole)
        return take(lclApi().categoryTitle(api(), index.row()));
    return {};
}

QHash<int, QByteArray> CategoriesModel::roleNames() const
{
    return { { IdRole, "categoryId" }, { TitleRole, "title" } };
}

// --- Groups of a category ---

int GroupsModel::countNow() const
{
    return lclApi().groupCount(api());
}

QVariant GroupsModel::data(const QModelIndex& index, int role) const
{
    if (!has(index) || role != TitleRole)
        return {};
    return take(lclApi().groupTitle(api(), index.row()));
}

QVariantList GroupsModel::blocksAt(int index) const
{
    return collectBlocks(
        lclApi().groupBlockCount(api(), index),
        [index](int block) { return lclApi().groupBlockKind(api(), index, block); },
        [index](int block) { return lclApi().groupBlockText(api(), index, block); });
}

void GroupsModel::setCategoryId(const QString& id)
{
    if (id == m_categoryId)
        return;
    m_categoryId = id;
    lclApi().selectCategory(api(), id.toUtf8().constData());
    resetTo(lclApi().groupCount(api()));
    emit categoryIdChanged();
}

// --- Tips ---

int Tips::count() const
{
    return lclApi().tipCount(api());
}

QString Tips::titleAt(int index) const
{
    return take(lclApi().tipTitle(api(), index));
}

int Tips::weightAt(int index) const
{
    return lclApi().tipWeight(api(), index);
}

QVariantList Tips::blocksAt(int index) const
{
    return collectBlocks(
        lclApi().tipBlockCount(api(), index),
        [index](int block) { return lclApi().tipBlockKind(api(), index, block); },
        [index](int block) { return lclApi().tipBlockText(api(), index, block); });
}

```

### Core Architecture Module: `linuxApp/src/LclBridge.h`
```
#pragma once

#include <QAbstractListModel>
#include <QObject>
#include <QString>
#include <QVariantList>

/**
 * Shared plumbing for the bridge models: a row count that is fetched on first use and
 * a reset helper. Counting lazily keeps asset parsing off the startup path for the
 * sections the user has not opened.
 */
class LclListModel : public QAbstractListModel {
    Q_OBJECT

public:
    using QAbstractListModel::QAbstractListModel;

    int rowCount(const QModelIndex& parent = QModelIndex()) const override
    {
        if (parent.isValid())
            return 0;
        if (m_count < 0)
            m_count = countNow();
        return m_count;
    }

protected:
    /** Current size according to the shared layer. Called once, then cached. */
    virtual int countNow() const { return 0; }

    bool has(const QModelIndex& index) const
    {
        return index.isValid() && index.row() >= 0 && index.row() < rowCount();
    }

    void resetTo(int count)
    {
        beginResetModel();
        m_count = count;
        endResetModel();
    }

private:
    mutable int m_count = -1;
};

/**
 * Base for the models whose rows are a title plus a list of content blocks. Every
 * content surface in the app has that shape, so they all render through one card.
 */
class TitledBlocksModel : public LclListModel {
    Q_OBJECT

public:
    enum Roles { TitleRole = Qt::UserRole + 1 };

    using LclListModel::LclListModel;

    QHash<int, QByteArray> roleNames() const override { return { { TitleRole, "title" } }; }

    /** Blocks of one row as [{kind, text}, ...], for a Repeater inside a card. */
    Q_INVOKABLE virtual QVariantList blocksAt(int index) const = 0;
};

/** Rows are the current (optionally filtered) command list. */
class CommandsModel : public LclListModel {
    Q_OBJECT
    Q_PROPERTY(QString query READ query WRITE setQuery NOTIFY queryChanged)

public:
    enum Roles { NameRole = Qt::UserRole + 1 };

    using LclListModel::LclListModel;

    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

    QString query() const { return m_query; }
    void setQuery(const QString& query);

signals:
    void queryChanged();

protected:
    int countNow() const override;

private:
    QString m_query;
};

/** Sections of one command, parsed by the shared MarkdownParser. */
class SectionsModel : public TitledBlocksModel {
    Q_OBJECT
    Q_PROPERTY(QString command READ command WRITE setCommand NOTIFY commandChanged)

public:
    using TitledBlocksModel::TitledBlocksModel;

    QVariant data(const QModelIndex& index, int role) const override;
    QVariantList blocksAt(int index) const override;

    QString command() const { return m_command; }
    void setCommand(const QString& command);

signals:
    void commandChanged();

protected:
    int countNow() const override;

private:
    QString m_command;
};

/** The basics categories, in the shared layer's own display order. */
class CategoriesModel : public LclListModel {
    Q_OBJECT

public:
    enum Roles { IdRole = Qt::UserRole + 1, TitleRole };

    using LclListModel::LclListModel;

    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

protected:
    int countNow() const override;
};

/** Groups of one basics category, rendered to Markdown by the shared layer. */
class GroupsModel : public TitledBlocksModel {
    Q_OBJECT
    Q_PROPERTY(QString categoryId READ categoryId WRITE setCategoryId NOTIFY categoryIdChanged)

public:
    using TitledBlocksModel::TitledBlocksModel;

    QVariant data(const QModelIndex& index, int role) const override;
    QVariantList blocksAt(int index) const override;

    QString categoryId() const { return m_categoryId; }
    void setCategoryId(const QString& id);

signals:
    void categoryIdChanged();

protected:
    int countNow() const override;

private:
    QString m_categoryId;
};

/**
 * Tips, read imperatively rather than through a delegate: the cards lay themselves out
 * across balanced columns, so QML addresses tips by index instead of binding a view.
 */
class Tips : public QObject {
    Q_OBJECT

public:
    using QObject::QObject;

    Q_INVOKABLE int count() const;
    Q_INVOKABLE QString titleAt(int index) const;
    /** Rough rendered size, for balancing the card columns without rendering anything. */
    Q_INVOKABLE int weightAt(int index) const;
    /** Blocks of one tip as [{kind, text}, ...], for a Repeater inside a card. */
    Q_INVOKABLE QVariantList blocksAt(int index) const;
};

/** Starts the Kotlin runtime and loads the command index. Call once, before the models. */
void lclStart();

```

### Core Architecture Module: `linuxApp/src/OmarchyTheme.cpp`
```
#include "OmarchyTheme.h"

#include "AppConfig.h"
#include "TomlFile.h"

#include <QDir>
#include <QFileInfo>

namespace {

// Omarchy 4 first, then the Omarchy 3 location, then an explicit override for testing.
QStringList candidateDirs()
{
    QStringList dirs;
    const QByteArray override = qgetenv("LCL_OMARCHY_THEME");
    if (!override.isEmpty())
        dirs << QString::fromUtf8(override);
    const QString home = QDir::homePath();
    dirs << home + "/.local/state/omarchy/current/theme";
    dirs << home + "/.config/omarchy/current/theme";
    return dirs;
}

/** Blend a shell.toml colour with its "-alpha" companion over a background. */
QColor withAlpha(const QColor& colour, double alpha, const QColor& over)
{
    if (!colour.isValid())
        return over;
    const double a = qBound(0.0, alpha, 1.0);
    return QColor::fromRgbF(
        colour.redF() * a + over.redF() * (1 - a),
        colour.greenF() * a + over.greenF() * (1 - a),
        colour.blueF() * a + over.blueF() * (1 - a));
}

} // namespace

QString OmarchyTheme::themeDir()
{
    for (const QString& dir : candidateDirs()) {
        if (QFileInfo::exists(dir + "/colors.toml"))
            return dir;
    }
    return QString();
}

OmarchyTheme::OmarchyTheme(const AppConfig* config, QObject* parent)
    : QObject(parent)
    , m_config(config)
{
    m_settle.setSingleShot(true);
    m_settle.setInterval(150);
    connect(&m_settle, &QTimer::timeout, this, &OmarchyTheme::reload);

    reload();

    // The theme directory is replaced wholesale by omarchy-theme-set, so watch the
    // parent too: watching only the file loses the watch when it is replaced.
    connect(&m_watcher, &QFileSystemWatcher::fileChanged, &m_settle, qOverload<>(&QTimer::start));
    connect(&m_watcher, &QFileSystemWatcher::directoryChanged, &m_settle, qOverload<>(&QTimer::start));
}

void OmarchyTheme::reload()
{
    const QString dir = m_config->followOmarchy() ? themeDir() : QString();
    const TomlFile colors = TomlFile::read(dir.isEmpty() ? QString() : dir + "/colors.toml");
    const TomlFile shell = TomlFile::read(dir.isEmpty() ? QString() : dir + "/shell.toml");

    if (!dir.isEmpty()) {
        const QString parent = QFileInfo(dir).dir().absolutePath();
        for (const QString& path : { dir + "/colors.toml", dir, parent }) {
            if (!m_watcher.files().contains(path) && !m_watcher.directories().contains(path))
                m_watcher.addPath(path);
        }
    }

    m_background = colorOf(colors, "background", "#1a1b26");
    m_darkBackground = colorOf(colors, "dark_background", "#13141c");
    m_lighterBackground = colorOf(colors, "lighter_background", "#24283b");
    m_foreground = colorOf(colors, "foreground", "#a9b1d6");
    m_brightForeground = colorOf(colors, "bright_foreground", "#c0caf5");
    m_accent = colorOf(colors, "accent", "#7aa2f7");
    m_selection = colorOf(colors, "selection", "#292e42");
    m_muted = colorOf(colors, "muted", "#414868");

    // Selection follows the shell's menu surface when shell.toml is present, so a
    // highlighted row matches the launcher; otherwise the palette's own selection.
    const QString menu = QStringLiteral("menu");
    const QColor menuSelected(shell.value(menu, QStringLiteral("selected-background")));
    m_selectedBackground = menuSelected.isValid()
        ? withAlpha(menuSelected, shell.number(menu, QStringLiteral("selected-background-alpha"), 0.08), m_background)
        : m_selection;
    const QColor menuSelectedText(shell.value(menu, QStringLiteral("selected-text")));
    m_selectedText = menuSelectedText.isValid() ? menuSelectedText : m_brightForeground;

    const QString controls = QStringLiteral("controls");
    const QColor focus(shell.value(controls, QStringLiteral("focus-border")));
    m_focusBorder = focus.isValid()
        ? withAlpha(focus, shell.number(controls, QStringLiteral("focus-border-alpha"), 0.25), m_background)
        : m_accent;

    // [font] base-size is the rem root of the shell's type scale; the documented
    // ratios put body at the base, subtitle ~1.083 and heading ~1.333.
    const QString font = QStringLiteral("font");
    const double base = shell.number(font, QStringLiteral("base-size"), 12.0);
    const double scale = m_config->fontScale();
    const auto token = [&](const char* key, double ratio) {
        const double px = shell.number(font, QString::fromLatin1(key), base * ratio);
        return qMax(1, qRound(px * scale));
    };
    m_fontCaption = token("caption", 0.833);
    m_fontBody = token("body", 1.0);
    m_fontSubtitle = token("subtitle", 1.083);
    m_fontHeading = token("heading", 1.333);

    // [spacing] scale multiplies the shell's own proportions; apply it to this app's
    // base metrics rather than adopting the shell's absolute paddings, which are sized
    // for panels rather than a dense reference list.
    const double spacing = shell.number(QStringLiteral("spacing"), QStringLiteral("scale"), 1.0);
    m_gap = qMax(1, qRound(8 * spacing));
    m_pad = qMax(1, qRound(10 * spacing));
    m_rowHeight = qMax(12, qRound(28 * spacing * scale));

    emit changed();
}

QColor OmarchyTheme::colorOf(const TomlFile& colors, const char* key, const char* fallback) const
{
    const QString name = QString::fromLatin1(key);
    // An explicit override in the user's config wins over the theme.
    const QColor overridden(m_config->colorOverrides().value(name));
    if (overridden.isValid())
        return overridden;
    const QColor parsed(colors.value(QString(), name));
    return parsed.isValid() ? parsed : QColor(QString::fromLatin1(fallback));
}

```

### Core Architecture Module: `linuxApp/src/OmarchyTheme.h`
```
#pragma once

#include <QColor>
#include <QFileSystemWatcher>
#include <QObject>
#include <QString>
#include <QTimer>

class AppConfig;
class TomlFile;

/**
 * Publishes the active Omarchy theme as QML properties: colours from colors.toml and
 * proportions from shell.toml, the same file Omarchy's own Quickshell reads into its
 * Color and Style singletons. Following shell.toml is what makes the app scale with
 * the desktop rather than merely share its palette.
 *
 * Omarchy 4 keeps the active theme at ~/.local/state/omarchy/current/theme; Omarchy 3
 * used ~/.config/omarchy/current/theme. Every key is optional: with no theme at all the
 * built-in dark defaults apply, so the app still runs off Omarchy.
 *
 * Values are resolved once per load and exposed as plain members. QML does not cache
 * property reads and these are read several times per list row.
 */
class OmarchyTheme : public QObject {
    Q_OBJECT

    // Palette
    Q_PROPERTY(QColor background MEMBER m_background NOTIFY changed)
    Q_PROPERTY(QColor darkBackground MEMBER m_darkBackground NOTIFY changed)
    Q_PROPERTY(QColor lighterBackground MEMBER m_lighterBackground NOTIFY changed)
    Q_PROPERTY(QColor foreground MEMBER m_foreground NOTIFY changed)
    Q_PROPERTY(QColor brightForeground MEMBER m_brightForeground NOTIFY changed)
    Q_PROPERTY(QColor accent MEMBER m_accent NOTIFY changed)
    Q_PROPERTY(QColor selection MEMBER m_selection NOTIFY changed)
    Q_PROPERTY(QColor muted MEMBER m_muted NOTIFY changed)

    // Surface roles taken from the shell's own menu/launcher surfaces, so a selected
    // row here reads the same as a selected row in the Omarchy launcher.
    Q_PROPERTY(QColor selectedBackground MEMBER m_selectedBackground NOTIFY changed)
    Q_PROPERTY(QColor selectedText MEMBER m_selectedText NOTIFY changed)
    Q_PROPERTY(QColor focusBorder MEMBER m_focusBorder NOTIFY changed)

    // Type scale derived from [font] base-size, then the user's font_scale.
    Q_PROPERTY(int fontCaption MEMBER m_fontCaption NOTIFY changed)
    Q_PROPERTY(int fontBody MEMBER m_fontBody NOTIFY changed)
    Q_PROPERTY(int fontSubtitle MEMBER m_fontSubtitle NOTIFY changed)
    Q_PROPERTY(int fontHeading MEMBER m_fontHeading NOTIFY changed)

    // Metrics, scaled by [spacing] scale. The base values are this app's own, so the
    // shell's scale adjusts them without imposing the shell's absolute paddings.
    Q_PROPERTY(int gap MEMBER m_gap NOTIFY changed)
    Q_PROPERTY(int pad MEMBER m_pad NOTIFY changed)
    Q_PROPERTY(int rowHeight MEMBER m_rowHeight NOTIFY changed)

public:
    explicit OmarchyTheme(const AppConfig* config, QObject* parent = nullptr);

    QColor accent() const { return m_accent; }

signals:
    void changed();

private:
    void reload();
    QColor colorOf(const TomlFile& colors, const char* key, const char* fallback) const;
    static QString themeDir();

    const AppConfig* m_config;

    QColor m_background;
    QColor m_darkBackground;
    QColor m_lighterBackground;
    QColor m_foreground;
    QColor m_brightForeground;
    QColor m_accent;
    QColor m_selection;
    QColor m_muted;
    QColor m_selectedBackground;
    QColor m_selectedText;
    QColor m_focusBorder;

    int m_fontCaption = 10;
    int m_fontBody = 12;
    int m_fontSubtitle = 13;
    int m_fontHeading = 16;
    int m_gap = 8;
    int m_pad = 10;
    int m_rowHeight = 28;

    QFileSystemWatcher m_watcher;
    // A theme switch is several filesystem operations (remove, move, write
    // theme.name), so reloading on the first event reads a half-applied theme.
    QTimer m_settle;
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #104** (2026-04-28): **Upgrading to 3.7.8 destroyed all bookmarks**
  *Symptoms*: ### Type  GUI  ### Platform  Android  ### Description  Upgrading to 3.7.8 destroyed all bookmarks  (i probably had about 40)   ### Steps to reproduce  Bookmark 40 commands, then upgrade to 3.7.8
  **Post-Mortem & Fix Analysis**:
  > Apologies, I will look into this and hope I will be able to restore you bookmarks  It's something I usually keep an eye. I dont know how this could have happened yet
  > ✅ next release will have a migration and your bookmarks should get restored and merged with your new ones(if you have any) https://github.com/SimonSchubert/LinuxCommandLibrary/commit/f24b87753fdaddf375fc0ae2bd4c92ab3c702233
  > Great.  thank you!

- **Issue #96** (2026-03-23): **Terminal games/pipes/nbpipes | Empty page**
  *Symptoms*: ### Type  GUI  ### Platform  Android  ### Description  App version: 3.7.0 Android version: 15  At least since the version above, the page for Terminal games/pipes/nbpipes is empty.  It might be a misplacement since the actual program seems to serve a different purpose than being a game as described on the website :  https://linuxcommandlibrary.com/man/nbpipes  As a side note I thank all the devs for the awesome work done on this app.  ### Steps to reproduce  Open the app and navigate to Terminal games/pipes/nbpipes
  **Post-Mortem & Fix Analysis**:
  > Looking into this thanks for the report  Reproduceable: <img width="1080" height="2220" alt="Image" src="https://github.com/user-attachments/assets/f251c43b-1f39-4bc2-bcd1-76cd878cd4b4" />
  > Fixed ✅ + terminal game previews  will go live with the release later today  <img width="1080" height="2220" alt="Image" src="https://github.com/user-attachments/assets/ab4052bb-6577-4599-b792-6fd9bfef3ef2" /> <img width="1080" height="2220" alt="Image" src="https://github.com/user-attachments/assets/addc9495-54d5-4402-b9a8-ab1fff638643" />

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

### Incident Patch 1: `2b957e84` (2026-09-26)
**Commit Message**: Auto-fix: lintFix and refresh Paparazzi screenshots [skip ci]



---

### Incident Patch 2: `ee6583ec` (2026-09-24)
**Commit Message**: Auto-fix: lintFix and refresh Paparazzi screenshots [skip ci]



---

### Incident Patch 3: `3361b435` (2026-09-18)
**Commit Message**: Auto-fix: lintFix and refresh Paparazzi screenshots [skip ci]

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [versions]
-agp = "9.4.0"
+agp = "9.4.1"
 appVersion = "4.8.0"
 androidVersionCode = "173"
 android-compileSdk = "37"
```

---

### Incident Patch 4: `3716c75a` (2026-09-16)
**Commit Message**: Fix CI: skip removed Android SDK tools package in setup-android

**File**: `.github/workflows/android.yml` (modified, +6/-2)
```diff
@@ -23,7 +23,9 @@ jobs:
       - name: Set execution flag for gradlew
         run: chmod +x gradlew
       - name: Setup Android SDK
-        uses: android-actions/setup-android@v3
+        uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
       - name: Install Android Build Tools
         run: sdkmanager "build-tools;29.0.3"
       - name: Run unit tests
@@ -485,7 +487,9 @@ jobs:
       - name: Set execution flag for gradlew
         run: chmod +x gradlew
       - name: Setup Android SDK
-        uses: android-actions/setup-android@v3
+        uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
       - name: Decode keystore
         run: echo "${{ secrets.KEYSTORE_B64 }}" | base64 --decode > /tmp/keystore.jks
       - name: Decode service account key
```

**File**: `.github/workflows/screenshots.yml` (modified, +3/-1)
```diff
@@ -20,7 +20,9 @@ jobs:
         with:
           java-version: '21'
           distribution: 'temurin'
-      - uses: android-actions/setup-android@v3
+      - uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
       - uses: gradle/actions/setup-gradle@v4
       # leftover lint errors (not auto-fixable) must not skip screenshot updates
       - run: ./gradlew :composeApp:lintFix :android:lintFix
```

---

### Incident Patch 5: `ca2cce52` (2026-09-04)
**Commit Message**: Build the x86_64 Linux app against Arch's Qt to fix startup crash

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KoTsv3DnjUKNoBaad6fhmC

**File**: `aur/lcl-gui-bin/.SRCINFO` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 pkgbase = lcl-gui-bin
 	pkgdesc = Linux command reference and cheat sheets - native Qt desktop application
 	pkgver = 4.7.1
-	pkgrel = 1
+	pkgrel = 2
 	url = https://github.com/SimonSchubert/LinuxCommandLibrary
 	arch = x86_64
 	arch = aarch64
@@ -20,7 +20,7 @@ pkgbase = lcl-gui-bin
 	conflicts = lcl-gui
 	options = !strip
 	source_x86_64 = LinuxCommandLibrary-4.7.1-linux-gui-x86_64.tar.gz::https://github.com/SimonSchubert/LinuxCommandLibrary/releases/download/linux-gui-v4.7.1/LinuxCommandLibrary-4.7.1-linux-gui-x86_64.tar.gz
-	sha256sums_x86_64 = 7cf2e6809bd533f56d8dba1c2a06227ad3e9b3d562bd010fd8f3d803bc813f03
+	sha256sums_x86_64 = c9c5ec6dd8934edf22162295e03db32a2089a658ee67e2d42ff2c445348946ed
 	source_aarch64 = LinuxCommandLibrary-4.7.1-linux-gui-aarch64.tar.gz::https://github.com/SimonSchubert/LinuxCommandLibrary/releases/download/linux-gui-v4.7.1/LinuxCommandLibrary-4.7.1-linux-gui-aarch64.tar.gz
 	sha256sums_aarch64 = 0cee72a7086b10b5ae082230c5e95df2bfda8df544d34af8f960ba3fd24bbb56
 
```

**File**: `aur/lcl-gui-bin/PKGBUILD` (modified, +7/-2)
```diff
@@ -3,7 +3,7 @@
 
 pkgname=lcl-gui-bin
 pkgver=4.7.1
-pkgrel=1
+pkgrel=2
 pkgdesc='Linux command reference and cheat sheets - native Qt desktop application'
 arch=('x86_64' 'aarch64')
 url='https://github.com/SimonSchubert/LinuxCommandLibrary'
@@ -27,12 +27,17 @@ provides=('lcl-gui')
 conflicts=('lcl-gui')
 options=('!strip')
 
+# The x86_64 binary is built against Arch's own Qt. Arch compiles Qt with
+# -mno-direct-extern-access, so linking against another distribution's Qt produces copy
+# relocations against protected symbols that Arch's loader rejects at startup
+# (GNU_PROPERTY_1_NEEDED_INDIRECT_EXTERN_ACCESS).
+
 # Tagged linux-gui-v${pkgver} rather than v${pkgver}: the "Build and Release" workflow
 # fires on v* tags and would cut a full multi-platform release. This is Linux only.
 _base="https://github.com/SimonSchubert/LinuxCommandLibrary/releases/download/linux-gui-v${pkgver}"
 source_x86_64=("LinuxCommandLibrary-${pkgver}-linux-gui-x86_64.tar.gz::${_base}/LinuxCommandLibrary-${pkgver}-linux-gui-x86_64.tar.gz")
 source_aarch64=("LinuxCommandLibrary-${pkgver}-linux-gui-aarch64.tar.gz::${_base}/LinuxCommandLibrary-${pkgver}-linux-gui-aarch64.tar.gz")
-sha256sums_x86_64=('7cf2e6809bd533f56d8dba1c2a06227ad3e9b3d562bd010fd8f3d803bc813f03')
+sha256sums_x86_64=('c9c5ec6dd8934edf22162295e03db32a2089a658ee67e2d42ff2c445348946ed')
 sha256sums_aarch64=('0cee72a7086b10b5ae082230c5e95df2bfda8df544d34af8f960ba3fd24bbb56')
 
 package() {
```

#### Recent Merged Pull Requests:
- **PR #122** (2026-08-26): docs: fix typo quering -> querying (@vaibhav8a)
- **PR #120** (closed): Bump json from 2.20.0 to 2.21.2 (@dependabot[bot])
- **PR #112** (closed): Bump faraday from 1.10.5 to 1.10.6 (@dependabot[bot])
- **PR #103** (2026-04-28): TMUX: More ctrl + b prefix keys, separated by command type (@Hawkhobo)
- **PR #102** (2026-04-23): refined 2 `find` commands at the one-liners (@DJCrashdummy)
- **PR #93** (2026-02-11): Complete vim keys in CLI (@jneidel)
- **PR #92** (2026-02-11): Expand on tips (@jneidel)
- **PR #91** (2026-02-05): Fix deeplink test and update dependencies (@Rikul)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
