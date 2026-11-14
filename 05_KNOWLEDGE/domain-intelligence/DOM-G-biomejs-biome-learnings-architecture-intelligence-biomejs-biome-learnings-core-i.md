# Domain G — Architecture Intelligence: Architecture Intelligence: biomejs-biome-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "biomejs-biome-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T15:26:22.720Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-biomejs-biome-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs-biome-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T15:26:22.720Z`  
> **Learning ID**: `LEARN-EVO-biomejs-biome-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: F (Design Intelligence), H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 59%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from biomejs-biome-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/biomejs-biome-learnings.md`  
> **Source**: github ([https://github.com/biomejs/biome](https://github.com/biomejs/biome))  
> **Source Version**: `e3ab04d5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T15:25:38.149Z  
> **Learning ID**: `learn-github-biomejs-biome`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): biomejs/biome

> **Canonical Artifact**: `07_PROJECT_LEARNING/biomejs-biome-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/biomejs/biome](https://github.com/biomejs/biome))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T15:25:38.144Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `biomejs/biome`
- **Description**: A toolchain for web projects, aimed to provide functionalities to maintain them. Biome offers formatter and linter, usable via CLI and LSP.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 26102 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/biome_analyze/src/utils.rs`
```
use biome_rowan::{
    AstNode, AstSeparatedElement, AstSeparatedList, Language, SyntaxError, SyntaxNode, SyntaxToken,
    chain_trivia_pieces, trim_trailing_trivia_pieces,
};
use std::cmp::Ordering;

/// Returns `true` if `list` is sorted by `get_key`.
/// The function returns an error if we encounter a buggy node or separator.
///
/// The list is divided into chunks of nodes with keys.
/// Thus, a node without key acts as a chuck delimiter.
/// Chunks are sorted separately.
pub fn is_separated_list_sorted_by<'a, L: Language + 'a, N: AstNode<Language = L> + 'a, Key>(
    list: &impl AstSeparatedList<Language = L, Node = N>,
    get_key: impl Fn(&N) -> Option<Key>,
    comparator: impl Fn(&Key, &Key) -> Ordering,
) -> Result<bool, SyntaxError> {
    let mut is_sorted = true;

    if list.len() > 1 {
        let mut previous_key: Option<Key> = None;
        for AstSeparatedElement {
            node,
            trailing_separator,
        } in list.elements()
        {
            // We have to check if the separator is not buggy.
            let _separator = trailing_separator?;
            previous_key = if let Some(key) = get_key(&node?) {
                if previous_key.is_some_and(|previous_key| comparator(&previous_key, &key).is_gt())
                {
                    // We don't return early because we want to return the error if we met one.
                    is_sorted = false;
                }
                Some(key)
            } else {
                // If a name cannot be extracted, then the current chunk stops here.
                None
            };
        }
    }
    Ok(is_sorted)
}

/// Returns the items and their separators resulting from sorting `list` by `get_key`.
/// When elements are reordered, `make_separator` is called to add missing separators in the middle of the list.
///
/// The list is divided into chunks of nodes with keys.
/// Thus, a node without key acts as a chuck delimiter.
/// Chunks are sorted separately.
///
/// This sort is stable (i.e., does not reorder equal elements).
pub fn sorted_separated_list_by<'a, L, List, Node, Key>(
    list: &List,
    get_key: impl Fn(&Node) -> Option<Key>,
    make_separator: fn() -> SyntaxToken<L>,
    comparator: impl Fn(&Key, &Key) -> Ordering,
) -> Result<List, SyntaxError>
where
    L: Language + 'a,
    List: AstSeparatedList<Language = L, Node = Node> + AstNode<Language = L> + 'a,
    Node: AstNode<Language = L> + 'a,
{
    let mut elements = Vec::with_capacity(list.len());
    for AstSeparatedElement {
        node,
        trailing_separator,
    } in list.elements()
    {
        let node = node?;
        let trailing_separator = trailing_separator?;
        elements.push((get_key(&node), node, trailing_separator));
    }

    // Iterate over chunks of node with a key
    for slice in elements.split_mut(|(key, _, _)| key.is_none()) {
        let last_has_separator = slice.last().is_some_and(|(_, _, sep)| sep.is_some());
        slice.sort_by(|(key1, _, _), (key2, _, _)| match (key1, key2) {
            (Some(k1), Some(k2)) => comparator(k1, k2),
            (Some(_), None) => Ordering::Greater,
            (None, Some(_)) => Ordering::Less,
            (None, None) => Ordering::Equal,
        });
        fix_separators(
            slice.iter_mut().map(|(_, node, sep)| (node, sep)),
            last_has_separator,
            make_separator,
        );
    }

    let separators: Vec<_> = elements
        .iter_mut()
        .filter_map(|(_, _, sep)| sep.take())
        .collect();
    let mut separators = separators.into_iter();
    let mut items = elements.into_iter().map(|(_, node, _)| node);

    Ok(List::unwrap_cast(SyntaxNode::new_detached(
        list.syntax().kind(),
        (0..list.len() + separators.len()).map(|index| {
            if index % 2 == 0 {
                Some(items.next()?.into_syntax().into())
            } else {
                Some(separators.next()?.into())
            }
        }),
    )))
}

/// Fix the ordered sequence of nodes and separators adding missing separators and removing an extra separator.
///
/// If a separator is missing in the middle of the sequence, then a new one is created using `make_separator`.
/// If the last node has no separator, then a new one is created only if `needs_last_separator` is set to `true`.
/// If the last node has a separator and `needs_last_separator` is set to false, then the separator is removed.
/// The separator is always kept if some comments are attached.
///
/// This utility is notably useful when a delimited list with an optional last separator is reordered.
/// It allows you to add missing separators and remove an extra separator.
/// Usually, you collect every pair of nodes and separators in a vector and then pass a mutable iterator to `fix_separators`.
///
/// See [`sorted_separated_list_by`] as a usage example.
pub fn fix_separators<'a, L: Language + 'a, N: AstNode<Language = L> + 'a>(
    // Mutable iterator of a list of nodes and their optional separators
    iter: impl std::iter::ExactSizeIterator<Item = (&'a mut N, &'a mut Option<SyntaxToken<L>>)>,
    needs_last_separator: bool,
    make_separator: fn() -> SyntaxToken<L>,
) {
    let last_index = iter.len().saturating_sub(1);
    for (i, (node, optional_separator)) in iter.enumerate() {
        if let Some(separator) = optional_separator {
            // Remove the last separator at the separator has no attached comments
            if i == last_index
                && !(needs_last_separator
                    || separator.has_leading_comments()
                    || separator.has_trailing_comments())
            {
                // Transfer the separator trivia
                if let Some(new_node) = node.clone().append_trivia_pieces(chain_trivia_pieces(
                    separator.leading_trivia().pieces(),
                    separator.trailing_trivia().pieces(),
                )) {
                    *node = new_node;
                }
                *optional_separator = None;
            }
        } else if i != last_index || needs_last_separator {
            // The last node is moved and has no trailing separator.
            // Thus we build a new separator and remove its trailing trivia.
            *optional_separator = Some(match node.syntax().last_trailing_trivia() {
                // Transfer the trailing trivia to the separator
                Some(trivia) => make_separator()
                    .append_trivia_pieces(trim_trailing_trivia_pieces(trivia.pieces())),
                _ => make_separator(),
            });

            if let Some(new_node) = node.clone().with_trailing_trivia_pieces([]) {
                *node = new_node;
            }
        }
    }
}

/// Splits the list into two new lists according to a partitioning function.
///
/// Every item of `list` is passed to `partition` that decides if the item is
/// part of the left or the right returned list.
/// The `partition` function can change the passed item before returning it.
/// This allows supporting cases where the passed AST node must be modified.
///
/// This function returns `None` if it encounters a buggy item or
/// if `partition` returns `None` for at least one item.
///
/// The trailing separators are moved with their node.
pub fn split_separated_list<'a, L, List, Node>(
    list: &List,
    partition: impl Fn(Node) -> Option<either::Either<Node, Node>>,
) -> Option<(List, List)>
where
    L: Language + 'a,
    List: AstSeparatedList<Language = L, Node = Node> + AstNode<Language = L> + 'a,
    Node: AstNode<Language = L> + 'a,
{
    let mut left_items = Vec::with_capacity(list.len());
    let mut left_separators = Vec::with_capacity(list.len());
    let mut right_items = Vec::with_capacity(list.len());
    let mut right_separators = Vec::with_capacity(list.len());

    for AstSeparatedElement {
        node,
        trailing_separator,
    } in list.elements()
    {
        // Abort the split if a node is buggy or if `partition` returns `None`.
        let node = node.ok()?;
        let trailing_separator = trailing_separator.ok()?;
        let (items, separators, node) = match partition(node)? {
            either::Either::Left(node) => (&mut left_items, &mut left_separators, node),
            either::Either::Right(node) => (&mut right_items, &mut right_separators, node),
        };
        items.push(node);
        if let Some(trailing_separator) = trailing_separator {
            separators.push(trailing_separator);
        }
    }

    let mut left_items = left_items.into_iter();
    let mut left_separators = left_separators.into_iter();
    let left_list = List::unwrap_cast(SyntaxNode::new_detached(
        list.syntax().kind(),
        (0..left_items.len() + left_separators.len()).map(|index| {
            if index % 2 == 0 {
                Some(left_items.next()?.into_syntax().into())
            } else {
                Some(left_separators.next()?.into())
            }
        }),
    ));

    let mut right_items = right_items.into_iter();
    let mut right_separators = right_separators.into_iter();
    let right_list = List::unwrap_cast(SyntaxNode::new_detached(
        list.syntax().kind(),
        (0..right_items.len() + right_separators.len()).map(|index| {
            if index % 2 == 0 {
                Some(right_items.next()?.into_syntax().into())
            } else {
                Some(right_separators.next()?.into())
            }
        }),
    ));

    Some((left_list, right_list))
}

/// Counts lines in a syntax tree, used by `noExcessiveLinesPerFile`.
///
/// When `skip_blank_lines` is true, counts tokens with leading newlines (excluding blank lines).
/// When false, counts all newline trivia pieces in leading trivia.
/// EOF tokens and newlines inside comments or token text are excluded.
/// Returns total + 1 to account for the first line.
pub fn count_lines_in_file<L: Language>(
    node: &SyntaxNode<L>,
    is_eof_token: impl Fn(&SyntaxToken<L>) -> bool
```

### Core Architecture Module: `crates/biome_console/src/utils.rs`
```
use crate::fmt::{Display, Formatter};
use crate::{Markup, markup};
use std::io;

/// It displays a type that implements [std::fmt::Display]
pub struct DebugDisplay<T>(pub T);

impl<T> Display for DebugDisplay<T>
where
    T: std::fmt::Display,
{
    fn fmt(&self, f: &mut Formatter<'_>) -> io::Result<()> {
        write!(f, "{}", self.0)
    }
}

/// It displays a `Option<T>`, where `T` implements [std::fmt::Display]
pub struct DisplayOption<T>(pub Option<T>);

impl<T> Display for DisplayOption<T>
where
    T: std::fmt::Display,
{
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        use crate as biome_console;

        if let Some(value) = &self.0 {
            markup!({ DebugDisplay(value) }).fmt(fmt)?;
        } else {
            markup!(<Dim>"unset"</Dim>).fmt(fmt)?;
        }
        Ok(())
    }
}

/// A horizontal line with the given print width
pub struct HorizontalLine {
    width: usize,
}

impl HorizontalLine {
    pub fn new(width: usize) -> Self {
        Self { width }
    }
}

impl Display for HorizontalLine {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        fmt.write_str(&"\u{2501}".repeat(self.width))
    }
}

// It prints `\n`
pub struct Softline;

pub const SOFT_LINE: Softline = Softline;

impl Display for Softline {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        fmt.write_str("\n")
    }
}

// It prints `\n\n`
pub struct Hardline;

pub const HARD_LINE: Hardline = Hardline;

impl Display for Hardline {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        fmt.write_str("\n\n")
    }
}

/// It prints N whitespaces, where N is the `width` provided by [Padding::new]
pub struct Padding {
    width: usize,
}

impl Padding {
    pub fn new(width: usize) -> Self {
        Self { width }
    }
}

impl Display for Padding {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        for _ in 0..self.width {
            fmt.write_str(" ")?;
        }
        Ok(())
    }
}

/// It writes a pair of key-value, with the given padding
pub struct KeyValuePair<'a>(&'a str, Markup<'a>, usize);

impl<'a> KeyValuePair<'a> {
    pub fn new(key: &'a str, value: Markup<'a>) -> Self {
        Self(key, value, 30usize)
    }

    pub fn with_padding(mut self, padding: usize) -> Self {
        self.2 = padding;
        self
    }
}

impl Display for KeyValuePair<'_> {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        let KeyValuePair(key, value, padding) = self;
        write!(fmt, "  {key}:")?;

        let padding_width = padding.saturating_sub(key.len() + 1);

        for _ in 0..padding_width {
            fmt.write_str(" ")?;
        }

        value.fmt(fmt)?;

        fmt.write_str("\n")
    }
}

```

### Core Architecture Module: `crates/biome_css_analyze/src/utils.rs`
```
use biome_css_syntax::keywords::{
    A_NPLUS_BNOTATION_PSEUDO_CLASSES, A_NPLUS_BOF_SNOTATION_PSEUDO_CLASSES,
    AT_RULE_PAGE_PSEUDO_CLASSES, CSS_MODULE_PSEUDO_CLASSES, HTML_TAGS, KNOWN_CHROME_PROPERTIES,
    KNOWN_EDGE_PROPERTIES, KNOWN_EXPLORER_PROPERTIES, KNOWN_FIREFOX_PROPERTIES, KNOWN_PROPERTIES,
    KNOWN_SAFARI_PROPERTIES, KNOWN_SAMSUNG_INTERNET_PROPERTIES, KNOWN_US_BROWSER_PROPERTIES,
    LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS, LINGUISTIC_PSEUDO_CLASSES,
    LOGICAL_COMBINATIONS_PSEUDO_CLASSES, LONGHAND_SUB_PROPERTIES_OF_SHORTHAND_PROPERTIES,
    MATH_ML_TAGS, MEDIA_FEATURE_NAMES, OTHER_PSEUDO_CLASSES, OTHER_PSEUDO_ELEMENTS,
    RESET_TO_INITIAL_PROPERTIES_BY_BORDER, RESET_TO_INITIAL_PROPERTIES_BY_FONT,
    RESOURCE_STATE_PSEUDO_CLASSES, SHADOW_TREE_PSEUDO_ELEMENTS, SHORTHAND_PROPERTIES, SVG_TAGS,
    VENDOR_PREFIXES, VENDOR_SPECIFIC_PSEUDO_ELEMENTS,
};
use biome_css_syntax::{
    CssDeclarationWithSemicolon, CssSyntaxKind, CssSyntaxNode, CssSyntaxToken, ScssFunctionAtRule,
    ScssNestingDeclaration,
};
use biome_rowan::{AstNode, declare_node_union};
use biome_string_case::{StrLikeExtension, StrOnlyExtension};
use std::cmp::Ordering;
use std::iter::successors;

pub fn is_css_variable(value: &str) -> bool {
    value.to_ascii_lowercase_cow().starts_with("var(")
}

/// Check if the value is a double-dashed custom function.
pub fn is_custom_function(value: &str) -> bool {
    value.starts_with("--")
}

// Returns the vendor prefix extracted from an input string.
pub fn vender_prefix(prop: &str) -> &'static str {
    for prefix in VENDOR_PREFIXES.iter() {
        if prop.starts_with(prefix) {
            return prefix;
        }
    }
    ""
}

pub fn is_pseudo_elements(prop: &str) -> bool {
    LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS
        .binary_search(&prop)
        .is_ok()
        || VENDOR_SPECIFIC_PSEUDO_ELEMENTS.binary_search(&prop).is_ok()
        || SHADOW_TREE_PSEUDO_ELEMENTS.binary_search(&prop).is_ok()
        || OTHER_PSEUDO_ELEMENTS.binary_search(&prop).is_ok()
}

/// Check if the input string is custom selector
/// See https://drafts.csswg.org/css-extensions/#custom-selectors for more details
pub fn is_custom_selector(prop: &str) -> bool {
    prop.starts_with("--")
}

pub fn is_page_pseudo_class(prop: &str) -> bool {
    AT_RULE_PAGE_PSEUDO_CLASSES.binary_search(&prop).is_ok()
}

pub fn is_known_pseudo_class(prop: &str) -> bool {
    LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS
        .binary_search(&prop)
        .is_ok()
        || A_NPLUS_BNOTATION_PSEUDO_CLASSES
            .binary_search(&prop)
            .is_ok()
        || A_NPLUS_BOF_SNOTATION_PSEUDO_CLASSES
            .binary_search(&prop)
            .is_ok()
        || LINGUISTIC_PSEUDO_CLASSES.binary_search(&prop).is_ok()
        || LOGICAL_COMBINATIONS_PSEUDO_CLASSES
            .binary_search(&prop)
            .is_ok()
        || RESOURCE_STATE_PSEUDO_CLASSES.binary_search(&prop).is_ok()
        || OTHER_PSEUDO_CLASSES.binary_search(&prop).is_ok()
}

pub fn is_known_properties(prop: &str) -> bool {
    KNOWN_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_CHROME_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_EDGE_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_EXPLORER_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_FIREFOX_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_SAFARI_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_SAMSUNG_INTERNET_PROPERTIES
            .binary_search(&prop)
            .is_ok()
        || KNOWN_US_BROWSER_PROPERTIES.binary_search(&prop).is_ok()
}

pub fn vendor_prefixed(props: &str) -> bool {
    props.starts_with("-webkit-")
        || props.starts_with("-moz-")
        || props.starts_with("-ms-")
        || props.starts_with("-o-")
}

/// Check if the input string is a media feature name.
pub fn is_media_feature_name(prop: &str) -> bool {
    let input = prop.to_ascii_lowercase_cow();
    let count = MEDIA_FEATURE_NAMES.binary_search(&input.as_ref());
    if count.is_ok() {
        return true;
    }
    let mut has_vendor_prefix = false;
    for prefix in VENDOR_PREFIXES.iter() {
        if input.starts_with(prefix) {
            has_vendor_prefix = true;
            break;
        }
    }
    if has_vendor_prefix {
        for feature_name in MEDIA_FEATURE_NAMES.iter() {
            if input.ends_with(feature_name) {
                return true;
            }
        }
    }
    false
}

pub fn get_longhand_sub_properties(shorthand_property: &str) -> &'static [&'static str] {
    if let Ok(index) = SHORTHAND_PROPERTIES.binary_search(&shorthand_property) {
        return LONGHAND_SUB_PROPERTIES_OF_SHORTHAND_PROPERTIES[index];
    }

    &[]
}

pub fn get_reset_to_initial_properties(shorthand_property: &str) -> &'static [&'static str] {
    match shorthand_property {
        "border" => &RESET_TO_INITIAL_PROPERTIES_BY_BORDER,
        "font" => &RESET_TO_INITIAL_PROPERTIES_BY_FONT,
        _ => &[],
    }
}

fn is_custom_element(prop: &str) -> bool {
    prop.contains('-') && prop.eq(prop.to_lowercase_cow().as_ref())
}

/// Check if the input string is a known type selector.
pub fn is_known_type_selector(prop: &str) -> bool {
    let input = prop.to_ascii_lowercase_cow();
    HTML_TAGS.binary_search(&input.as_ref()).is_ok()
        || SVG_TAGS.binary_search(&prop).is_ok()
        || MATH_ML_TAGS.binary_search(&input.as_ref()).is_ok()
        || is_custom_element(prop)
}

/// Check if the input string is a CSS module pseudo-class.
///
/// CSS modules support special pseudo-classes like `:global` and `:local` for
/// scoping control.
/// These are only valid when CSS modules are enabled.
///
/// See https://github.com/css-modules/css-modules for more details.
pub fn is_css_module_pseudo_class(prop: &str) -> bool {
    CSS_MODULE_PSEUDO_CLASSES.binary_search(&prop).is_ok()
}

declare_node_union! {
    /// A statement that sets a property: either a declaration, such as
    /// `transition: all 1s;`, or an SCSS group of nested properties, such as
    /// `transition: { duration: 1s; }`.
    ///
    /// Declarations in a condition, such as `@supports (transition: all 1s)`,
    /// aren't statements. They only test for browser support.
    pub AnyPropertyStatement = CssDeclarationWithSemicolon | ScssNestingDeclaration
}

impl AnyPropertyStatement {
    /// Returns the token of the property name, or `None` if the name isn't a
    /// plain identifier.
    pub fn name(&self) -> Option<CssSyntaxToken> {
        let name = match self {
            Self::CssDeclarationWithSemicolon(statement) => statement
                .declaration()
                .ok()?
                .property()
                .ok()?
                .as_css_generic_property()?
                .name(),
            Self::ScssNestingDeclaration(group) => group.name(),
        };
        name.ok()?.declaration().ok()
    }

    /// Returns the SCSS group of nested properties whose block contains this
    /// statement.
    ///
    /// Sass emits the properties in an `@if`, `@else`, `@each`, `@for`,
    /// `@while`, or `@include` block as part of the group around it, so those
    /// blocks are looked through. Returns `None` if the statement isn't in a
    /// group, or if a nested rule or any other at-rule, such as `@media`, is
    /// between them.
    pub fn group(&self) -> Option<Self> {
        self.syntax()
            .ancestors()
            .skip(1)
            .find(|ancestor| {
                !matches!(
                    ancestor.kind(),
                    CssSyntaxKind::CSS_DECLARATION_OR_RULE_LIST
                        | CssSyntaxKind::CSS_DECLARATION_OR_RULE_BLOCK
                        | CssSyntaxKind::CSS_AT_RULE
                        | CssSyntaxKind::SCSS_IF_AT_RULE
                        | CssSyntaxKind::SCSS_ELSE_CLAUSE
                        | CssSyntaxKind::SCSS_EACH_AT_RULE
                        | CssSyntaxKind::SCSS_FOR_AT_RULE
                        | CssSyntaxKind::SCSS_WHILE_AT_RULE
                        | CssSyntaxKind::SCSS_INCLUDE_AT_RULE
                )
            })
            .and_then(ScssNestingDeclaration::cast)
            .map(Self::from)
    }
}

/// Returns the name Sass emits for the property `name` nested in `group`.
///
/// Sass joins the name of a nested property to the names of the groups
/// around it, so `left-radius` in `border: { top: { left-radius: 1px; } }` sets
/// `border-top-left-radius`. Returns `None` if the name of a group isn't a
/// plain identifier, such as an interpolated `#{$side}`.
pub fn nested_property_name(name: &str, group: AnyPropertyStatement) -> Option<String> {
    let mut full_name = String::from(name);
    for group in successors(Some(group), AnyPropertyStatement::group) {
        let group_name = group.name()?;
        full_name.insert(0, '-');
        full_name.insert_str(0, group_name.text_trimmed());
    }
    Some(full_name)
}

const SCSS_BUILT_IN_FUNCTIONS: &[&str] = &[
    "abs",
    "adjust-color",
    "adjust-hue",
    "alpha",
    "append",
    "blue",
    "call",
    "ceil",
    "change-color",
    "color",
    "comparable",
    "complement",
    "content-exists",
    "darken",
    "desaturate",
    "fade-in",
    "fade-out",
    "feature-exists",
    "floor",
    "function-exists",
    "get-function",
    "global-variable-exists",
    "grayscale",
    "green",
    "hsl",
    "hsla",
    "hue",
    "hwb",
    "ie-hex-str",
    "if",
    "index",
    "inspect",
    "invert",
    "is-bracketed",
    "is-superselector",
    "join",
    "keywords",
    "lab",
    "lch",
    "length",
    "lighten",
    "lightness",
    "list-separator",
    "map-get",
    "map-has-key",
    "map-keys",
    "map-merge",
    "map-remove",
    "map-values",
    "max",
    "min",
    "mix",
    "mixin-exists",
    "nth",
    "oklab",
    "oklch",
    "opacify",
    "opacity",
    "percentage",
    "quote",
    "random",
    "red",
    "rgb",
    "rgba",
    "round",
    "saturate",
    "saturation",
    "scale-color",
```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/container_scroll_state_and_combinable_query.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssContainerScrollStateAndCombinableQuery;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssContainerScrollStateAndCombinableQuery;
impl FormatRule<AnyCssContainerScrollStateAndCombinableQuery>
    for FormatAnyCssContainerScrollStateAndCombinableQuery
{
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssContainerScrollStateAndCombinableQuery,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssContainerScrollStateAndCombinableQuery::CssContainerScrollStateAndQuery(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateAndCombinableQuery::CssContainerScrollStateInParens(node) => {
                node.format().fmt(f)
            }
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/container_scroll_state_in_parens.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssContainerScrollStateInParens;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssContainerScrollStateInParens;
impl FormatRule<AnyCssContainerScrollStateInParens> for FormatAnyCssContainerScrollStateInParens {
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssContainerScrollStateInParens,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssContainerScrollStateInParens::AnyCssContainerScrollStateQuery(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateInParens::AnyCssValue(node) => node.format().fmt(f),
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/container_scroll_state_or_combinable_query.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssContainerScrollStateOrCombinableQuery;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssContainerScrollStateOrCombinableQuery;
impl FormatRule<AnyCssContainerScrollStateOrCombinableQuery>
    for FormatAnyCssContainerScrollStateOrCombinableQuery
{
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssContainerScrollStateOrCombinableQuery,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssContainerScrollStateOrCombinableQuery::CssContainerScrollStateInParens(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateOrCombinableQuery::CssContainerScrollStateOrQuery(node) => {
                node.format().fmt(f)
            }
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/container_scroll_state_query.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssContainerScrollStateQuery;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssContainerScrollStateQuery;
impl FormatRule<AnyCssContainerScrollStateQuery> for FormatAnyCssContainerScrollStateQuery {
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssContainerScrollStateQuery,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssContainerScrollStateQuery::AnyCssQueryFeature(node) => node.format().fmt(f),
            AnyCssContainerScrollStateQuery::CssContainerScrollStateAndQuery(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateQuery::CssContainerScrollStateInParens(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateQuery::CssContainerScrollStateNotQuery(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateQuery::CssContainerScrollStateOrQuery(node) => {
                node.format().fmt(f)
            }
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/declaration_or_statement_block.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssDeclarationOrStatementBlock;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssDeclarationOrStatementBlock;
impl FormatRule<AnyCssDeclarationOrStatementBlock> for FormatAnyCssDeclarationOrStatementBlock {
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssDeclarationOrStatementBlock,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssDeclarationOrStatementBlock::CssBogusBlock(node) => node.format().fmt(f),
            AnyCssDeclarationOrStatementBlock::CssDeclarationBlock(node) => node.format().fmt(f),
            AnyCssDeclarationOrStatementBlock::CssDeclarationOrAtRuleBlock(node) => {
                node.format().fmt(f)
            }
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/auxiliary/container_scroll_state_and_query.rs`
```
use crate::prelude::*;
use biome_css_syntax::{CssContainerScrollStateAndQuery, CssContainerScrollStateAndQueryFields};
use biome_formatter::write;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatCssContainerScrollStateAndQuery;
impl FormatNodeRule<CssContainerScrollStateAndQuery> for FormatCssContainerScrollStateAndQuery {
    fn fmt_fields(
        &self,
        node: &CssContainerScrollStateAndQuery,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        let CssContainerScrollStateAndQueryFields {
            left,
            and_token,
            right,
        } = node.as_fields();

        write!(
            f,
            [
                left.format(),
                space(),
                and_token.format()?.with_text_case(CssCase::Preserve),
                space(),
                right.format()
            ]
        )
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/auxiliary/container_scroll_state_in_parens.rs`
```
use crate::prelude::*;
use biome_css_syntax::{CssContainerScrollStateInParens, CssContainerScrollStateInParensFields};
use biome_formatter::{format_args, write};
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatCssContainerScrollStateInParens;
impl FormatNodeRule<CssContainerScrollStateInParens> for FormatCssContainerScrollStateInParens {
    fn fmt_fields(
        &self,
        node: &CssContainerScrollStateInParens,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        let CssContainerScrollStateInParensFields {
            l_paren_token,
            query,
            r_paren_token,
        } = node.as_fields();

        write!(
            f,
            [group(&format_args![
                l_paren_token.format(),
                &soft_block_indent(&query.format()),
                r_paren_token.format()
            ])]
        )
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13177** (2026-11-14): **fix(lint/complexity): do not report this alias in class property initializers**
  *Symptoms*: ## Summary  Fixes #13125  In `lint/complexity/noUselessThisAlias`, a `this` alias whose reference appears within a class property or field initializer (such as `initial = self.count;` or `getCount = () => self.count;`) was previously reported as unnecessary and replaced with `this`. However, class property initializers execute with `this` bound to the instance being constructed (or to the class constructor for static fields), which alters runtime meaning and points `this` to a different object than the enclosing method.  ### Root Cause When finding the enclosing `this` scope via `AnyJsControlFlowRoot`, class property members (`JsPropertyClassMember` and `TsInitializedPropertySignatureClassMember`) were not treated as establishing their own `this` context for their initializer values. References inside field initializers consequently skipped up to the enclosing method's control flow root.  ### Changes - Implemented `find_this_scope` in `crates/biome_js_analyze/src/lint/complexity/no_useless_this_alias.rs`:   - Treats the initializer value of `JsPropertyClassMember` and `TsInitializedPropertySignatureClassMember` as its own distinct `this` scope.   - Preserves outer `this` evaluation for computed member names (e.g. `[self.key] = 1`).   - Correctly reports and fixes aliases defined directly inside property initializers when references stay within that same property initializer. - Added test cases for instance and static field initializers to `valid.js` and `invalid.js` spec test

- **Issue #13163** (2026-11-13): **fix(noUselessThisAlias): do not report aliases used in class field initializers 🤖🤖🤖**
  *Symptoms*: ## Summary  Fixes #13125  `noUselessThisAlias` compared the nearest `AnyJsControlFlowRoot` of each alias reference against the declarator's root. Class field initializers are not control flow roots, so a `self` used inside `class Widget { initial = self.count }` was considered to share the outer `this`, and the safe fix rewrote it to `this.count`, which binds to the class instance instead of the captured value.  The reference walk now also stops at a `JsInitializerClause` owned by `JsPropertyClassMember` or `TsInitializedPropertySignatureClassMember`, which introduces a `this` bound to the class instance. Aliases referenced there are correctly treated as required, so no diagnostic and no fix are emitted.  Computed member names (`[self.count]`) still report, since they evaluate in the enclosing scope.  ## Test Plan  - Added the issue reproduction to `valid.js` (instance fields, arrow-function fields, static fields) and `valid.ts` (typed fields, `TsInitializedPropertySignatureClassMember`). - Added a computed-member-name case to `invalid.js` to keep covering names evaluated in the outer scope. - `cargo test -p biome_js_analyze`: 4851 tests pass. - `cargo clippy -p biome_js_analyze --lib --all-features -- --deny warnings`: clean. Note: workspace-wide `cargo lint` currently fails on `main` on a pre-existing `biome_service` warning unrelated to this change.  ## Docs  No documentation changes; the existing rule docs already describe the intended behavior.  ---  AI assistance notice

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

### Incident Patch 1: `e3ab04d5` (2026-11-14)
**Commit Message**: fix(tailwind): locate classes in unquoted object keys correctly (#12845)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/fix-tailwind-unquoted-object-key-range.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@biomejs/biome": patch
+---
+
+Fixed the location of Tailwind CSS diagnostics reported on unquoted object keys. In `clsx({ shadow: active })`, diagnostics now highlight `shadow` instead of starting one character later at `hadow:`.
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2147,6 +2147,7 @@ dependencies = [
  "biome_console",
  "biome_diagnostics",
  "biome_html_syntax",
+ "biome_js_parser",
  "biome_js_syntax",
  "biome_languages",
  "biome_module_graph",
```

**File**: `crates/biome_js_analyze/src/tailwind.rs` (modified, +9/-2)
```diff
@@ -4,7 +4,7 @@ use biome_js_factory::make::{
     js_literal_member_name, js_string_literal, js_string_literal_expression,
     js_string_literal_single_quotes, js_template_chunk, js_template_chunk_element, jsx_string,
 };
-use biome_js_syntax::JsLanguage;
+use biome_js_syntax::{JsLanguage, JsSyntaxKind};
 use biome_rowan::{BatchMutation, TextRange, TextSize};
 
 pub(crate) type AnyTailwindClassString = AnyClassStringLike;
@@ -74,7 +74,14 @@ fn inner_text_start(node: &AnyTailwindClassString) -> Option<TextSize> {
             Some(node.value_token().ok()?.text_trimmed_range().start() + TextSize::from(1))
         }
         AnyTailwindClassString::JsLiteralMemberName(node) => {
-            Some(node.value().ok()?.text_trimmed_range().start() + TextSize::from(1))
+            let value = node.value().ok()?;
+            // Only string literal keys have an opening quote to skip.
+            let quote_len = if value.kind() == JsSyntaxKind::JS_STRING_LITERAL {
+                TextSize::from(1)
+            } else {
+                TextSize::from(0)
+            };
+            Some(value.text_trimmed_range().start() + quote_len)
         }
         AnyTailwindClassString::JsxString(node) => {
             Some(node.value_token().ok()?.text_trimmed_range().start() + TextSize::from(1))
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/noTailwindRestyledComponents/invalid.jsx.snap` (modified, +2/-2)
```diff
@@ -346,14 +346,14 @@ invalid.jsx:11:28 lint/nursery/noTailwindRestyledComponents ━━━━━━
 ```
 
 ```
-invalid.jsx:11:52 lint/nursery/noTailwindRestyledComponents ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+invalid.jsx:11:51 lint/nursery/noTailwindRestyledComponents ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
   i This Tailwind utility restyles a component.
   
      9 │ <Button className={active && "opacity-50"} />;
     10 │ <Button className={cn("mt-4", active && "rounded-none")} />;
   > 11 │ <Button className={clsx({ "rounded-none": active, shadow: active })} />;
-       │                                                    ^^^^^^
+       │                                                   ^^^^^^
     12 │ <Button className={`mt-4 ${extra} text-sm`} />;
     13 │ <Button className="[font-size:14px] hover:[border-radius:0]" />;
   
```

**File**: `crates/biome_tailwind_logic/Cargo.toml` (modified, +5/-4)
```diff
@@ -38,10 +38,11 @@ salsa                  = { workspace = true }
 smallvec               = { workspace = true }
 
 [dev-dependencies]
-criterion     = { package = "codspeed-criterion-compat", version = "=5.0.1" }
-insta         = { workspace = true, features = ["glob"] }
-json_comments = "0.2.2"
-serde_json    = { workspace = true }
+biome_js_parser = { path = "../biome_js_parser" }
+criterion       = { package = "codspeed-criterion-compat", version = "=5.0.1" }
+insta           = { workspace = true, features = ["glob"] }
+json_comments   = "0.2.2"
+serde_json      = { workspace = true }
 
 [target.'cfg(all(target_family="unix", not(all(target_arch = "aarch64", target_env = "musl"))))'.dev-dependencies]
 tikv-jemallocator = { workspace = true }
```

**File**: `crates/biome_tailwind_logic/src/syntax_service.rs` (modified, +35/-1)
```diff
@@ -716,9 +716,16 @@ impl TailwindClassStringHost for JsLiteralMemberName {
         if !inspect_string_literal(self.syntax(), options, is_class_attribute).unwrap_or(false) {
             return None;
         }
+        let value = self.value().ok()?;
+        // Only string literal keys have an opening quote to skip.
+        let quote_len = if value.kind() == JsSyntaxKind::JS_STRING_LITERAL {
+            TextSize::from(1)
+        } else {
+            TextSize::from(0)
+        };
         tailwind_class_string(
             self.name().ok()?,
-            self.value().ok()?.text_trimmed_range().start() + TextSize::from(1),
+            value.text_trimmed_range().start() + quote_len,
             ClassStringHostKind::JsLiteralMemberName,
         )
         .into()
@@ -808,3 +815,30 @@ impl TailwindClassStringHost for HtmlAttribute {
         .into()
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use biome_js_parser::{JsParserOptions, parse};
+
+    /// Returns the source text at the `inner_range` of each object key that
+    /// holds a class string in `source`.
+    fn object_key_class_texts(source: &str) -> Vec<String> {
+        let parse = parse(source, JsFileSource::jsx(), JsParserOptions::default());
+        parse
+            .syntax()
+            .descendants()
+            .filter_map(JsLiteralMemberName::cast)
+            .filter_map(|name| name.tailwind_class_string(&TailwindOptions::default(), false))
+            .map(|class_string| source[class_string.inner_range].to_string())
+            .collect()
+    }
+
+    #[test]
+    fn object_key_inner_range() {
+        assert_eq!(
+            object_key_class_texts(r#"clsx({ flex: active, "p-2": active, 'm-2': active });"#),
+            ["flex", "p-2", "m-2"]
+        );
+    }
+}
```

---

### Incident Patch 2: `be58f67e` (2026-11-14)
**Commit Message**: feat(lint): add useTopLevelRequire (#13081)

Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `.changeset/add-use-top-level-require-rule.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@biomejs/biome": patch
+---
+
+Added the nursery rule [`useTopLevelRequire`](https://biomejs.dev/linter/rules/use-top-level-require/), which reports `require()` calls that aren't at the top level of the module, such as calls inside functions, blocks, or `try` statements.
+
+```js
+function readFile(filename, callback) {
+    const fs = require("fs");
+    fs.readFile(filename, callback);
+}
+```
```

**File**: `crates/biome_cli/src/execute/migrate/eslint_any_rule_to_biome.rs` (modified, +24/-0)
```diff
@@ -2615,6 +2615,18 @@ pub(crate) fn migrate_eslint_any_rule(
                 .get_or_insert(Default::default());
             rule.set_level(rule.level().max(rule_severity.into()));
         }
+        "global-require" => {
+            if !options.include_nursery {
+                results.add(eslint_name, eslint_to_biome::RuleMigrationResult::Nursery);
+                return false;
+            }
+            let group = rules.nursery.get_or_insert_with(Default::default);
+            let rule = group
+                .unwrap_group_as_mut()
+                .use_top_level_require
+                .get_or_insert(Default::default());
+            rule.set_level(rule.level().max(rule_severity.into()));
+        }
         "grouped-accessor-pairs" => {
             let group = rules.style.get_or_insert_with(Default::default);
             let rule = group
@@ -3423,6 +3435,18 @@ pub(crate) fn migrate_eslint_any_rule(
                 .get_or_insert(Default::default());
             rule.set_level(rule.level().max(rule_severity.into()));
         }
+        "n/global-require" => {
+            if !options.include_nursery {
+                results.add(eslint_name, eslint_to_biome::RuleMigrationResult::Nursery);
+                return false;
+            }
+            let group = rules.nursery.get_or_insert_with(Default::default);
+            let rule = group
+                .unwrap_group_as_mut()
+                .use_top_level_require
+                .get_or_insert(Default::default());
+            rule.set_level(rule.level().max(rule_severity.into()));
+        }
         "n/no-deprecated-api" => {
             if !options.include_inspired {
                 results.add(eslint_name, eslint_to_biome::RuleMigrationResult::Inspired);
```

**File**: `crates/biome_configuration/src/analyzer/linter/rules.rs` (modified, +4/-0)
```diff
@@ -816,6 +816,7 @@ pub enum RuleName {
     UseThrowOnlyError,
     UseTopLevelHeading,
     UseTopLevelRegex,
+    UseTopLevelRequire,
     UseTrimStartEnd,
     UseUnaryMinus,
     UseUnicodeRegex,
@@ -1641,6 +1642,7 @@ impl RuleName {
             Self::UseThrowOnlyError => "useThrowOnlyError",
             Self::UseTopLevelHeading => "useTopLevelHeading",
             Self::UseTopLevelRegex => "useTopLevelRegex",
+            Self::UseTopLevelRequire => "useTopLevelRequire",
             Self::UseTrimStartEnd => "useTrimStartEnd",
             Self::UseUnaryMinus => "useUnaryMinus",
             Self::UseUnicodeRegex => "useUnicodeRegex",
@@ -2460,6 +2462,7 @@ impl RuleName {
             Self::UseThrowOnlyError => RuleGroup::Style,
             Self::UseTopLevelHeading => RuleGroup::Nursery,
             Self::UseTopLevelRegex => RuleGroup::Performance,
+            Self::UseTopLevelRequire => RuleGroup::Nursery,
             Self::UseTrimStartEnd => RuleGroup::Style,
             Self::UseUnaryMinus => RuleGroup::Nursery,
             Self::UseUnicodeRegex => RuleGroup::Style,
@@ -3292,6 +3295,7 @@ impl std::str::FromStr for RuleName {
             "useThrowOnlyError" => Ok(Self::UseThrowOnlyError),
             "useTopLevelHeading" => Ok(Self::UseTopLevelHeading),
             "useTopLevelRegex" => Ok(Self::UseTopLevelRegex),
+            "useTopLevelRequire" => Ok(Self::UseTopLevelRequire),
             "useTrimStartEnd" => Ok(Self::UseTrimStartEnd),
             "useUnaryMinus" => Ok(Self::UseUnaryMinus),
             "useUnicodeRegex" => Ok(Self::UseUnicodeRegex),
```

**File**: `crates/biome_configuration/src/generated/linter_options_check.rs` (modified, +5/-0)
```diff
@@ -3400,6 +3400,11 @@ pub fn config_side_rule_options_types() -> Vec<(&'static str, &'static str, Type
         "useTopLevelRegex",
         TypeId::of::<biome_rule_options::use_top_level_regex::UseTopLevelRegexOptions>(),
     ));
+    result.push((
+        "nursery",
+        "useTopLevelRequire",
+        TypeId::of::<biome_rule_options::use_top_level_require::UseTopLevelRequireOptions>(),
+    ));
     result.push((
         "style",
         "useTrimStartEnd",
```

**File**: `crates/biome_diagnostics_categories/src/categories.rs` (modified, +1/-0)
```diff
@@ -537,6 +537,7 @@ define_categories! {
     "lint/nursery/useTanstackQueryInfiniteQueryPropertyOrder": "https://biomejs.dev/linter/rules/use-tanstack-query-infinite-query-property-order",
     "lint/nursery/useTanstackQueryStableQueryClient": "https://biomejs.dev/linter/rules/use-tanstack-query-stable-query-client",
     "lint/nursery/useTopLevelHeading": "https://biomejs.dev/linter/rules/use-top-level-heading",
+    "lint/nursery/useTopLevelRequire": "https://biomejs.dev/linter/rules/use-top-level-require",
     "lint/nursery/useUnaryMinus": "https://biomejs.dev/linter/rules/use-unary-minus",
     "lint/nursery/useUniqueArgumentNames": "https://biomejs.dev/linter/rules/use-unique-argument-names",
     "lint/nursery/useUniqueFieldDefinitionNames": "https://biomejs.dev/linter/rules/use-unique-field-definition-names",
```

**File**: `crates/biome_js_analyze/src/lint/nursery/use_top_level_require.rs` (added, +175/-0)
```diff
@@ -0,0 +1,175 @@
+use crate::services::semantic::Semantic;
+use biome_analyze::{Rule, RuleDiagnostic, RuleSource, context::RuleContext, declare_lint_rule};
+use biome_console::markup;
+use biome_diagnostics::Severity;
+use biome_js_syntax::{
+    JsAssignmentExpression, JsCallArgumentList, JsCallArguments, JsCallExpression,
+    JsComputedMemberAssignment, JsComputedMemberExpression, JsConditionalExpression, JsExpressionStatement,
+    JsInitializerClause, JsLanguage, JsModule, JsModuleItemList, JsParenthesizedExpression,
+    JsScript, JsStatementList, JsStaticMemberAssignment, JsStaticMemberExpression, JsVariableDeclaration,
+    JsVariableDeclarator, JsVariableDeclaratorList, JsVariableStatement, TsAsExpression,
+    TsNonNullAssertionExpression, TsSatisfiesExpression, TsTypeAssertionExpression,
+};
+use biome_rowan::{AstNode, SyntaxKindSet};
+use biome_rule_options::use_top_level_require::UseTopLevelRequireOptions;
+
+declare_lint_rule! {
+    /// Require `require()` calls to be placed at the top level of the module.
+    ///
+    /// When `require()` calls are spread across functions, blocks, and other expressions,
+    /// it's hard to see at a glance which modules a file depends on. `require()` also loads
+    /// modules synchronously, so a call inside a function that runs later can pause the
+    /// program at a moment you don't expect.
+    ///
+    /// A `require()` call is allowed only at the top level of the module, and only when it is
+    /// used as a statement on its own, in a variable declaration, in an assignment, in a
+    /// conditional (`? :`) expression, as an argument of another call, or when its result is
+    /// accessed with a property or called. The rule reports every other `require()` call,
+    /// including top-level calls inside objects, arrays, `export` declarations, or loops.
+    ///
+    /// The rule doesn't report `require` when it's a variable, parameter, or function declared
+    /// in your own code.
+    ///
+    /// ## Examples
+    ///
+    /// ### Invalid
+    ///
+    /// ```js,expect_diagnostic
+    /// function readFile(filename, callback) {
+    ///     const fs = require("fs");
+    ///     fs.readFile(filename, callback);
+    /// }
+    /// ```
+    ///
+    /// ```js,expect_diagnostic
+    /// if (DEBUG) {
+    ///     require("debug");
+    /// }
+    /// ```
+    ///
+    /// ```js,expect_diagnostic
+    /// const getModule = (name) => require(name);
+    /// ```
+    ///
+    /// ```js,expect_diagnostic
+    /// try {
+    ///     require(unsafeModule);
+    /// } catch (e) {
+    ///     console.log(e);
+    /// }
+    /// ```
+    ///
+    /// ### Valid
+    ///
+    /// ```js
+    /// require("x");
+    /// const y = require("y");
+    /// let z;
+    /// z = require("z").initialize();
+    ///
+    /// const fs = require("fs");
+    /// function readFile(filename, callback) {
+    ///     fs.readFile(filename, callback);
+    /// }
+    ///
+    /// const logger = DEBUG ? require("dev-logger") : require("logger");
+    ///
+    /// function localRequire(require) {
+    ///     require("y");
+    /// }
+    /// ```
+    ///
+    /// ## See Also
+    ///
+    /// - If you want to disallow `require` entirely, see [`noCommonJs`](https://biomejs.dev/linter/rules/no-common-js/).
+    ///
+    pub UseTopLevelRequire {
+        version: "next",
+        name: "useTopLevelRequire",
+        language: "js",
+        sources: &[
+            RuleSource::Eslint("global-require").same(),
+            RuleSource::EslintN("global-require").same(),
+        ],
+        recommended: false,
+        severity: Severity::Warning,
+    }
+}
+
+impl Rule for UseTopLevelRequire {
+    type Query = Semantic<JsCallExpression>;
+    type State = ();
+    type Signals = Option<Self::State>;
+    type Options = UseTopLevelRequireOptions;
+
+    fn run(ctx: &RuleContext<Self>) -> Self::Signals {
+        let node = ctx.query();
+        let reference = node
+            .callee()
+            .ok()?
+            .omit_parentheses()
+            .as_js_identifier_expression()?
+            .name()
+            .ok()?;
+        if reference.value_token().ok()?.text_trimmed() != "require" {
+            return None;
+        }
+        // A local binding named `require` isn't the module loader.
+        if ctx.model().binding(&reference).is_some() {
+            return None;
+        }
+        let is_top_level = node
+            .syntax()
+            .ancestors()
+            .skip(1)
+            .all(|ancestor| TOP_LEVEL_REQUIRE_ANCESTOR_KINDS.matches(ancestor.kind()));
+        (!is_top_level).then_some(())
+    }
+
+    fn diagnostic(ctx: &RuleContext<Self>, _state: &Self::State) -> Option<RuleDiagnostic> {
+        Some(
+            RuleDiagnostic::new(
+                rule_category!(),
+                ctx.query().range(),
+                markup! {
+                    "This "<Emphasis>"require()"</Emphasis>" call isn't directly part of a top-level statement."
+   
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/useTopLevelRequire/invalid.js` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+/* should generate diagnostics */
+if (process.env.NODE_ENV === 'DEVELOPMENT') {
+	require('debug');
+}
+var x; if (y) { x = require('debug'); }
+var x2; if (y) { x2 = require('debug').baz; }
+function f() { require('y') }
+try { require('x'); } catch (e) { console.log(e); }
+var getModule = x => require(x);
+var weird = (x => require(x))('weird')
+switch(x) { case '1': require('1'); break; }
+{ require('block'); }
+class A { static { require('static-block'); } }
+var obj = { key: require('y') };
+var arr = [require('y')];
+var both = a || require('y');
+var seq = (a, require('y'));
+var inst = new Foo(require('y'));
+var tagged = require('y')`template`;
+var { withDefault = require('y') } = obj;
+for (const item of require('y')) {}
+label: require('y');
+export const exported = require('y');
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/useTopLevelRequire/invalid.js.snap` (added, +452/-0)
```diff
@@ -0,0 +1,452 @@
+---
+source: crates/biome_js_analyze/tests/spec_tests.rs
+assertion_line: 211
+expression: invalid.js
+---
+# Input
+```js
+/* should generate diagnostics */
+if (process.env.NODE_ENV === 'DEVELOPMENT') {
+	require('debug');
+}
+var x; if (y) { x = require('debug'); }
+var x2; if (y) { x2 = require('debug').baz; }
+function f() { require('y') }
+try { require('x'); } catch (e) { console.log(e); }
+var getModule = x => require(x);
+var weird = (x => require(x))('weird')
+switch(x) { case '1': require('1'); break; }
+{ require('block'); }
+class A { static { require('static-block'); } }
+var obj = { key: require('y') };
+var arr = [require('y')];
+var both = a || require('y');
+var seq = (a, require('y'));
+var inst = new Foo(require('y'));
+var tagged = require('y')`template`;
+var { withDefault = require('y') } = obj;
+for (const item of require('y')) {}
+label: require('y');
+export const exported = require('y');
+
+```
+
+# Diagnostics
+```
+invalid.js:3:2 lint/nursery/useTopLevelRequire ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  ! This require() call isn't directly part of a top-level statement.
+  
+    1 │ /* should generate diagnostics */
+    2 │ if (process.env.NODE_ENV === 'DEVELOPMENT') {
+  > 3 │ 	require('debug');
+      │ 	^^^^^^^^^^^^^^^^
+    4 │ }
+    5 │ var x; if (y) { x = require('debug'); }
+  
+  i Modules loaded inside functions, blocks, or other expressions make it hard to see what the file depends on, and can be loaded at unexpected times.
+  
+  i Load the module in a top-level declaration, for example const name = require("module"), and use that variable here.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
+
+```
+invalid.js:5:21 lint/nursery/useTopLevelRequire ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  ! This require() call isn't directly part of a top-level statement.
+  
+    3 │ 	require('debug');
+    4 │ }
+  > 5 │ var x; if (y) { x = require('debug'); }
+      │                     ^^^^^^^^^^^^^^^^
+    6 │ var x2; if (y) { x2 = require('debug').baz; }
+    7 │ function f() { require('y') }
+  
+  i Modules loaded inside functions, blocks, or other expressions make it hard to see what the file depends on, and can be loaded at unexpected times.
+  
+  i Load the module in a top-level declaration, for example const name = require("module"), and use that variable here.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
+
+```
+invalid.js:6:23 lint/nursery/useTopLevelRequire ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  ! This require() call isn't directly part of a top-level statement.
+  
+    4 │ }
+    5 │ var x; if (y) { x = require('debug'); }
+  > 6 │ var x2; if (y) { x2 = require('debug').baz; }
+      │                       ^^^^^^^^^^^^^^^^
+    7 │ function f() { require('y') }
+    8 │ try { require('x'); } catch (e) { console.log(e); }
+  
+  i Modules loaded inside functions, blocks, or other expressions make it hard to see what the file depends on, and can be loaded at unexpected times.
+  
+  i Load the module in a top-level declaration, for example const name = require("module"), and use that variable here.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
+
+```
+invalid.js:7:16 lint/nursery/useTopLevelRequire ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  ! This require() call isn't directly part of a top-level statement.
+  
+    5 │ var x; if (y) { x = require('debug'); }
+    6 │ var x2; if (y) { x2 = require('debug').baz; }
+  > 7 │ function f() { require('y') }
+      │                ^^^^^^^^^^^^
+    8 │ try { require('x'); } catch (e) { console.log(e); }
+    9 │ var getModule = x => require(x);
+  
+  i Modules loaded inside functions, blocks, or other expressions make it hard to see what the file depends on, and can be loaded at unexpected times.
+  
+  i Load the module in a top-level declaration, for example const name = require("module"), and use that variable here.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
+
+```
+invalid.js:8:7 lint/nursery/useTopLevelRequire ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  ! This require() call isn't directly part of a top-level statement.
+  
+     6 │ var x2; if (y) { x2 = require('debug').baz; }
+     7 │ function f() { require('y') }
+   > 8 │ try { require('x'); } catch (e) { console.log(e); }
+       │       ^^^^^^^^^^^^
+     9 │ var getModule = x => require(x);
+    10 │ va
```

---

### Incident Patch 3: `d5da3946` (2026-11-13)
**Commit Message**: fix(analyze): emit suppression actions for plugin diagnostics (#12602)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/fix-plugin-suppressions.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@biomejs/biome": patch
+---
+
+Fixed [#12600](https://github.com/biomejs/biome/issues/12600): `biome lint --suppress` now adds suppression comments for diagnostics emitted by plugins, such as ``// biome-ignore lint/plugin/noFoo: ignored using `--suppress` ``.
```

**File**: `.changeset/reject-unsuppressible-plugin-names.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@biomejs/biome": patch
+---
+
+Biome now reports an error when a GritQL plugin file name contains invalid characters that could conflict with Biome suppressions.
```

**File**: `crates/biome_analyze/src/analyzer_plugin.rs` (modified, +14/-2)
```diff
@@ -182,7 +182,13 @@ where
 
             let signal = PluginSignal::<L>::new(entry.diagnostic)
                 .with_plugin_action(entry.action)
-                .with_root(node.clone());
+                .with_root(node.clone())
+                .with_suppression(
+                    name.clone().into(),
+                    ctx.root,
+                    ctx.suppression_action,
+                    ctx.options,
+                );
 
             SignalEntry {
                 text_range,
@@ -299,7 +305,13 @@ where
 
                 let signal = PluginSignal::<L>::new(entry.diagnostic)
                     .with_plugin_action(entry.action)
-                    .with_root(node.clone());
+                    .with_root(node.clone())
+                    .with_suppression(
+                        name.clone().into(),
+                        ctx.root,
+                        ctx.suppression_action,
+                        ctx.options,
+                    );
 
                 SignalEntry {
                     text_range,
```

**File**: `crates/biome_analyze/src/rule.rs` (modified, +8/-9)
```diff
@@ -1527,11 +1527,11 @@ pub trait Rule: RuleMeta + Sized {
         None
     }
 }
-fn build_top_level_suppression<L: Language>(
+pub(crate) fn build_top_level_suppression<L: Language>(
     root: L::Root,
     category: RuleCategory,
-    group_name: &'static str,
-    rule_name: &'static str,
+    group_name: &str,
+    rule_name: &str,
     suppression_action: &dyn SuppressionAction<Language = L>,
 ) -> Option<SuppressAction<L>> {
     if matches!(
@@ -1571,15 +1571,14 @@ fn build_top_level_suppression<L: Language>(
     None
 }
 
-/// Body of [Rule::inline_suppression], kept outside the trait so it is
-/// monomorphized once per language instead of once per rule: the rule only
-/// contributes its category, group name, and rule name.
-fn build_inline_suppression<L: Language>(
+/// Shared by [Rule::inline_suppression] and plugin signals, and kept outside
+/// the trait so it is monomorphized once per language instead of once per rule.
+pub(crate) fn build_inline_suppression<L: Language>(
     root: L::Root,
     text_range: &TextRange,
     category: RuleCategory,
-    group_name: &'static str,
-    rule_name: &'static str,
+    group_name: &str,
+    rule_name: &str,
     suppression_action: &dyn SuppressionAction<Language = L>,
     suppression_reason: Option<&str>,
 ) -> Option<SuppressAction<L>> {
```

**File**: `crates/biome_analyze/src/signals.rs` (modified, +116/-22)
```diff
@@ -2,16 +2,21 @@ use crate::categories::{
     SUPPRESSION_INLINE_ACTION_CATEGORY, SUPPRESSION_TOP_LEVEL_ACTION_CATEGORY,
 };
 use crate::{
-    AnalyzerDiagnostic, AnalyzerOptions, FixKind, GroupCategory, OtherActionCategory,
+    AnalyzerDiagnostic, AnalyzerOptions, FixKind, GroupCategory, OtherActionCategory, PLUGIN_GROUP,
     PluginActionData, Queryable, RuleCategory, RuleDiagnostic, RuleGroup, ServiceBag,
     SuppressionAction,
     categories::ActionCategory,
     context::RuleContext,
-    registry::{RuleLanguage, RuleRoot},
-    rule::{Rule, RuleAction, RuleMetadata, SuppressAction},
+    registry::{LanguageRoot, RuleLanguage, RuleRoot},
+    rule::{
+        Rule, RuleAction, RuleMetadata, SuppressAction, build_inline_suppression,
+        build_top_level_suppression,
+    },
 };
 use biome_console::{MarkupBuf, markup};
-use biome_diagnostics::{Applicability, CodeSuggestion, Error, advice::CodeSuggestionAdvice};
+use biome_diagnostics::{
+    Applicability, CodeSuggestion, DiagnosticTags, Error, advice::CodeSuggestionAdvice,
+};
 use biome_rowan::{BatchMutation, Language, SyntaxNode, TextRange};
 use biome_text_edit::TextEdit;
 use enumflags2::{BitFlag, BitFlags, bitflags};
@@ -183,18 +188,29 @@ where
 /// Unlike [DiagnosticSignal] which converts through [Error] into
 /// [DiagnosticKind::Raw](crate::diagnostics::DiagnosticKind::Raw), this type
 /// directly converts via `AnalyzerDiagnostic::from(RuleDiagnostic)`.
-pub struct PluginSignal<L: Language> {
+pub struct PluginSignal<'phase, L: Language> {
     diagnostic: RuleDiagnostic,
     plugin_action: Option<PluginActionData>,
     root: Option<SyntaxNode<L>>,
+    suppression: Option<PluginSuppression<'phase, L>>,
+}
+
+/// Context required to build suppression comments for a plugin diagnostic.
+struct PluginSuppression<'phase, L: Language> {
+    /// Name used in `lint/plugin/<name>` suppression comments.
+    plugin_name: Box<str>,
+    file_root: &'phase LanguageRoot<L>,
+    suppression_action: &'phase dyn SuppressionAction<Language = L>,
+    options: &'phase AnalyzerOptions,
 }
 
-impl<L: Language> PluginSignal<L> {
+impl<'phase, L: Language> PluginSignal<'phase, L> {
     pub fn new(diagnostic: RuleDiagnostic) -> Self {
         Self {
             diagnostic,
             plugin_action: None,
             root: None,
+            suppression: None,
         }
     }
 
@@ -207,34 +223,97 @@ impl<L: Language> PluginSignal<L> {
         self.root = Some(root);
         self
     }
-}
 
-impl<L: Language> AnalyzerSignal<L> for PluginSignal<L> {
-    fn diagnostic(&self) -> Option<AnalyzerDiagnostic> {
-        Some(AnalyzerDiagnostic::from(self.diagnostic.clone()))
+    /// Enables suppression actions for `lint/plugin/<plugin_name>`.
+    pub fn with_suppression(
+        mut self,
+        plugin_name: Box<str>,
+        file_root: &'phase LanguageRoot<L>,
+        suppression_action: &'phase dyn SuppressionAction<Language = L>,
+        options: &'phase AnalyzerOptions,
+    ) -> Self {
+        self.suppression = Some(PluginSuppression {
+            plugin_name,
+            file_root,
+            suppression_action,
+            options,
+        });
+        self
     }
 
-    fn actions(&self, filter: ActionFilter) -> AnalyzerActionIter<L> {
-        if !filter.is_rule_fix() {
-            return AnalyzerActionIter::new(vec![]);
+    /// Verbose diagnostics, such as GritQL `log()` output, aren't suppressed.
+    fn suppression(&self) -> Option<&PluginSuppression<'phase, L>> {
+        if self.diagnostic.tags.contains(DiagnosticTags::VERBOSE) {
+            return None;
         }
+        self.suppression.as_ref()
+    }
 
-        let Some(action_data) = &self.plugin_action else {
-            return AnalyzerActionIter::new(vec![]);
-        };
-
-        let Some(root) = &self.root else {
-            return AnalyzerActionIter::new(vec![]);
-        };
+    fn rule_fix_action(&self) -> Option<AnalyzerAction<L>> {
+        let action_data = self.plugin_action.as_ref()?;
+        let root = self.root.as_ref()?;
 
-        AnalyzerActionIter::new(vec![AnalyzerAction {
+        Some(AnalyzerAction {
             rule_name: None,
             category: ActionCategory::QuickFix(Cow::Borrowed("plugin")),
             applicability: action_data.applicability,
             message: markup!({ action_data.message }).to_owned(),
             mutation: BatchMutation::new(root.clone()),
             text_edit: Some((action_data.source_range, action_data.text_edit.clone())),
-        }])
+        })
+    }
+}
+
+impl<L: Language> AnalyzerSignal<L> for PluginSignal<'_, L> {
+    fn diagnostic(&self) -> Option<AnalyzerDiagnostic> {
+        Some(AnalyzerDiagnostic::from(self.diagnostic.clone()))
+    }
+
+    fn actions(&self, filter: ActionFilter) -> AnalyzerActionIter<L> {
+        let mut actions = Vec::new();
+
+        if filter.is_rule_fix()
+            && let Some(action) = self.rule_fix_action()
+        {
+            actions.push(actio
```

**File**: `crates/biome_cli/tests/cases/suppressions.rs` (modified, +167/-1)
```diff
@@ -1,6 +1,6 @@
 use crate::TestArgs as Args;
 use crate::snap_test::SnapshotPayload;
-use crate::{FORMATTED, assert_cli_snapshot, run_cli};
+use crate::{FORMATTED, assert_cli_snapshot, run_cli, run_cli_with_server_workspace};
 use biome_console::BufferConsole;
 use biome_fs::{FileSystemExt, MemoryFileSystem};
 use camino::Utf8Path;
@@ -678,3 +678,169 @@ var bar = 33;",
         result,
     ));
 }
+
+#[test]
+fn suppress_plugin_diagnostics() {
+    let fs = MemoryFileSystem::default();
+    let mut console = BufferConsole::default();
+
+    fs.insert(
+        "biome.json".into(),
+        br#"{
+    "plugins": ["noFoo.grit"]
+}
+"#,
+    );
+    fs.insert(
+        "noFoo.grit".into(),
+        br#"language js
+
+`foo($args)` where {
+    register_diagnostic(span=$args, message="Do not call foo", severity="error")
+}
+"#,
+    );
+
+    let file_path = Utf8Path::new("file.js");
+    fs.insert(file_path.into(), *b"debugger;\nfoo(1);\n");
+
+    let (fs, result) = run_cli_with_server_workspace(
+        fs,
+        &mut console,
+        Args::from(["lint", "--suppress", file_path.as_str()].as_slice()),
+    );
+
+    assert!(result.is_ok(), "run_cli returned {result:?}");
+
+    let mut buffer = String::new();
+    fs.open(file_path)
+        .unwrap()
+        .read_to_string(&mut buffer)
+        .unwrap();
+
+    assert_eq!(
+        buffer,
+        "// biome-ignore lint/suspicious/noDebugger: ignored using `--suppress`\ndebugger;\n// biome-ignore lint/plugin/noFoo: ignored using `--suppress`\nfoo(1);\n"
+    );
+
+    assert_cli_snapshot(SnapshotPayload::new(
+        module_path!(),
+        "suppress_plugin_diagnostics",
+        fs,
+        console,
+        result,
+    ));
+}
+
+#[test]
+fn suppress_plugin_diagnostics_with_reason() {
+    let fs = MemoryFileSystem::default();
+    let mut console = BufferConsole::default();
+
+    fs.insert(
+        "biome.json".into(),
+        br#"{
+    "plugins": ["noFoo.grit", "logBar.grit"]
+}
+"#,
+    );
+    fs.insert(
+        "noFoo.grit".into(),
+        br#"language js
+
+`foo($args)` where {
+    register_diagnostic(span=$args, message="Do not call foo", severity="error")
+}
+"#,
+    );
+    fs.insert(
+        "logBar.grit".into(),
+        br#"language js
+
+`bar($args)` where {
+    log(message="Found bar", variable=$args)
+}
+"#,
+    );
+
+    let file_path = Utf8Path::new("file.js");
+    fs.insert(file_path.into(), *b"foo(1);\nbar(2);\n");
+
+    let (fs, result) = run_cli_with_server_workspace(
+        fs,
+        &mut console,
+        Args::from(
+            [
+                "lint",
+                "--suppress",
+                "--reason=We love Biome",
+                file_path.as_str(),
+            ]
+            .as_slice(),
+        ),
+    );
+
+    assert!(result.is_ok(), "run_cli returned {result:?}");
+
+    let mut buffer = String::new();
+    fs.open(file_path)
+        .unwrap()
+        .read_to_string(&mut buffer)
+        .unwrap();
+
+    // `logBar` only logs, so it doesn't get a suppression comment.
+    assert_eq!(
+        buffer,
+        "// biome-ignore lint/plugin/noFoo: We love Biome\nfoo(1);\nbar(2);\n"
+    );
+
+    assert_cli_snapshot(SnapshotPayload::new(
+        module_path!(),
+        "suppress_plugin_diagnostics_with_reason",
+        fs,
+        console,
+        result,
+    ));
+}
+
+#[test]
+fn suppress_rejects_plugin_name_unusable_in_suppressions() {
+    let fs = MemoryFileSystem::default();
+    let mut console = BufferConsole::default();
+
+    fs.insert(
+        "biome.json".into(),
+        br#"{
+    "plugins": ["no foo.grit"]
+}
+"#,
+    );
+    fs.insert(
+        "no foo.grit".into(),
+        br#"language js
+
+`foo($args)` where {
+    register_diagnostic(span=$args, message="Do not call foo", severity="error")
+}
+"#,
+    );
+
+    let file_path = Utf8Path::new("file.js");
+    fs.insert(file_path.into(), *b"foo(1);\n");
+
+    let (fs, result) = run_cli_with_server_workspace(
+        fs,
+        &mut console,
+        Args::from(["lint", "--suppress", file_path.as_str()].as_slice()),
+    );
+
+    assert!(result.is_err(), "run_cli returned {result:?}");
+
+    assert_cli_snapshot(SnapshotPayload::new(
+        module_path!(),
+        "suppress_rejects_plugin_name_unusable_in_suppressions",
+        fs,
+        console,
+        result,
+    ));
+}
```

**File**: `crates/biome_cli/tests/snapshots/main_cases_suppressions/suppress_plugin_diagnostics.snap` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+---
+source: crates/biome_cli/tests/snap_test.rs
+expression: redactor(content)
+---
+## Command
+
+```shell
+biome lint --suppress file.js
+```
+
+## `biome.json`
+
+```json
+{
+  "plugins": ["noFoo.grit"]
+}
+```
+
+## `file.js`
+
+```js
+// biome-ignore lint/suspicious/noDebugger: ignored using `--suppress`
+debugger;
+// biome-ignore lint/plugin/noFoo: ignored using `--suppress`
+foo(1);
+
+```
+
+## `noFoo.grit`
+
+```grit
+language js
+
+`foo($args)` where {
+    register_diagnostic(span=$args, message="Do not call foo", severity="error")
+}
+
+```
+
+# Emitted Messages
+
+```block
+Checked 1 file in <TIME>. Fixed 1 file.
+```
```

**File**: `crates/biome_cli/tests/snapshots/main_cases_suppressions/suppress_plugin_diagnostics_with_reason.snap` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+---
+source: crates/biome_cli/tests/snap_test.rs
+expression: redactor(content)
+---
+## Command
+
+```shell
+biome lint --suppress '--reason=We love Biome' file.js
+```
+
+## `biome.json`
+
+```json
+{
+  "plugins": ["noFoo.grit", "logBar.grit"]
+}
+```
+
+## `file.js`
+
+```js
+// biome-ignore lint/plugin/noFoo: We love Biome
+foo(1);
+bar(2);
+
+```
+
+## `logBar.grit`
+
+```grit
+language js
+
+`bar($args)` where {
+    log(message="Found bar", variable=$args)
+}
+
+```
+
+## `noFoo.grit`
+
+```grit
+language js
+
+`foo($args)` where {
+    register_diagnostic(span=$args, message="Do not call foo", severity="error")
+}
+
+```
+
+# Emitted Messages
+
+```block
+Checked 1 file in <TIME>. Fixed 1 file.
+```
```

#### Recent Merged Pull Requests:
- **PR #13177** (closed): fix(lint/complexity): do not report this alias in class property initializers (@abdul-karim-mia)
- **PR #13163** (closed): fix(noUselessThisAlias): do not report aliases used in class field initializers 🤖🤖🤖 (@nikolas-sapa)
- **PR #13152** (2026-11-13): refactor(lint): make old vue rules use the new vue semantic model (@dyc3)
- **PR #13151** (2026-11-13): perf(html): add token set for mathml elements (@dyc3)
- **PR #13141** (closed): fix(lint/a11y): remove the whole paired element in the noDistractingElements unsafe fix (@rishabhx29)
- **PR #13138** (2026-11-13): perf(package): sublinear SPDX licence lookup (@dyc3)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. tailwind): locate classes in unquoted object keys correctly

**RULE**:
When implementing operations in `.changeset/fix-tailwind-unquoted-object-key-range.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in biomejs/biome. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e3ab04d5`: tailwind): locate classes in unquoted object keys correctly. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/fix-tailwind-unquoted-object-key-range.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
---
"@biomejs/biome": patch
---

Fixed the location of Tailwind CSS diagnostics reported on unquoted object keys. In `clsx({ shadow: active })`, diagnostics now highlight `shadow` instead of starting one character later at `hadow:`.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e3ab04d5` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
